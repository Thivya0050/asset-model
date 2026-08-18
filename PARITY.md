# Parity & Decision Log — Asset Model Module

Scannable record of what matches the real Asset Management System, what was
guessed, and what was added on purpose. For non-technical reviewers and future
developers — no codebase reading required.

---

## 1. CONFIRMED FROM REAL SYSTEM

Verified from real screenshots of the existing AMS (Category Types list, Asset
Models list, Customer Assets list / filter form).

### Hierarchy
- **Category Type** → many **Asset Models** → many **Customer Assets**
- **Customer** (master) → many **Customer Assets** (Customer Asset uses a
  Customer dropdown, not free text)

### Category Types (list)
| Item | Status |
|------|--------|
| Name (required, unique) | Confirmed |
| **Code** (short text, unique) — split from real names after data review | Confirmed pattern from real data (see §3) |
| Asset count (rollup of models in the category) | Confirmed |
| Updated On / Updated By | Confirmed |

### Asset Models (list)
| Item | Status |
|------|--------|
| Model Name — single display field encoding Brand + Model No + Spec (e.g. `DIGI SM5300X (P) (30KG)`) | Confirmed (list display) |
| Category (FK to Category Type) | Confirmed |
| Updated On / Updated By | Confirmed |
| List columns: Model Name, Category, Status*, Updated On, Updated By, Actions | Confirmed pattern (*Status is an intentional addition — see §3) |
| Filter panel: Category dropdown + Status dropdown + Filter + Clear (apply on click) | Confirmed pattern |
| Search (model name) | Confirmed |
| Sortable headers, pagination, entry count (“Showing X to Y of Z”) | Confirmed pattern |
| Export: Excel, PDF, Print | Confirmed |
| Bulk selection + bulk actions | Confirmed pattern |
| Add New Model | Confirmed |
| View/Edit + Archive actions | Confirmed pattern |

### Customers (master)
| Item | Status |
|------|--------|
| Customer as a separate master record (dropdown source for Customer Assets) | Confirmed |
| Name (e.g. AEON QUEENSBAY MALL, MEI GROCER) | Confirmed from screenshots |

### Customer Assets (list / filters / fields)
| Item | Status |
|------|--------|
| Serial Number (Asset S/N) | Confirmed |
| Asset Model (FK) | Confirmed |
| Category derived from the model’s category | Confirmed |
| Customer (FK to Customer master — dropdown, not free text) | Confirmed |
| Warranty Expiry Date | Confirmed |
| Stamping Expiry Date | Confirmed |
| **Full filter field parity (7 fields)** — Asset S/N, Category, Model, Customer, Asset Status, Warranty Expiry (From/To), Stamping Expiry (From/To) + Filter/Clear — all present and working | Confirmed |
| Excel / PDF / Print controls | Confirmed |

**Filter layout note:** field *content* matches the real system; *layout* does not (see §3 — intentional 4-column grid vs real full-width stack).

### Navigation
- Real system uses a **left sidebar** with a top-level Dashboard and **collapsible module groups** with nested sub-pages — mirrored here (see §4).

---

## 2. ASSUMPTIONS — NOT YET VERIFIED

Guessed because the real **Add/Edit Asset Model** forms (and some Customer Asset
detail rules) have not been fully verified yet.

| Assumption | Why it was added | Verify by |
|------------|------------------|-----------|
| **Manufacturer** (optional text on Asset Model) | Common on catalogue records; not seen on list screens | Add/Edit Model form |
| **Description** (optional text on Asset Model) | Convenience field; not confirmed | Add/Edit Model form |
| **Default Warranty (months)** on Asset Model | Plausible model-level default for new units | Add/Edit Model form |
| **Default Stamping / Calibration (months)** on Asset Model | Relevant for weighing scales; not confirmed at model level | Add/Edit Model form |
| **Unit Cost** on Asset Model | May belong only in Price List module | Add/Edit Model + Price List |
| **Image / attachment** on Asset Model | Media is common; no real file storage confirmed | Add/Edit Model form |
| **Model Name is one text field** (not Brand / Model No / Spec split) | Matches list display; edit form may still split fields | Add/Edit Model form |
| Duplicate model name in same category → **warn but allow save** | Spec’d for this build; real uniqueness rules unknown | Real validation rules |
| Customer Asset statuses **In Use / In Storage / Retired** | Reasonable lifecycle labels; exact vocabulary unconfirmed | Real Customer Asset form |
| Fake “Updated By” user dropdown (no auth) | ~~Replaced~~ — see §3 Real authentication | — |

---

## 3. INTENTIONAL ADDITIONS — NOT PART OF THE REAL SYSTEM

Deliberate for this standalone build. Confirmed **not** present (or not confirmed)
in the real platform — e.g. real sidebar has **no per-module dashboards**.

