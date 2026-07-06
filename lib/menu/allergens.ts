export const ALLERGEN_CODES = [
  'contains_gluten',
  'contains_dairy',
  'contains_egg',
  'contains_nuts',
  'contains_peanuts',
  'contains_soy',
  'contains_fish',
  'contains_shellfish',
  'contains_sesame',
  'contains_mustard',
  'contains_alcohol',
  'spicy',
] as const

export const DIET_CODES = [
  'vegan',
  'vegetarian',
  'halal',
  'kosher',
  'gluten_free',
] as const

/**
 * Partition a raw `dietary_tags` array into allergen codes (icons) and diet
 * codes (text pills). Unknown tags are silently dropped from both buckets.
 */
export function splitTags(tags: string[]): {
  allergens: string[]
  diet: string[]
} {
  const allergens = tags.filter((t): t is (typeof ALLERGEN_CODES)[number] =>
    (ALLERGEN_CODES as readonly string[]).includes(t)
  )
  const diet = tags.filter((t): t is (typeof DIET_CODES)[number] =>
    (DIET_CODES as readonly string[]).includes(t)
  )
  return { allergens, diet }
}
