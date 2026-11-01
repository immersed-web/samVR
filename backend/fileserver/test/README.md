# Upload integration tests

Run against an isolated database, auth server and fileserver with a 1 KiB file
limit. The test services do not publish host ports. From the repository root:

```bash
pnpm --filter fileserver exec tsx --test test/upload-limit.test.ts
docker compose -p samvr-upload-regression -f backend/auth/test/docker-compose.yml -f backend/fileserver/test/docker-compose.yml run --build --rm tests
docker compose -p samvr-upload-regression -f backend/auth/test/docker-compose.yml -f backend/fileserver/test/docker-compose.yml down -v
```

Use a dedicated project name: `down -v` deletes the test database and uploads.
