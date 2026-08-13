# Orders & Settlements

A small full-stack app for tracking orders, recording partial/full payments, and monitoring settlement status. Built as a take-home assignment.

**Live URL:** _add after deploying (see [Deployment](#deployment))_

**Demo login:** `demo@example.com` / `demo1234` — comes pre-seeded with 4 orders across all status types.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router (RSC for reads, REST API for writes) |
| Language | TypeScript (strict) |
| Database | SQLite via Prisma 5.22 |
| Auth | Auth.js v5 — Credentials provider + JWT sessions, `bcryptjs` password hashing |
| UI | Tailwind CSS v4 + minimal in-repo primitives (Button, Input, Dialog, Badge) |
| Validation | Zod on both API routes and forms |
| Testing | Vitest (unit + integration) |
| Deployment | Railway with persistent volume |

---

## Prerequisites

- **Node.js 20+** (uses `node_modules/.bin/tsx`, Next.js 16, Prisma 5)
- **npm 10+** (any package manager works, but scripts assume npm)

Verify:
```bash
node --version   # v20.x
npm --version    # 10.x or 11.x
```

---

## Setup

```bash
# 1. Clone and install
git clone <your-fork-url>
cd crossval
npm install

# 2. Set up env
cp .env.example .env
# .env defaults to SQLite at ./prisma/dev.db and AUTH_URL=http://localhost:3000

# 3. Create DB + apply migrations + seed
npm run db:migrate       # creates prisma/dev.db and applies migrations
npm run db:seed          # seeds demo@example.com / demo1234 with 4 orders

# 4. Run dev server
npm run dev              # http://localhost:3000
```

You should land on `/login`. Sign in with the demo credentials or create a new account at `/signup`.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Runs `prisma generate`, `prisma migrate deploy`, then `next build` |
| `npm run start` | Production server (after build) |
| `npm test` | Run all tests (unit + integration) once |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:migrate` | Prisma migrate dev (creates/applies migrations) |
| `npm run db:deploy` | Prisma migrate deploy (production; no interactive prompts) |
| `npm run db:seed` | Seed demo user + sample orders |
| `npm run db:studio` | Prisma Studio |

---

## API Overview

All endpoints return JSON. Errors use a consistent envelope:

```json
{ "error": { "code": "OVERPAYMENT", "message": "…", "details": { … } } }
```

Every resource is scoped to the authenticated user; requesting another user's order returns `404`, not `403`, so we never leak whether an ID exists.

### Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | `{ email, password }` → creates user (201) |
| `POST` | `/api/auth/callback/credentials` | Auth.js sign-in (form-encoded, includes CSRF) |
| `POST` | `/api/auth/signout` | Sign out |

### Orders

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/orders?status=<pending\|partially_paid\|paid\|overdue>` | Filter optional |
| `POST` | `/api/orders` | Body: `{ customer, dueDate (ISO), notes?, lineItems: [{ description, quantity, unitPriceCents }] }` |
| `GET` | `/api/orders/:id` | Returns order + line items + payments |
| `PATCH` | `/api/orders/:id` | Editability rules apply (see below) |
| `DELETE` | `/api/orders/:id` | `409` if payments exist |

### Payments

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/orders/:id/payments` | List payments for order |
| `POST` | `/api/orders/:id/payments` | Body: `{ amountCents, paidAt, note? }`. Validates against remaining. Returns `409 OVERPAYMENT` with `details.maxAllowedCents` on over-payment |
| `DELETE` | `/api/orders/:id/payments/:paymentId` | Delete a payment |

**Example** — try to over-pay:

```json
{
  "error": {
    "code": "OVERPAYMENT",
    "message": "Payment of $1.00 would exceed order total. Maximum allowed: $0.00.",
    "details": {
      "maxAllowedCents": 0,
      "orderTotalCents": 100000,
      "alreadyPaidCents": 100000,
      "attemptedCents": 100
    }
  }
}
```

**Example** — locked field after payment:

```json
{
  "error": {
    "code": "LOCKED_AFTER_PAYMENT",
    "message": "These fields cannot be modified after a payment has been recorded: lineItems[0].unitPriceCents. Editable fields: customer, notes, line item descriptions.",
    "details": { "lockedFields": ["lineItems[0].unitPriceCents"] }
  }
}
```

---

## Status derivation rules

Status is **always derived, never stored** (per spec). Precedence, highest wins:

1. `paid` — `paidCents >= totalCents`
2. `overdue` — past due date and not fully paid
3. `partially_paid` — `0 < paidCents < totalCents` and not past due
4. `pending` — no payments, not past due

See `src/lib/domain/status.ts` for the pure function and `tests/unit/status.test.ts` for the full precedence table.

### Edge cases

- **Overdue → paid**: an order past its due date that gets fully paid becomes `paid`. "Paid" wins over "overdue" — you can't be overdue if you owe nothing.
- **Partially paid past due**: becomes `overdue`. Overdue is more actionable than partial in the dashboard.
- **Due-date boundary**: `now > dueDate` (strictly greater). If it's exactly the due-date instant, still on-time.
- **Zero-total orders**: `deriveStatus` returns `pending` for these — a `paidCents >= 0` isn't enough to be considered paid. In practice `quantity >= 1` on line items prevents accidental zero-line-item orders; a zero-total order is only possible with all-free line items.
- **Future-dated payments** (`paidAt > now`): allowed. Some AP flows record forward-dated payments (post-dated checks, scheduled ACH).

---

## Editability policy (hybrid)

After a payment exists on an order:

- **Editable**: `customer`, `notes`, line item `description`.
- **Locked**: `dueDate`, line item `quantity`, line item `unitPriceCents`, and adding/removing line items.

Rationale: text edits let you fix typos and update notes without reconciliation risk. Money edits are locked because they'd invalidate the payments already applied. If you truly need to change money after payment, delete the payment first, then edit.

The UI reflects this: money inputs are disabled with a lock banner; the API returns `409 LOCKED_AFTER_PAYMENT` with the offending field list.

**Deleting an order** with existing payments is refused (`409 CONFLICT`) for the same reason — delete payments first.

---

## Concurrency approach

**Race:** Two concurrent `POST /payments` on a $1,000 order that already has $900 paid both read `alreadyPaid = 900`, both validate their $200 payments as within budget, both insert → total = $1,100. Invariant violated.

**How we handle it** (implemented in `src/lib/services/payments.ts`):

1. **Serializable transaction** — `prisma.$transaction(fn, { isolationLevel: 'Serializable' })` wraps the read → validate → insert sequence.
2. **Post-insert re-check** — after inserting, we re-SUM inside the same transaction and throw `OverpaymentError` (rolling back the insert) if the total exceeds the order total. Defense in depth.
3. **Retry-on-busy** — SQLite serializes writes but under contention returns `SQLITE_BUSY` or Prisma-level timeouts. We retry up to 8 times with exponential backoff (30ms base + jitter). Application-level errors (`AppError`) are never retried, so `OverpaymentError` still surfaces immediately.
4. **Wide transaction window** — 15s timeout on the interactive transaction, so even 10 concurrent payments queued behind each other resolve deterministically.

The `tests/integration/payments.service.test.ts > concurrency` test fires 10 × $200 payments at a $1,000 order via `Promise.allSettled` and asserts exactly 5 succeed, 5 fail with over-payment, and the final SUM is exactly $1,000 — no over-pay, no under-count.

**Upgrade path for Postgres:** replace SQLite semantics with `SELECT ... FOR UPDATE` on the `orders` row inside the transaction (or add a materialized `paidCents` column on `orders` with row-locked increment).

---

## Money handling

All monetary amounts are stored as **integer cents** (`Int` in Prisma). No floats in the DB, no float arithmetic in the domain layer.

- `toCents("19.99")` → `1999` (see `src/lib/domain/money.ts`)
- `formatUSD(100000)` → `"$1,000.00"`
- Unit test proves `toCents(0.1 + 0.2) === 30` — the classic float trap is neutralized at the boundary.

The UI accepts dollars-and-cents strings from `<input type="number" step="0.01">` and converts at the client, and again on the server via Zod.

---

## Testing

```bash
npm test                # all tests (unit + integration)
npm run test:watch      # watch mode
```

Coverage:

- **Unit** (`tests/unit/`) — pure domain functions: money, order total, status derivation, payment validation, editability.
- **Integration** (`tests/integration/`) — real Prisma against a fresh SQLite file created per suite via `prisma db push`:
  - `payments.service.test.ts`: sample scenario from spec ($1,000 order → pay $400 → pay $600 → reject $1), concurrency (10 × $200 stress test), cross-tenant isolation.
  - `orders.service.test.ts`: total computation, editability policy (allow text on paid, reject money on paid, allow all on unpaid), delete-refused-when-paid, list filter, cross-tenant isolation on read/update/delete.

Integration tests share a single SQLite file (`prisma/test.db`, rebuilt each run) and are wired via `vi.mock` to inject the test PrismaClient.

**40 tests total.**

---

## Deployment

Chosen host: **Railway** with a mounted volume for the SQLite file. Vercel serverless has an ephemeral filesystem and SQLite doesn't persist across invocations there.

### One-time setup

```bash
# 1. Push your repo to GitHub
git init && git add -A && git commit -m "Initial commit"
git remote add origin git@github.com:you/orders-and-settlements.git
git push -u origin main

# 2. Install Railway CLI
npm i -g @railway/cli
railway login

# 3. Create project and link
railway init         # follow prompts, pick "Empty Project"
railway link         # link to the created project

# 4. Add a Volume
#    Railway dashboard → your service → Settings → Volumes:
#      Mount path: /data
#    (or via CLI: railway volume add --mount /data)

# 5. Set environment variables (via CLI or dashboard)
railway variables --set "DATABASE_URL=file:/data/prod.db"
railway variables --set "AUTH_SECRET=$(openssl rand -base64 32)"
railway variables --set "NODE_ENV=production"

# 6. Deploy
railway up
```

Railway will read `railway.json` and `nixpacks.toml` and use Node 20. On boot, `npx prisma migrate deploy` runs against the mounted volume, so the first deploy creates the DB schema in `/data/prod.db`.

### After the first deploy

```bash
# Get the public URL
railway domain

# Set AUTH_URL to that URL (Auth.js v5 needs it for callbacks)
railway variables --set "AUTH_URL=https://<your-app>.up.railway.app"

# Seed the demo user in prod
railway run npm run db:seed
```

Then log in as `demo@example.com` / `demo1234`.

### If Railway won't work

Swap the DB to **Turso** (SQLite-compatible edge DB) and deploy to Vercel:

```bash
npm i @libsql/client @prisma/adapter-libsql
# Update src/lib/prisma.ts to use the libsql adapter
# Set DATABASE_URL to your Turso URL
```

Left as a documented alternative — I chose Railway for the take-home because it keeps Prisma + SQLite parity with the local dev experience.

---

## Assumptions and tradeoffs

- **SQLite** is fine for this workload. The concurrency test proves the invariant holds under contention. For a real B2B/SaaS product with multi-region writes, swap to Postgres and use `SELECT ... FOR UPDATE`.
- **`totalCents` is cached** on the order row. Denormalized for cheap list queries; recomputed inside the update transaction from line items. If we ever mutate line items via SQL outside the service layer, this could drift.
- **Auth uses JWT sessions** (Auth.js stateless mode). No session table, no DB hit per request. Trade-off: revoking a session before its expiry is not possible without rotating `AUTH_SECRET`. For a real app I'd use rotating refresh tokens.
- **Signup validation is minimal** — email format + password ≥ 8 chars. No email verification, no rate limit, no password strength meter. Fine for the assignment; not for prod.
- **`toCents`** rounds half-away-from-zero via `Math.round`. Acceptable for USD 2dp. For multi-currency you'd store a currency code alongside the amount and pick the right subunit precision.
- **Time is stored as UTC**; the UI renders in the browser's locale via `date-fns` `format(date, "MMM d, yyyy")`. Timezone edge cases around "past due" are within a few hours' fuzziness — acceptable for a due-date semantic.
- **Deleting a payment** rolls back the paid total, which can flip an order from `paid` back to `partially_paid` or even `overdue`. The endpoint exists but isn't exposed in the UI (out of scope).
- **No refunds / audit log / CSV export** — spec stretch goals, not implemented. Would add: separate `Refund` model with negative-signed `amountCents`, an `OrderEvent` audit table populated inside every service transaction, and a `GET /api/orders/export?from=…&to=…` endpoint returning CSV.

---

## What I would improve before production

1. **Postgres** with `SELECT ... FOR UPDATE` on the order row inside the payment transaction. SQLite is fine for this take-home but doesn't scale horizontally.
2. **Audit log** — currently no history of status transitions. An `OrderEvent` table appended inside every write transaction would enable "why did this go from paid → partially_paid" reconstructions.
3. **Rate limiting** on `/api/auth/signup` and `/api/auth/callback/credentials` — trivial with Upstash Redis or a per-IP token bucket.
4. **Email verification** on signup, password reset flow, session revocation.
5. **Optimistic concurrency on order edits** — currently last-write-wins. An `updatedAt` version check in the PATCH would surface concurrent edits.
6. **UI polish** — real design system, richer status filters, sortable columns, pagination, keyboard shortcuts.
7. **Observability** — structured logs, error tracker (Sentry), tracing on the payment transaction (it's the highest-value business logic and deserves span-level visibility).
8. **E2E tests** via Playwright covering the sample scenario through the UI, not just the service layer.

---

## Project layout

```
prisma/
  schema.prisma           — data model
  seed.ts                 — demo user + sample orders
  migrations/             — Prisma-generated SQL

src/
  app/
    (auth)/               — /login, /signup (no auth required)
    (app)/                — /dashboard, /orders/*  (auth-required, shared nav layout)
    api/
      auth/               — Auth.js handlers + /api/auth/signup
      orders/             — REST API for orders + payments
      health/             — health check for Railway
    layout.tsx, page.tsx, providers.tsx

  components/
    ui/                   — Button, Input, Label, Badge, Dialog primitives
    auth/                 — LoginForm, SignupForm, SignOutButton
    orders/               — OrderTable, OrderHeader, OrderForm, LineItemsTable, StatusBadge, StatusFilterBar, DeleteOrderButton
    payments/             — PaymentsTable, RecordPaymentDialog

  lib/
    prisma.ts             — Prisma singleton
    auth/                 — Auth.js config, session helpers, password hashing
    api/errors.ts         — AppError classes + consistent error envelope
    validators/           — Zod schemas for orders + payments
    domain/               — pure functions (money, order-total, status, payment-validation, editability)
    services/             — orders + payments (transactional writes)

tests/
  setup.ts                — test DB bootstrap
  unit/                   — pure domain function tests
  integration/            — Prisma-backed service tests

middleware.ts             — Auth.js route protection
railway.json, nixpacks.toml — deployment config
```
