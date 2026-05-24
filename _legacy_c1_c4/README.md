# Legacy C.1–C.4 onboarding

This folder contains the previous version of the restaurant owner onboarding flow, built during phases C.1 through C.4 and superseded by the Phase D rebuild. **The code in here is no longer compiled, no longer linted, and no longer routed to.** It is kept in version control as a reference while the new onboarding (D1 onward) is built.

## Why it's still here

When sub-steps in Phases D1, D3, D4, etc. build the equivalent screens against the new schema, it's often useful to be able to glance at how the same logical thing was solved in the previous version (form layout, validation, draft-save patterns, etc.). Once Phase D9 is complete and the new onboarding has run end-to-end with real test users, this folder will be deleted.

## What's in here

- `app/[locale]/onboarding/page.tsx` — old service-picker / entry page
- `app/[locale]/onboarding/step/2/page.tsx` — old step 2 (basic info)
- `app/[locale]/onboarding/step/3/page.tsx` — old step 3 (location)
- `components/onboarding/StepLayout.tsx` — old two-pane layout
- `components/onboarding/ProgressBar.tsx` — old progress bar
- `lib/restaurants/draft.ts` — old draft autosave helper

Some of these paths may be empty if a particular file was already absent at archive time — that's fine.

## Survivors (ported, not archived)

These C.1–C.4 routes were preserved in place in the active source tree because they still work against the new schema and only needed light touch-ups in Phase D0.6:

- `app/api/kvk/search/route.ts`
- `app/api/kvk/profile/route.ts`
- `app/api/pdok/lookup/route.ts`
- `app/api/v1/restaurants/photo/route.ts`
- `app/api/v1/restaurants/draft/route.ts` — being **rewritten** in D0.6.5, not preserved as-is

## How this folder is excluded from the build

- `tsconfig.json` has `"_legacy_c1_c4"` in its `exclude` array, so the TypeScript compiler skips it.
- `.eslintignore` lists `_legacy_c1_c4/`, so ESLint skips it.
- The folder is at the repo root (not under `app/`), so Next.js does not route to it.

## Recovering an individual file from earlier history

For the state of any file at the end of C.4:

```
git show archive/c4-final:path/to/file.tsx
```

The archive tag was created in D0.1.1.

## Lifecycle

- **Created:** D0.5.1
- **Will be deleted:** end of Phase D9, once the new onboarding has shipped end-to-end.
