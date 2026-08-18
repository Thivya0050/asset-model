# Testing against the dev database

Permission tests, smoke tests, and similar scripts often create temporary
rows in `prisma/dev.db`. The app’s normal UI/API **archives** (soft-delete)
instead of hard-deleting — so a “cleanup” that only calls `DELETE` on an API
route still leaves `AUTH-TEST-*` / `AUTH-TEMP-*` rows in the database and
inflates catalogue counts.

## Baseline (migrated catalogue)

After cleanup, expect at least:

| Entity | Expected total |
|--------|----------------|
| Categories | **11** |
| Asset Models | **251** |

Customers / Customer Assets depend on what was migrated into this copy of
`dev.db`; do not invent extra rows and leave them behind.

## Required cleanup rule

Any test that **creates** records against the shared dev database **MUST**:

1. Prefer a throwaway row created for that assertion only.
2. **Hard-delete** that row in the same session (use Prisma
   `delete` / `deleteMany`, not the app’s Archive/`DELETE` API).
3. Confirm counts return to the expected baseline before reporting the test
   as complete (e.g. 251 Asset Models, 11 Categories, and zero names/serials
   starting with `AUTH-TEST-`, `AUTH-TEMP-`, or `Temp … Cat`).

If a test fails mid-run, re-run cleanup before considering the environment
healthy. Helper: `npx tsx scripts/cleanup-test-artifacts.ts` (removes known
AUTH/TEMP patterns only).

## Naming convention for throwaways

Prefix temporary data so it is easy to find and remove:

- Asset Models: `AUTH-TEST-<role>-<timestamp>`
- Customers: `AUTH-TEMP-<timestamp>` / `AUTH-TEST Customer <timestamp>`
- Customer Assets: `AUTH-TEMP-SN-<timestamp>` / `AUTH-TEST-SN-<timestamp>`
- Categories: `Temp <Role> Cat` with codes like `TADM` (avoid colliding with
  real category codes)

Do **not** archive real migrated rows as a side effect of permission tests.
