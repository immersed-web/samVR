#!/usr/bin/env bash
set -euo pipefail

# These operations do not expose a reliable percentage. Report elapsed time
# while they run and preserve their exit status and standard input/output.
run_with_progress() {
  local label=$1 task watcher status
  shift
  printf '%s\n' "$label" >&2
  "$@" <&0 &
  task=$!
  (
    elapsed=0
    while kill -0 "$task" 2>/dev/null; do
      sleep 10 < /dev/null > /dev/null 2>&1
      elapsed=$((elapsed + 10))
      if kill -0 "$task" 2>/dev/null; then
        printf '  Still working: %s (%ss elapsed)\n' "$label" "$elapsed" >&2
      fi
    done
  ) &
  watcher=$!
  if wait "$task"; then
    status=0
  else
    status=$?
  fi
  kill "$watcher" 2>/dev/null || true
  wait "$watcher" 2>/dev/null || true
  if (( status == 0 )); then
    printf '  Completed: %s\n' "$label" >&2
  else
    printf '  Failed: %s (exit %s)\n' "$label" "$status" >&2
  fi
  return "$status"
}

root=$(dirname "$(dirname "$(realpath "$0")")")
cd "$root"

if [[ $# -gt 1 ]]; then
  printf 'Usage: bash scripts/migrate-host-to-compose.sh [uploads-directory]\n' >&2
  exit 1
fi
uploads=${1:-"$root/backend/fileserver/uploads"}
if [[ ! -d "$uploads" ]]; then
  printf 'Uploads directory does not exist: %s\n' "$uploads" >&2
  exit 1
fi
uploads=$(realpath "$uploads")

printf 'Checking Compose configuration, source database and destination volumes...\n'
# Resolve Compose's actual project and volume names without exposing its environment.
mapfile -t compose_names < <(docker compose --profile deploy config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
print(config["name"])
print(config["volumes"]["database"]["name"])
print(config["volumes"]["uploads"]["name"])
')
if [[ ${#compose_names[@]} -ne 3 ]]; then
  printf 'Could not resolve Compose project and volume names.\n' >&2
  exit 1
fi
project=${compose_names[0]}
database_volume=${compose_names[1]}
uploads_volume=${compose_names[2]}

database_container=$(docker compose ps -q db)
if [[ -z "$database_container" ]] || [[ $(docker inspect --format '{{.State.Running}}' "$database_container") != true ]]; then
  printf 'The existing Compose database must be running.\n' >&2
  exit 1
fi
for volume in "$database_volume" "$uploads_volume"; do
  if docker volume inspect "$volume" > /dev/null 2>&1; then
    printf 'Destination volume already exists: %s. Refusing to overwrite it.\n' "$volume" >&2
    exit 1
  fi
done

database_name=$(docker exec "$database_container" printenv POSTGRES_DB)
POSTGRES_PASSWORD=$(docker exec "$database_container" printenv POSTGRES_PASSWORD)
export POSTGRES_PASSWORD
if [[ -z "$database_name" || -z "$POSTGRES_PASSWORD" ]]; then
  printf 'The running database container must define POSTGRES_DB and POSTGRES_PASSWORD.\n' >&2
  exit 1
fi
export MIGRATION_POSTGRES_DB="$database_name"
if ! docker compose config --format json | python3 -c '
import json, os, sys
db = json.load(sys.stdin)["services"]["db"]["environment"]
sys.exit(0 if db.get("POSTGRES_DB") == os.environ["MIGRATION_POSTGRES_DB"] and db.get("POSTGRES_PASSWORD") == os.environ["POSTGRES_PASSWORD"] else 1)
'; then
  printf 'The configured database name or password differs from the running database container.\n' >&2
  exit 1
fi
version=$(docker exec "$database_container" psql -U postgres -d "$database_name" -Atc 'SHOW server_version_num')
if (( version < 160000 || version >= 170000 )); then
  printf 'Expected PostgreSQL 16; source reports version %s.\n' "$version" >&2
  exit 1
fi

backup_root=${SAMVR_MIGRATION_BACKUP_DIR:-"$root/db_backups"}
mkdir -p "$backup_root"
backup=$(mktemp -d "$backup_root/named-volume-migration-XXXXXXXX")
chmod 700 "$backup"
printf 'Project: %s\nDatabase volume: %s\nUploads volume: %s\nUploads source: %s\nBackups: %s\n' \
  "$project" "$database_volume" "$uploads_volume" "$uploads" "$backup"

temporary_db=''
cleanup() {
  if [[ -n "$temporary_db" ]]; then
    docker rm -f "$temporary_db" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

run_with_progress 'Backing up the database' \
  docker exec "$database_container" sh -c 'exec pg_dump -U postgres -d "$POSTGRES_DB" -Fc' > "$backup/database.dump"
run_with_progress 'Archiving uploads (compression can take time for large files)' \
  tar -C "$uploads" -czf "$backup/uploads.tar.gz" .

printf 'Creating destination volumes...\n'
docker volume create --label "com.docker.compose.project=$project" --label com.docker.compose.volume=database "$database_volume" > /dev/null
docker volume create --label "com.docker.compose.project=$project" --label com.docker.compose.volume=uploads "$uploads_volume" > /dev/null

printf 'Starting a temporary PostgreSQL container for the restore...\n'
temporary_db=$(docker run -d --network none -e POSTGRES_PASSWORD -e "POSTGRES_DB=$database_name" \
  --mount "type=volume,src=$database_volume,dst=/var/lib/postgresql/data" postgres:16)
ready=false
printf 'Waiting for the temporary database to be ready (up to 60 seconds)...\n'
for ((i=0; i<60; i++)); do
  if docker exec "$temporary_db" pg_isready -h 127.0.0.1 -U postgres -d "$database_name" > /dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  printf 'The temporary PostgreSQL container did not become ready.\n' >&2
  exit 1
fi
run_with_progress 'Restoring the database into the new volume' \
  docker exec -i "$temporary_db" pg_restore -U postgres -d "$database_name" --exit-on-error --no-owner --no-privileges < "$backup/database.dump"
docker rm -f "$temporary_db" > /dev/null
temporary_db=''

run_with_progress 'Copying uploads and comparing them with the source' \
  docker run --rm --network none --entrypoint sh \
  --mount "type=bind,src=$uploads,dst=/source,readonly" \
  --mount "type=volume,src=$uploads_volume,dst=/destination" postgres:16 \
  -c 'cp -a /source/. /destination/ && diff -qr /source /destination'

printf '\nMigration data prepared. The old database and uploads were not removed.\n'
printf 'Start the new stack with: docker compose --profile deploy up -d --build\n'
printf 'Verify the deployment before discarding the old data or backups.\n'
