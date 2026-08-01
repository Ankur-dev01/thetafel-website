// lib/dashboard/menu/dietaryTags.ts
//
// Re-exports the consumer menu's real dietary_tags taxonomy for dashboard
// use. The D4.1 plan assumed a separate 14-EU-allergen `allergens` column;
// that column exists but is entirely unpopulated on live data. The actual,
// already-used vocabulary lives in the single `dietary_tags` array and is
// split by lib/menu/allergens.ts's splitTags() — reused here rather than
// duplicated, so the dashboard renders exactly what guests already see.

export { ALLERGEN_CODES, DIET_CODES, splitTags } from '@/lib/menu/allergens'
