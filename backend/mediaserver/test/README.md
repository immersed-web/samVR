# VR-space authorization integration tests

These tests use the isolated auth test database and start a mediaserver without
publishing any host ports. From the repository root:

```bash
docker compose -p samvr-vr-regression -f backend/auth/test/docker-compose.yml -f backend/mediaserver/test/docker-compose.yml run --build --rm tests
docker compose -p samvr-vr-regression -f backend/auth/test/docker-compose.yml -f backend/mediaserver/test/docker-compose.yml run --rm tests node --test /app/backend/mediaserver/test/permission-removal.test.mjs
docker compose -p samvr-vr-regression -f backend/auth/test/docker-compose.yml -f backend/mediaserver/test/docker-compose.yml run --rm tests node --test /app/backend/mediaserver/test/resource-access.test.mjs
docker compose -p samvr-vr-regression -f backend/auth/test/docker-compose.yml -f backend/mediaserver/test/docker-compose.yml down -v
```

Use a dedicated Compose project name: `down -v` deletes the project's test
database volume.
