# Filapen Business Hub -- Go-Live Plan

**Date:** 2026-04-08
**Version:** 1.0
**Status:** Draft

---

## 1. Current Project Status

### Tech Stack
- **Monorepo:** npm workspaces + Turborepo
- **Backend:** NestJS 10 (TypeScript) -- `apps/api`
- **Frontend:** Next.js 14 (App Router, TypeScript) -- `apps/web`
- **Database:** PostgreSQL 16 via Prisma ORM + Supabase
- **Auth:** Clerk (`@clerk/nextjs` + `@clerk/backend`)
- **State:** Zustand (client), React Query + tRPC (server state)
- **UI:** Radix UI + Tailwind CSS + ECharts
- **Shared:** `packages/shared` (types, utilities), `packages/database` (Prisma schema)

### Backend Modules (6 domains, 24 services)
| Module | Controllers | Services | Description |
|--------|------------|----------|-------------|
| Finance | 1 (dashboard) | 8 (dashboard, profit-engine, aggregation, attribution, benchmark, cache, cohort, cost, product) | Revenue, ROAS, P&L, attribution, cohort analysis |
| Creator | 1 | 6 (creator, deal, briefing, project, upload, comment) | Creator CRM, deals pipeline, briefings |
| Influencer | 1 | 3 (influencer, brand, watchlist) | Influencer discovery, brand partnerships |
| Content | 1 | 3 (content, brand-voice, template) | AI content generation, templates |
| Admin | 1 | 1 | Organization settings, user management |
| Integration | 2 (shopify-auth, shopify-webhook) | 1 (shopify) | Shopify OAuth + webhooks |

### Frontend Pages (44 pages)
- **Finance Hub:** 14 pages (dashboard, attribution, benchmarks, campaigns, channels, cohorts, costs, creative-analysis, integrations, products, reports, revenue)
- **Creator Hub:** 9 pages (list, deals, projects, briefings, uploads, detail views)
- **Influencer Hub:** 6 pages (discovery, brands, watchlists, detail views)
- **Content Hub:** 5 pages (library, generate, templates, brand-voice)
- **Creator Portal:** 5 pages (public-facing portal for creators)
- **Settings:** 3 pages (general, team)
- **Landing:** 1 page

### Infrastructure in Place
- Helmet (security headers)
- Compression middleware
- CORS (configured but localhost only)
- ValidationPipe with whitelist + transform
- Global API prefix (`/api`)
- Prisma with UUID primary keys and `gen_random_uuid()`
- Multi-tenant schema with `org_id` on all tables
- Auth guard (`apps/api/src/common/guards/auth.guard.ts`)
- Tenant middleware (`apps/api/src/common/middleware/tenant.middleware.ts`)
- Next.js API rewrites (proxies `/api/*` to backend)

---

## 2. What's Missing Before Go-Live

### Critical (Must Fix)

| Item | Current State | Required Action |
|------|--------------|-----------------|
| **Clerk Auth Keys** | Placeholder `sk_test_...` / `pk_test_...` | Create Clerk production instance, get live keys |
| **CORS Origins** | Hardcoded `http://localhost:3000` | Accept array of production domains |
| **Health Check Endpoint** | Missing | Add `/api/health` with DB connectivity check |
| **Global Exception Filter** | Missing | Unhandled exceptions return raw NestJS errors |
| **Request Logging** | Console only, no structure | Add structured logging interceptor (pino is installed but unused) |
| **Database Migrations** | Using `db push` (destructive) | Switch to `prisma migrate deploy` for production |
| **Environment Separation** | Single `.env.example` | Create per-environment config with validation |
| **Rate Limiting** | Not implemented | Add `@nestjs/throttler` to protect API |

### Important (Should Fix for MVP)

| Item | Current State | Required Action |
|------|--------------|-----------------|
| **API Documentation** | Swagger installed but not enabled in `main.ts` | Enable SwaggerModule setup |
| **Redis/Cache** | `ioredis` in deps, cache service exists | Decide: Upstash for prod or remove dependency |
| **File Storage** | Upload service exists, no storage backend | Configure Supabase Storage or S3 |
| **Email** | No email sending configured | Add Resend/SendGrid for notifications |
| **RLS Policies** | Schema references RLS but none enforced at DB level | Implement Supabase RLS or rely on app-level tenant filtering |
| **Webhook Verification** | Shopify webhooks exist, HMAC verification unclear | Verify webhook signatures |
| **CI/CD Pipeline** | No `.github/workflows` directory | Add lint, type-check, test, deploy pipeline |

