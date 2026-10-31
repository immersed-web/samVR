# Auth integration tests

These tests exercise the account-update endpoint against a disposable PostgreSQL
database and auth server. They use fixed test-only credentials, and do not expose
the services on host ports.

From the repository root:

```bash
docker compose -p samvr-auth-regression -f backend/auth/test/docker-compose.yml run --build --rm tests
docker compose -p samvr-auth-regression -f backend/auth/test/docker-compose.yml down -v
```

Use a dedicated Compose project name: `down -v` deletes that project's test
database volume.
