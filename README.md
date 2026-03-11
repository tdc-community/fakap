# fakap RP Platform

Dockerized monorepo scaffold for a FiveM roleplay vehicle platform.

## Workspace layout

- `apps/frontend` - React 19 + Vite + TypeScript
- `apps/backend` - NestJS + TypeScript (module skeleton)
- `packages/shared-types` - shared TypeScript contracts

## Prerequisites

- Docker + Docker Compose

## Quick start

1. Create environment file:

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` in `.env` to match how you access backend APIs:

- Direct backend in dev: `http://localhost:3000`
- Via Traefik API router: `https://fakaperformance.com/api`

2. Build and run:

```bash
docker compose up --build
```

3. Open:

- App via Traefik: http://localhost
- Traefik dashboard (local host only): http://localhost:8080
- Direct frontend (dev): http://localhost:5173
- Direct backend health: http://localhost:3000/health

Security note:

- Traefik dashboard is bound to localhost only in `docker-compose.yml` and should not be publicly exposed.

## External Deposit Ingestion API

Deposit policy:

- Deposits are **API-only** via `POST /api/deposit`.
- End users do **not** have a `/wallet/deposit` GUI/API action.
- Withdrawals are initiated from the authenticated app UI via `/wallet/withdraw`.

## OAuth callback security

- Discord callback now redirects with a short-lived one-time `authCode` only.
- Frontend exchanges `authCode` via `POST <VITE_API_BASE_URL>/auth/exchange-code` to obtain tokens.
- Access/refresh tokens are no longer transported in URL query parameters.

Endpoint:

- `POST /api/deposit`

Auth:

- Provide shared secret from `DEPOSIT_API_KEY` via either:
  - `X-API-Key: <secret>`
  - `Authorization: Bearer <secret>`

Payload:

```json
{
  "walletCode": "FP-1234567",
  "amount": 500.00,
  "deposit_id": "dep_20260307_001"
}
```

Rules:

- `amount` must be positive and max 2 decimals.
- `deposit_id` is strictly idempotent.
  - same `deposit_id` + same payload => non-duplicating success (`idempotent: true`)
  - same `deposit_id` + different payload => `409` and failed transaction log entry

Sample curl:

```bash
curl -X POST http://localhost/api/deposit \
  -H "Content-Type: application/json" \
  -H "X-API-Key: replace_me_deposit_secret" \
  -d '{"walletCode":"FP-1234567","amount":500,"deposit_id":"dep_001"}'
```

Success response example:

```json
{
  "status": "accepted",
  "idempotent": false,
  "walletCode": "FP-1234567",
  "amount": 500,
  "depositId": "dep_001",
  "newBalance": "1500.00"
}
```

Wallet transaction visibility:

- `GET /wallet/transactions` includes both successful and failed events, newest first.
- Deposits are logged with `direction='receive'`, `kind='deposit'`, `hash=deposit_id`.

## Notes

- This is the initial scaffold.
- Domain modules (`auth`, `wallet`, `auctions`, `contests`, etc.) are included as skeleton modules for Phase 1 implementation.

## Repository setup and Git workflow

### One-time setup

```bash
git clone git@github.com:tdc-community/fakap.git
cd fakap
cp .env.example .env
```

### Install dependencies

```bash
npm install
```

### Recommended default branch

Use `main` as the primary branch:

```bash
git branch -M main
```

### Day-to-day Git workflow basics

1. Sync your base branch:

```bash
git checkout main
git pull --rebase origin main
```

2. Create a feature branch:

```bash
git checkout -b feat/<short-description>
```

3. Make changes and verify before commit:

```bash
npm run build
npm run test
```

4. Stage intentionally and commit with a clear message:

```bash
git add <files>
git commit -m "feat(scope): short, imperative summary"
```

5. Push and open a pull request:

```bash
git push -u origin feat/<short-description>
```

### What should never be committed

- Real secret files (`.env`, `.env.*` except `.env.example`)
- Local dependency/build artifacts (`node_modules`, `dist`, `coverage`, caches)
- Local TLS/runtime state files (for example `letsencrypt/acme.json`)