| Addition | Why it exists here | When reconciling with real AMS |
|----------|--------------------|--------------------------------|
| **Assets module Dashboard** (`/`) with totals + breakdowns | Standalone overview for demos and managers; real system has **one global Dashboard**, not one per module | Keep, merge into global Dashboard, or remove |
| **Category Name + Code as separate fields** | Real AMS lists categories as a single string like `Weighing Scale (SCL)`. After reviewing all 11 live categories, every record followed `Name (CODE)` with no exceptions — so this build stores **Name** and **Code** separately (list/form columns), and still displays `Name (Code)` in dropdowns/labels for readability. Bulk import accepts either a combined `Name (Code)` string or separate Name/Code columns | Confirm whether real AMS already has a separate Code field or only the combined display string |
| **Active / Archived status** on Asset Models, Categories, and Customers | Soft-retire without breaking references; data safety | Confirm if real AMS has equivalent; map or remove |
| **Never hard-delete** Category Types, Asset Models, or Customers (archive only) | Safe default for audit-friendly demos | Align with real delete/archive policy |
| **“Used by N Customer Assets”** on Asset Model edit | Proves the relationship and warns before archive | Confirm if real edit screen shows usage count |
| Tooltips / required-field helper text / success banners | UX improvements for non-technical users | Keep as UX layer regardless of field parity |
| Mobile card layout for Asset Models (&lt;768px) | Responsive improvement over horizontal table scroll | Optional vs real desktop-first UI |
| **Customer Assets filter layout — responsive 4-column grid** (intentional deviation) | Real system stacks each filter **full-width, one per row** (long vertical scroll to reach all fields + Filter/Clear). This build shows all fields without scrolling. **Not a parity gap / missing layout** — deliberate UX improvement | Keep unless stakeholders prefer exact visual match to the tall stacked form |
| **“Quick search (S/N)”** live-search on Customer Assets | Not in real-system screenshots. Searches by serial like Asset S/N filter, but **live** vs apply-on-click | Review whether redundant with Asset S/N; keep, merge, or remove |
| **Model dropdown narrowed by selected Category** (Customer Assets filters) | Models list filters to the chosen Category. Not confirmed in real screenshots (may or may not exist there) — kept as a usability improvement either way | Confirm real AMS behavior; keep if useful regardless |
| **Real authentication (NextAuth Credentials + JWT)** | Replaces the fake “Updated By” user dropdown. Login required for all pages/APIs; `Updated By` is set from the logged-in user’s name on create/update (Migration Mode still uses file values). Roles: Admin / Manager / Staff / Viewer with UI + API enforcement. Real AMS almost certainly has login too, but we are **not** replicating their auth implementation (unknown) — this is our own Credentials-based stack for the standalone app | Keep; map roles to real AMS roles when known |

---

## 4. NAVIGATION STRUCTURE

Matches the real system’s sidebar pattern (module groups with nested sub-pages).

| Element | Behavior |
|---------|----------|
| **Dashboard** | Standalone top-level item (not nested under a module) |
| **Assets** | Collapsible module group (expanded by default) |
| Sub-items | Categories → Asset Models → **Customers** → Customer Assets |
| Config | Driven by `STANDALONE` + `MODULES` in `src/config/modules.ts` |
| Extending | Add another object to `MODULES` with `id`, `label`, `icon`, `defaultOpen`, `items[]` — sidebar renders it automatically |

Layout: fixed left sidebar (~248px; collapses to icon rail); slim top bar for title / mobile menu only.

---

## 5. VISUAL / TONE DECISIONS

UI was restyled **twice** after the first functional build:

1. **Simplification pass** — Plain language, tooltips, empty states, Cancel buttons, clearer required fields (aimed at non-technical users).
2. **Professional SaaS pass** — Feedback that the first pass felt too casual. Result: muted greys, **single indigo accent**, tighter type, 6px radii, restrained icons (no pastel badge blocks), denser tables, factual copy.

Current target tone: Linear / Stripe Dashboard / Notion — clean and restrained, not playful.

---

## 6. OPEN QUESTIONS — WHEN REAL ACCESS IS GRANTED

Checklist for the next verification session:

- [ ] Screenshot the real **Add/Edit Asset Model** form
- [ ] Confirm whether **Model Name** is a single field or split (Brand / Model No / Spec)
- [ ] Confirm whether **Warranty / Stamping defaults** exist at the Model level
- [ ] Confirm whether **Unit Cost** belongs on Asset Model or only in **Price List**
- [ ] Confirm real **status / archive / delete** behavior for models, categories, and customers
- [ ] Confirm Customer Asset **status vocabulary** exactly matches In Use / In Storage / Retired
- [ ] Decide whether to **keep, relocate, or remove** the per-module Assets Dashboard when reconciling with the real global Dashboard
- [ ] Confirm uniqueness rules for Model Name (global vs per-category)
- [ ] Review **Quick search (S/N)** vs **Asset S/N** filter — keep both, merge, or drop Quick search?
- [ ] Confirm whether real Customer Assets **Model** dropdown already narrows by Category

---

## Changelog (scope corrections)

| When | Change |
|------|--------|
| Initial build | Customer Assets built as a **minimal stub** (free-text customer name) only to prove the Asset Model relationship |
| Customer Assets parity pass | Brought up to match **confirmed** real-system fields: **Customer master + dropdown**, **Warranty Expiry Date**, **Stamping Expiry Date**, full filter panel, list columns, add/edit form. Free-text `customerName` replaced by `customerId` FK; seeded site names migrated into Customer records |
| Customer Assets filter review | Logged **full 7-field filter parity**; intentional **4-column grid** (vs real stacked full-width); **Quick search (S/N)** as intentional addition; **Category→Model** dropdown narrowing as usability improvement |
| Category Name + Code split | After real-data review: all 11 categories were `Name (CODE)`. Added separate `code` field; migrated existing rows; UI list/form show Name and Code separately; dropdowns still show `Name (Code)`; import accepts combined or split columns |
| Real authentication | NextAuth Credentials + JWT; seeded Admin/Manager/Staff/Viewer; removed fake Updated By dropdown; RBAC on UI + API; Migration Mode still preserves historical Updated By/On from files |

---

*Last updated to reflect: real authentication + RBAC; Category Name + Code split; Customer Assets filter-panel review.*
