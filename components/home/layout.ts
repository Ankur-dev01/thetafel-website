import type { CSSProperties } from 'react'

/**
 * Figma frame geometry helpers. All homepage coordinates are taken from the
 * 1440px-wide Figma frame (Tafel/Desktop - 3.pdf) and scaled with --k in CSS.
 * Unset values are emitted as `auto`, which makes the dependent calc() invalid
 * so the property falls back to its initial value instead of inheriting a
 * parent's custom property.
 */
export type Box = { x?: number; y?: number; w?: number; h?: number; fs?: number; lh?: number }

const v = (n: number | undefined) => (n === undefined ? 'auto' : n)

/** Stage coordinates (Figma px, scaled by --k). */
export function box(b: Box, extra?: CSSProperties): CSSProperties {
  return {
    '--x': v(b.x),
    '--y': v(b.y),
    '--w': v(b.w),
    '--h': v(b.h),
    '--fs': v(b.fs),
    '--lh': v(b.lh ?? b.fs),
    ...extra,
  } as CSSProperties
}

/** Card-local coordinates (scaled by the card's container width via --u). */
export function cbox(b: Box, extra?: CSSProperties): CSSProperties {
  return {
    '--cx': v(b.x),
    '--cy': v(b.y),
    '--cw': v(b.w),
    '--ch': v(b.h),
    '--cfs': v(b.fs),
    '--clh': v(b.lh ?? b.fs),
    ...extra,
  } as CSSProperties
}

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
