# SLA Backend API

Fastify API for the Jira SLA dashboard. Reads ticket data from Supabase PostgreSQL and exposes authenticated REST endpoints under `/v1`.

## Local development

```bash
npm install
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your Supabase credentials
npm run dev
```

- API: http://localhost:4000/v1/health
- Docs: http://localhost:4000/docs

## Deploy on Render (recommended)

This is a long-running Fastify server, so a server host (Render) is the simplest fit.

1. Push this repo to GitHub: https://github.com/assetcues26/slabackenmd
2. Go to https://dashboard.render.com → **New** → **Blueprint**
3. Connect the repo. Render reads `render.yaml` automatically.
4. Set the environment variables (marked `sync: false` so you enter them in the dashboard):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase **pooler** URL (port **6543**) |
| `SUPABASE_URL` | `https://natlhzvunjrmuonusfdi.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_JWT_SECRET` | *(leave empty unless using legacy HS256)* |
| `CORS_ORIGIN` | `https://slafrontend-web.vercel.app,http://localhost:3000` |

5. Deploy. Render runs:
   - Build: `npm install && npm run build`
   - Start: `npm start` → `node dist/server.js`
   - Health check: `/v1/health`
6. Copy the Render URL (e.g. `https://sla-backend-api.onrender.com`) and set on the **frontend** (Vercel):

```
NEXT_PUBLIC_API_BASE_URL=https://sla-backend-api.onrender.com/v1
```

> Render's free tier sleeps after inactivity; the first request after idle may take ~30s to wake.

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/health` | Health check |
| GET | `/v1/stats` | Dashboard statistics |
| GET | `/v1/tickets` | Ticket list (auth required) |
| GET | `/v1/tickets/breaches` | SLA breaches (auth required) |
| GET | `/v1/sla/statuses` | SLA timing config |
| GET | `/docs` | Swagger UI |

## Project layout

```
slabackend/
├── apps/api/          Fastify API
│   ├── src/           Server source (server.ts is the entry)
│   └── migrations/    Database schema
├── packages/shared/   SLA config shared types
└── render.yaml        Render Blueprint
```
