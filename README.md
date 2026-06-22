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

## Deploy on Vercel

1. Import https://github.com/assetcues26/slabackenmd
2. **Root Directory:** `apps/api`
3. Install/build commands are in `apps/api/vercel.json` (runs from monorepo root)
4. Add environment variables (Production + Preview):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase **pooler** URL (port **6543**) — required for serverless |
| `SUPABASE_URL` | `https://natlhzvunjrmuonusfdi.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_JWT_SECRET` | Supabase JWT secret (Settings → API → JWT Secret) |
| `CORS_ORIGIN` | Frontend URL(s), comma-separated e.g. `https://slafrontend-web.vercel.app` |

5. After deploy, copy your Vercel API URL and set on the **frontend** (Vercel):

```
NEXT_PUBLIC_API_BASE_URL=https://your-api.vercel.app/v1
```

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
├── apps/api/          Fastify API + Vercel serverless entry
└── packages/shared/   SLA config shared types
```