### Nice to Have (Post-MVP)

| Item | Description |
|------|-------------|
| BullMQ workers | Job queue infrastructure (dep installed, not configured) |
| Scheduled tasks | `@nestjs/schedule` imported but no cron jobs |
| pgvector / TimescaleDB | Schema references them but not required for MVP |
| Error tracking | Sentry integration |
| Analytics | PostHog or Mixpanel |

---

## 3. Recommended Production Architecture

```
                    Internet
                       |
              Cloudflare (DNS + CDN + WAF)
              /                          \
     app.filapen.com              api.filapen.com
             |                           |
        Vercel (Next.js 14)        Railway / Render (NestJS)
             |                           |
             +------ API Rewrites -------+
                                         |
                              Supabase (PostgreSQL)
                              - Connection Pooling (PgBouncer port 6543)
                              - Storage (file uploads)
                              - Realtime (optional)
                                         |
                              Upstash Redis (optional, for cache/rate-limiting)
```

### Why This Architecture

- **Cloudflare in front:** Free tier provides DNS, DDoS protection, SSL termination, and basic WAF. Cache static assets at the edge.
- **Vercel for frontend:** Next.js 14 is first-class on Vercel. SSR, ISR, and Edge Functions work natively. Zero-config deployment from monorepo.
- **Railway/Render for API:** NestJS needs a long-running Node.js process. Railway supports Dockerfile deployments and has a generous free/hobby tier. Render is an alternative.
- **Supabase for DB:** Already using Supabase PostgreSQL. Production project with PgBouncer connection pooling, automatic backups, and optional RLS.
- **Upstash Redis:** Serverless Redis, pay-per-request. Optional for MVP -- the cache service can fail silently.

---

## 4. GitHub Setup

### Repository Structure
```
filapen/                  (monorepo root)
  apps/
    api/                  (NestJS backend)
    web/                  (Next.js frontend)
  packages/
    database/             (Prisma schema + seed)
    shared/               (types, utilities)
  .github/
    workflows/
      ci.yml              (lint, type-check, test)
  docs/
    GO-LIVE-PLAN.md       (this document)
```

### Branch Strategy
```
main          Production deployments (protected)
  |
staging       Preview/staging deployments
  |
feature/*     Feature branches (PR into staging)
fix/*         Bug fix branches (PR into staging or main)
```

### Branch Protection Rules (main)
- Require pull request reviews (1 reviewer minimum)
- Require status checks to pass (CI pipeline)
- Require branches to be up to date before merging
- Do not allow force pushes
- Do not allow deletions

### Branch Protection Rules (staging)
- Require status checks to pass
- Allow direct pushes from maintainers (for rapid iteration)

---

## 5. Vercel Setup

### Option A: Two Vercel Projects (Recommended for MVP)

**Project 1: `filapen-web`**
- Framework: Next.js
- Root Directory: `apps/web`
- Build Command: `cd ../.. && npx turbo build --filter=@filapen/web`
- Output Directory: `apps/web/.next`
- Install Command: `npm ci`
- Node.js Version: 20.x

**Project 2: `filapen-api`** (only if using Vercel for API)
- Framework: Other
- Root Directory: `apps/api`
- Build Command: `cd ../.. && npx turbo build --filter=@filapen/api`

### Option B: Frontend on Vercel, Backend on Railway (Recommended)

**Vercel (frontend only):**
- Same as Project 1 above
- Environment variable `API_URL` points to Railway deployment

**Railway (backend):**
- Deploy from Dockerfile (`apps/api/Dockerfile`)
- Auto-deploy on push to `main`
- Environment variables configured in Railway dashboard

### Environment Variables per Environment

**Vercel Preview (staging):**
```
NEXT_PUBLIC_API_URL=https://api-staging.filapen.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

**Vercel Production:**
```
NEXT_PUBLIC_API_URL=https://api.filapen.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

