const TAFEL_AMBER = '#d4820a'
const DEFAULT_SECONDARY = '#7a7264'
const DEFAULT_HEADLINE_FONT = 'var(--font-raleway), Raleway, sans-serif'

export type ResolvedBrand = {
  primaryHex: string
  secondaryHex: string
  headlineFontFamily: string
  logoUrl: string | null
  menuTextureUrl: string | null
}

/**
 * Resolve brand tokens with the Phase 2 Premium override → Phase 1 basic
 * accent → Tafel amber fallback chain.
 */
export function resolveBrandTokens(restaurant: {
  brand_primary_hex: string | null
  brand_secondary_hex: string | null
  brand_display_font_family: string | null
  brand_logo_url: string | null
  brand_menu_texture_url: string | null
  qr_widget_accent_color: string | null
}): ResolvedBrand {
  const primaryHex =
    restaurant.brand_primary_hex ||
    restaurant.qr_widget_accent_color ||
    TAFEL_AMBER

  return {
    primaryHex,
    secondaryHex: restaurant.brand_secondary_hex || DEFAULT_SECONDARY,
    headlineFontFamily:
      restaurant.brand_display_font_family || DEFAULT_HEADLINE_FONT,
    logoUrl: restaurant.brand_logo_url,
    menuTextureUrl: restaurant.brand_menu_texture_url,
  }
}
