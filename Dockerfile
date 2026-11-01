FROM node:24-trixie-slim AS workspace
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip make g++ git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter './packages/**' -r build

FROM workspace AS frontend-build
ARG EXPOSED_SERVER_URL
ARG EXPOSED_PROJECT_NAME
ARG EXPOSED_APP_NAME
ARG EXPOSED_AUTH_PATH
ARG EXPOSED_MEDIASOUP_PATH
ARG EXPOSED_FILESERVER_PATH
ARG EXPOSED_MAX_UPLOAD_BYTES
ENV EXPOSED_LOCAL=false
RUN pnpm --filter app build

FROM workspace AS backend
CMD ["pnpm", "--filter", "auth", "exec", "tsx", "src/index.ts"]

FROM caddy:2 AS frontend
COPY --from=frontend-build /app/app/dist /srv
COPY Caddyfile.docker /etc/caddy/Caddyfile
COPY Caddyfile.log-filter /etc/caddy/Caddyfile.log-filter
