# Asset Model Module

Standalone replica of part of an Asset Management System — focused on **Asset Models**, with supporting Category Types and Customer Assets.

## Stack

- **Next.js** (App Router) + TypeScript — frontend and API in one project
- **Prisma ORM** + **SQLite** — zero DB install; file at `prisma/dev.db`
- **NextAuth.js (Auth.js)** — Credentials provider + JWT sessions
- **Tailwind CSS**

One command starts everything: `npm run dev`.

## Quick start

```bash
cd asset-model
npm install
npx prisma db push
npm run db:seed-users    # login accounts (keeps existing data)
# OR: npm run db:setup   # wipe + sample data + users
npm run dev -- -p 3001
```

Open **http://localhost:3001** — you will be redirected to `/login`.

### Seeded test accounts

Shared password for all: **`Password123!`**

| Role    | Email                 | Password       |
|---------|-----------------------|----------------|
| Admin   | admin@example.com     | Password123!   |
| Manager | manager@example.com   | Password123!   |
| Staff   | staff@example.com     | Password123!   |
| Viewer  | viewer@example.com    | Password123!   |

| Role | Access |
|------|--------|
| **Admin** | Full access including Categories manage + bulk import |
| **Manager** | Create/edit/archive Models, Customers, Customer Assets; Categories view-only |
| **Staff / Viewer** | Read-only (view, filter, search, export) |

Sessions expire after **8 hours**.

### Useful scripts

| Script | What it does |
|--------|----------------|
| `npm run dev` | Start Next.js (API + UI) |
| `npm run db:migrate` / `npx prisma db push` | Apply Prisma schema to SQLite |
| `npm run db:seed` | Load sample data (**wipes** catalogue) + users |
| `npm run db:seed-users` | Upsert the 4 login accounts only |
| `npm run db:setup` | migrate + seed |
| `npm run db:studio` | Optional Prisma Studio GUI |

See **[TESTING.md](./TESTING.md)** before running auth/permission scripts against
`dev.db` — create throwaways, **hard-delete** them in the same session, and
confirm the migrated baseline (11 Categories, 251 Asset Models).

## What’s in the app

| Route | Purpose |
|-------|---------|
| `/login` | Email + password sign-in |
| `/` | Dashboard with counts + quick links |
| `/asset-models` | Full list: filter, search, sort, pagination, export, bulk archive |
| `/asset-models/new` | Add model |
| `/asset-models/[id]/edit` | Edit model + “Used by N Customer Assets” |
| `/category-types` | Category CRUD + assetCount rollup |
| `/customers` | Customer master |
| `/customer-assets` | Customer asset list + filters |

## Schema: CONFIRMED vs ASSUMPTION

See **[PARITY.md](./PARITY.md)** for the full checklist.

**Confirmed (match real AMS intent):**

- CategoryType: `name` + `code`, `assetCount` rollup, `updatedAt`, `updatedBy`
- AssetModel: `name` (Brand+Model+Spec in one field), `categoryTypeId`, `updatedAt`, `updatedBy`
- CustomerAsset: `serialNumber`, `assetModelId`, `categoryTypeId` (derived), Customer FK, audit fields
- Relationship: Category → Models → Customer Assets
- Archive models (Inactive) instead of hard delete

**Assumptions / intentional additions:**

- Manufacturer, description, warranty/stamping defaults, unit cost, image/attachment
- Model status Active/Inactive
- Customer asset lifecycle status + expiry dates
- **Real login** (NextAuth Credentials) — `Updated By` is the logged-in user’s name (not a fake dropdown)
- Duplicate model name within a category warns but still saves

## Swap SQLite → PostgreSQL later

1. In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"
}
```

2. In `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
```

3. Install the Postgres adapter instead of better-sqlite3, e.g. `@prisma/adapter-pg` + `pg`, and update `src/lib/prisma.ts` to use `PrismaPg`.

4. Run:

```bash
npx prisma migrate dev --name postgres_init
```

That’s the intended one-line provider change plus adapter swap when you connect to production infrastructure.

## Notes for non-technical walkthrough

- **Never hard-deletes** Category Types or Asset Models — Archive / Inactive only.
- **Customer Assets** keep working even if their model is archived.
- Seed data includes Weighing Scale, ESL, Refrigeration, and Checkout Counter examples.