**Railway (all environments):**
```
DATABASE_URL=postgresql://...?pgbouncer=true
CLERK_SECRET_KEY=sk_live_...
APP_URL=https://app.filapen.com
REDIS_URL=redis://...
NODE_ENV=production
PORT=4000
```

---

## 6. Supabase Setup

### Production Project
1. Create a new Supabase project (separate from development)
2. Region: choose closest to target users (e.g., `us-east-1` for US)
3. Database password: generate strong password, store in password manager

### Connection Pooling
- Use PgBouncer connection string (port 6543) for the API
- Format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Set `?pgbouncer=true&connection_limit=10` in connection string

### Database Migrations
```bash
# Development: use db push for rapid iteration
npm run db:push

# Staging/Production: use prisma migrate
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

Create initial migration from current schema:
```bash
npx prisma migrate dev --name init --schema=packages/database/prisma/schema.prisma
```

### Row Level Security (RLS)
Current state: Schema has `org_id` on all tables but RLS is not enforced at DB level. The application uses middleware-level tenant filtering.

**Recommendation for MVP:** Keep app-level tenant filtering. Add RLS as a post-MVP hardening step:
```sql
-- Example RLS policy (post-MVP)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

### Backups
- Supabase Pro plan includes daily backups with 7-day retention
- Enable Point-in-Time Recovery (PITR) for production
- Test restore procedure before go-live

---

## 7. Cloudflare Setup

### DNS Records
```
Type    Name              Value                         Proxy
A/CNAME app.filapen.com   cname.vercel-dns.com          Proxied (orange cloud)
A/CNAME api.filapen.com   [railway-domain].up.railway.app  Proxied
```

### SSL/TLS
- Encryption mode: **Full (Strict)**
- Always Use HTTPS: Enabled
- Minimum TLS Version: 1.2
- Automatic HTTPS Rewrites: Enabled

### Page Rules
1. `api.filapen.com/*` -- Cache Level: Bypass (API responses should not be cached)
2. `app.filapen.com/_next/static/*` -- Cache Level: Cache Everything, Edge Cache TTL: 1 month

### WAF Rules
- Enable Cloudflare Managed Ruleset (free tier)
- Rate limit: 100 requests per minute per IP on `/api/*`
- Block known bad bots

### Cache Rules
- Cache static assets (`.js`, `.css`, `.png`, `.woff2`) for 30 days
- Do not cache HTML pages (Next.js handles its own caching via ISR)
- Do not cache API responses

---

## 8. Environment Separation

```
Environment   Frontend              API                    Database              Auth
-----------   --------              ---                    --------              ----
Local         localhost:3000        localhost:4000         localhost:5432        Clerk test keys
Staging       preview.filapen.com   api-staging...         Supabase staging      Clerk test keys
Production    app.filapen.com       api.filapen.com        Supabase production   Clerk live keys
```

### Environment Variable Files
```
.env.example              Template with all variables (committed)
.env.production.example   Production template with descriptions (committed)
.env                      Local development (gitignored)
.env.local                Local overrides (gitignored)
.env.production           Production values (gitignored, never committed)
```

---

## 9. API Readiness Checklist

- [ ] Health check endpoint (`GET /api/health`) returns DB status
- [ ] Global exception filter catches all unhandled errors
- [ ] Request logging interceptor records method, path, duration
- [ ] CORS configured with production domain whitelist
- [ ] Rate limiting enabled (100 req/min per IP)
- [ ] Helmet security headers verified
- [ ] Swagger documentation enabled at `/api/docs`
- [ ] All endpoints return consistent error format `{ statusCode, message, timestamp, path }`
- [ ] Database connection uses PgBouncer pooling
- [ ] Prisma logging set to `warn` + `error` only in production
- [ ] Graceful shutdown handles SIGTERM
- [ ] API prefix `/api` applied globally
- [ ] ValidationPipe whitelist prevents mass assignment

---

## 10. Frontend Readiness Checklist

