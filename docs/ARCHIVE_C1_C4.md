# Archive — C.1 through C.4 onboarding work

> This document is a historical record. The code described here is preserved at the git tag `archive/c4-final` and (after D0.5.1 runs) in the `_legacy_c1_c4/` folder at the repo root. The active onboarding build from D0 forward is a clean rebuild against a wiped Supabase schema.

## What was built in C.1–C.4

The previous onboarding effort delivered the first version of a 6-step wizard for restaurant owners, shipped to production, and was then superseded when the product scope expanded to include Takeaway and QR ordering. The new onboarding (Phase D0 onwards) is a service-conditional 14-step wizard rebuilt from scratch against a new schema and a new UI shell.

The high-level pieces that existed at the end of C.4:

- **Auth (Phase B, carried over):** magic-link signup, password setup, login, forgot-password — all using the `token_hash` + `verifyOtp` SSR pattern with branded Resend HTML email templates, custom SMTP wired through Supabase.
- **Onboarding shell (C.1):** two-pane layout with sidebar at `components/onboarding/StepLayout.tsx` and `ProgressBar.tsx`, autosaving draft pattern via `lib/restaurants/draft.ts`.
- **Step pages (C.2–C.4):** `app/[locale]/onboarding/page.tsx` (entry), `app/[locale]/onboarding/step/2/page.tsx`, `app/[locale]/onboarding/step/3/page.tsx`.
- **KVK lookup (C.2):** `app/api/kvk/search/route.ts` and `app/api/kvk/profile/route.ts` — typeahead Zoeken + Basisprofiel, Upstash-cached, with SBI code 56 filtering server-side.
- **PDOK address lookup (C.3):** `app/api/pdok/lookup/route.ts` — postcode + house number → street/city autofill.
- **Photo upload (C.3):** `app/api/v1/restaurants/photo/route.ts` writing to the `restaurant-assets` Supabase Storage bucket.
- **Draft autosave route (C.2–C.4):** `app/api/v1/restaurants/draft/route.ts` — debounced PUT, ~10-field whitelist.
- **Initial Supabase schema:** the original 7-table schema for restaurants, hours, photos, etc., now to be dropped in D0.2.

## Where the prompts live

All Claude Code prompts from C.1 through C.4 sit in the `prompts/` folder at the repo root, named by phase and sub-step (e.g. `c2_3_kvk_lookup_route_prompt.md`). They are kept for reference and are not deleted.

## What is being reused vs. thrown away

| Survivor (ported in D0.6) | Status |
|---|---|
| `/api/kvk/search` | Ported unchanged |
| `/api/kvk/profile` | Ported unchanged |
| `/api/pdok/lookup` | Ported unchanged |
| `/api/v1/restaurants/photo` | Ported, column verified against new schema |
| `/api/v1/restaurants/draft` | **Full rewrite** — whitelist grows from ~10 fields to ~80 |

| Thrown away (moved to `_legacy_c1_c4/` in D0.5.1) | Reason |
|---|---|
| `app/[locale]/onboarding/page.tsx` (old) | Replaced by new service-picker page |
| `app/[locale]/onboarding/step/2/page.tsx` | Replaced by service-conditional step pages |
| `app/[locale]/onboarding/step/3/page.tsx` | Same |
| `components/onboarding/StepLayout.tsx` | Replaced by `OnboardingShell` + `StepFrame` |
| `components/onboarding/ProgressBar.tsx` | Replaced by new shell progress bar |
| `lib/restaurants/draft.ts` | Replaced by `lib/onboarding/useDraftSave.ts` + new server validators |
| Original Supabase tables (7 tables) | Dropped in D0.2; replaced by new schema in D0.3 |

## How to recover from the archive tag

If at any point during the D-phase rebuild we need to inspect, copy, or restore a file from the C.1–C.4 state:

```powershell
# Show what changed between archive and current main
git diff archive/c4-final main -- <path>

# View a file as it existed at the archive tag
git show archive/c4-final:<path>

# Restore a single file to its C.4 state (does NOT touch the tag)
git checkout archive/c4-final -- <path>

# Compare two files
git show archive/c4-final:lib/restaurants/draft.ts > /tmp/c4-draft.ts
diff /tmp/c4-draft.ts app/api/v1/restaurants/draft/route.ts
```

The tag is annotated and pushed to `origin`, so it is recoverable from anywhere with repo access.

## What this archive does NOT include

- The marketing site (Phase A) — that lives on `main` and continues to evolve independently.
- The auth system (Phase B) — also lives on `main`, not archived because it is still the active auth and has not been touched by the D-phase rebuild.
- Anything in `supabase/migrations/` after the archive tag — those represent the D-phase rebuild and are part of the live history, not the archive.

## Tag metadata

- **Tag name:** `archive/c4-final`
- **Type:** annotated, signed by author
- **Created during:** D0.1.1
- **Documented in:** this file (D0.1.2)
- **Reference in build plan:** Section 2, D0.1
