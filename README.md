# Riaya Web

Riaya is an AI-powered healthcare appointment platform. Patients can find doctors, book visits, and manage care; doctors get a dashboard for patients, appointments, and applications; admins oversee the platform.

This repository is the Next.js web app: the public site, authenticated dashboards, API routes, and the PostgreSQL data layer. Voice/phone booking lives in a separate `voice` service and talks to this app over HTTP and websockets.

## Stack

- **Next.js** (App Router) + React + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Better Auth** for sessions
- **Drizzle ORM** + PostgreSQL
- **Redis** (queues / cache)
- **pnpm** for packages
- **Biome** for lint and format

## Local development

Infrastructure (Postgres and Redis) runs in Docker. The web app itself runs on the host — do not use Docker for the Next.js app locally.

### 1. Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io)
- Docker

### 2. Environment

```bash
cp .env.example .env
```

Fill in the values. At minimum you need `DATABASE_URL`, `POSTGRES_*`, and the auth secrets.

### 3. Create the Docker network

`docker-compose.infra.yml` expects an existing `riaya_network`. Create it once:

```bash
docker network create riaya_network
```

### 4. Start Postgres and Redis

```bash
make dev/infra-up
```

This uses `docker-compose.infra.yml` and publishes Postgres (`127.0.0.1:5432`) and Redis (`127.0.0.1:6379`) to the host.

Stop them with:

```bash
make dev/infra-down
```

Logs:

```bash
make dev/infra-logs
```

### 5. Install and run the app

```bash
pnpm install
pnpm db:push          # apply schema
pnpm db:seed          # optional seed data
pnpm dev
```

The app is at [http://localhost:3000](http://localhost:3000) (or the `PORT` in `.env`).

### Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm db:push` | Push Drizzle schema (dev) |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm generate:api` | Regenerate OpenAPI + Orval client |
| `pnpm tsc` | Typecheck |
| `pnpm fix:all` | Lint + format |

## Deployment

Production splits **infrastructure** and **the web app**. They are started separately.

### Infrastructure (manual)

Postgres and Redis are **not** started by CI. Create the shared Docker network once on the server (required by both infra and the web container):

```bash
docker network create riaya_network
```

Then bring Postgres and Redis up (and leave them running) with `docker-compose.infra.prod.yml`:

```bash
make prod/infra-up
```

That compose file joins `riaya_network` and does **not** publish database ports to the host.

Stop / inspect:

```bash
make prod/infra-down
make prod/infra-logs
```

Schema changes on the server:

```bash
make prod/migrate
```

### Web app (GitHub Actions)

Pushes to `main` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Configure these repository secrets first (Settings → Secrets and variables → Actions):

**SSH access** (used to copy files and run compose on the server):

| Secret | Purpose |
| --- | --- |
| `SERVER_HOST` | Server hostname or IP |
| `SERVER_PORT` | SSH port |
| `SERVER_USERNAME` | SSH user |
| `SERVER_SSH_KEY` | Private SSH key |

**Production environment:**

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_ENV_FILE` | Full contents of the production `.env` written onto the server |

Then the workflow:

1. Build the production image and push it to GHCR.
2. Copy `docker-compose.yml` (and migration files) to the server.
3. Run Drizzle migrations.
4. Pull the new image and start the app with:

```bash
docker compose -f docker-compose.yml up -d
```

The web container (`riaya_web`) attaches to the same `riaya_network` so it can reach Postgres and Redis. You do not need to run `make web-up` on the server for a normal deploy — the workflow does that.

Manual start/stop of the web container (if needed):

```bash
make web-up
make web-down
```
