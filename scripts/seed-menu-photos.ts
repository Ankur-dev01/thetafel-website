/**
 * One-off demo seeding script — populates photo_path for Karan's test
 * restaurant's menu items so we can sanity-check the two-column card layout
 * with real photos before starting C5.5.
 *
 * NOT the real photo upload flow (that's a Phase 3 dashboard feature).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-menu-photos.ts
 *   (or: npm run seed:menu-photos)
 */

import { createClient } from '@supabase/supabase-js'

const RESTAURANT_ID = '288b0437-81da-4089-98e4-d89227a98004'
const BUCKET = 'menu-photos'
const MIN_BYTES = 5000
const FETCH_TIMEOUT_MS = 15000
const DELAY_BETWEEN_ITEMS_MS = 200

type SeedItem = {
  nameNl: string
  query: string
  fallbackCategory: string
}

const seedItems: SeedItem[] = [
  { nameNl: 'Burrata met tomaat', query: 'burrata,italian', fallbackCategory: 'pasta' },
  { nameNl: 'Bruschetta met knoflook', query: 'bruschetta,italian-food', fallbackCategory: 'pasta' },
  { nameNl: 'Carpaccio van rundvlees', query: 'beef-carpaccio', fallbackCategory: 'burger' },
  { nameNl: 'Gebakken calamari', query: 'fried-calamari,seafood', fallbackCategory: 'pasta' },
  { nameNl: 'Ossobuco met risotto', query: 'ossobuco,risotto,italian', fallbackCategory: 'pasta' },
  { nameNl: 'Zeebaars in zoutkorst', query: 'sea-bass,fish-dish', fallbackCategory: 'pasta' },
  { nameNl: 'Truffelrisotto', query: 'truffle-risotto', fallbackCategory: 'pasta' },
  { nameNl: 'Arrabbiata pasta', query: 'arrabbiata,pasta,italian', fallbackCategory: 'pasta' },
  { nameNl: 'Tiramisu', query: 'tiramisu,italian-dessert', fallbackCategory: 'dessert' },
  { nameNl: 'Panna cotta met bosvruchten', query: 'panna-cotta,berries', fallbackCategory: 'dessert' },
  { nameNl: 'Sorbet van seizoensfruit', query: 'sorbet,fruit-dessert', fallbackCategory: 'dessert' },
  { nameNl: 'Chocolade fondant', query: 'chocolate-fondant,dessert', fallbackCategory: 'dessert' },
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { redirect: 'follow', signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function tryUnsplash(query: string): Promise<Buffer | null> {
  try {
    const url = `https://source.unsplash.com/featured/800x800/?${query}`
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength < MIN_BYTES) return null
    return buffer
  } catch {
    return null
  }
}

async function tryFoodish(category: string): Promise<Buffer | null> {
  try {
    const jsonRes = await fetchWithTimeout(
      `https://foodish-api.com/api/images/${category}`,
      FETCH_TIMEOUT_MS
    )
    if (!jsonRes.ok) return null
    const json = (await jsonRes.json()) as { image?: string }
    if (!json.image) return null

    const imgRes = await fetchWithTimeout(json.image, FETCH_TIMEOUT_MS)
    if (!imgRes.ok) return null
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    if (buffer.byteLength < MIN_BYTES) return null
    return buffer
  } catch {
    return null
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
  const serviceKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY

  if (!url) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_PROD_URL in the environment.')
    console.error('Run via: node --env-file=.env.local scripts/seed-menu-photos.ts')
    process.exit(1)
  }
  if (!serviceKey) {
    console.error('Missing SUPABASE_PROD_SERVICE_ROLE_KEY in the environment.')
    console.error('Run via: node --env-file=.env.local scripts/seed-menu-photos.ts')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  let succeeded = 0
  let skipped = 0

  for (const item of seedItems) {
    console.log(`Seeding: ${item.nameNl}`)
    const slug = slugify(item.nameNl)

    let buffer = await tryUnsplash(item.query)
    if (!buffer) {
      console.warn(`  Unsplash failed for "${item.nameNl}" — trying Foodish (${item.fallbackCategory})`)
      buffer = await tryFoodish(item.fallbackCategory)
    }

    if (!buffer) {
      console.warn(`  → skipped: no image source succeeded for "${item.nameNl}"`)
      skipped++
      await sleep(DELAY_BETWEEN_ITEMS_MS)
      continue
    }

    try {
      const path = `demo/${slug}.jpg`

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        })

      if (uploadError) {
        console.warn(`  → skipped: upload failed for "${item.nameNl}": ${uploadError.message}`)
        skipped++
        await sleep(DELAY_BETWEEN_ITEMS_MS)
        continue
      }

      const { error: updateError } = await admin
        .from('menu_items')
        .update({ photo_path: path })
        .eq('restaurant_id', RESTAURANT_ID)
        .eq('name_nl', item.nameNl)

      if (updateError) {
        console.warn(`  → skipped: DB update failed for "${item.nameNl}": ${updateError.message}`)
        skipped++
        await sleep(DELAY_BETWEEN_ITEMS_MS)
        continue
      }

      console.log(`  → uploaded ${buffer.byteLength} bytes → photo_path = ${path}`)
      succeeded++
    } catch (err) {
      console.warn(`  → skipped: unexpected error for "${item.nameNl}":`, err)
      skipped++
    }

    await sleep(DELAY_BETWEEN_ITEMS_MS)
  }

  console.log(`\nSeeded ${succeeded} of ${seedItems.length} items successfully. ${skipped} skipped.`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