- [ ] Clerk authentication wraps all dashboard routes
- [ ] Environment variables use `NEXT_PUBLIC_` prefix for client-side values
- [ ] API URL configured via environment variable (not hardcoded)
- [ ] Error boundaries on all page routes
- [ ] Loading states on all data-fetching pages
- [ ] `next.config.mjs` rewrites point to production API URL
- [ ] Meta tags and OpenGraph configured for public pages
- [ ] Favicon and app icons added
- [ ] 404 and 500 error pages created
- [ ] Bundle size analyzed (no unnecessary large dependencies)
- [ ] Images optimized with `next/image`
- [ ] Fonts loaded via `next/font` (already using Inter)

---

## 11. Security Checklist

- [ ] No secrets in source code or git history
- [ ] `.env` files in `.gitignore`
- [ ] Clerk webhook verification for auth events
- [ ] Shopify webhook HMAC verification
- [ ] CSRF protection (Clerk handles for auth routes)
- [ ] SQL injection prevented (Prisma parameterized queries)
- [ ] XSS prevented (React auto-escaping + Helmet CSP)
- [ ] File upload validation (type, size limits)
- [ ] API rate limiting enabled
- [ ] CORS restricted to known domains
- [ ] Dependency audit clean (`npm audit`)
- [ ] No `eval()` or `Function()` in codebase
- [ ] Encryption key for credentials stored in environment, not code

---

## 12. CI/CD Checklist

- [ ] GitHub Actions CI pipeline runs on push to main/staging and PRs
- [ ] Pipeline runs: install, prisma generate, type-check, lint
- [ ] Vercel auto-deploys frontend on push to main
- [ ] Railway/Render auto-deploys API on push to main
- [ ] Preview deployments for PRs (Vercel built-in)
- [ ] Database migrations run before API deployment
- [ ] Rollback procedure documented
- [ ] Environment variables set in deployment platforms (not in CI)

---

## 13. Priority Implementation Steps

### Phase 1: Production Readiness (Week 1)
1. **Add health check endpoint** -- `/api/health` with DB connectivity check
2. **Add global exception filter** -- Consistent error responses
3. **Add logging interceptor** -- Request/response timing
4. **Update CORS** -- Accept production domains from environment
5. **Create CI pipeline** -- GitHub Actions for lint + type-check
6. **Create Dockerfile** -- For Railway/Render deployment
7. **Create `.env.production.example`** -- Document all required variables
8. **Update `.gitignore`** -- Ensure no secrets or build artifacts leak

### Phase 2: Infrastructure Setup (Week 2)
1. **Create Supabase production project** -- New project, connection pooling enabled
2. **Create initial Prisma migration** -- `prisma migrate dev --name init`
3. **Set up Clerk production instance** -- Get live API keys
4. **Set up Vercel project** -- Connect GitHub repo, configure build settings
5. **Set up Railway project** -- Connect GitHub repo, add Dockerfile
6. **Configure Cloudflare DNS** -- Point domains to Vercel + Railway
7. **Set environment variables** -- In Vercel, Railway, and Supabase dashboards

### Phase 3: Hardening (Week 3)
1. **Add rate limiting** -- `@nestjs/throttler` with sensible defaults
2. **Enable Swagger** -- API documentation at `/api/docs`
3. **Add error boundaries** -- React error boundaries on all pages
4. **Add 404/500 pages** -- Custom error pages in Next.js
5. **Run security audit** -- `npm audit`, dependency review
6. **Load testing** -- Basic load test against staging
7. **Monitoring setup** -- Vercel Analytics, Railway metrics

### Phase 4: Go-Live (Week 4)
1. **Final staging verification** -- Full manual test pass
2. **DNS cutover** -- Point production domains via Cloudflare
3. **SSL verification** -- Confirm Full Strict mode works
4. **Smoke test production** -- Verify health endpoint, auth flow, core features
5. **Enable Cloudflare WAF** -- Turn on managed rules
6. **Announce launch** -- Internal or external as appropriate

---

## Appendix: File Inventory

### Implementation Files Created
| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline |
| `apps/api/src/health.controller.ts` | Health check endpoint |
| `apps/api/src/common/filters/http-exception.filter.ts` | Global exception filter |
| `apps/api/src/common/interceptors/logging.interceptor.ts` | Request logging |
| `apps/api/Dockerfile` | Production container image |
| `apps/web/vercel.json` | Vercel frontend config |
| `.env.production.example` | Production environment template |
| `.gitignore` (updated) | Additional ignore patterns |
