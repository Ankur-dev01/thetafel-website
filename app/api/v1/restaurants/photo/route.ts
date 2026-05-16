// app/api/v1/restaurants/photo/route.ts
//
// Server-side photo upload for onboarding Step 3.
//
// The browser sends the chosen image file to this route as multipart
// form data. The route:
//   1. Authenticates the user (standard SSR Supabase client).
//   2. Finds the user's draft restaurant row.
//   3. Validates the file (type must be jpeg/webp, size <= 5MB).
//   4. Uploads it to the `restaurant-assets` storage bucket at the path
//      `{restaurantId}/hero.{ext}` using the service-role admin client.
//   5. Writes the resulting public URL to restaurants.hero_image_url.
//
// Why a server route (not a direct browser upload):
//   - storage.objects has RLS enabled with no policies, so a direct
//     browser upload would be denied. Rather than open up storage RLS,
//     we upload server-side with the service-role key, which is the
//     same "sensitive operations server-side" pattern used elsewhere.
//   - The bucket is public-READ (restaurant photos are meant to be seen)
//     but WRITES are gated behind this authenticated route.
//
// Request:  POST  multipart/form-data   field "file" = the image
// Response: 200  { ok: true, url: "https://...hero.jpg" }
//           400  no file / invalid type / too large / no restaurant row
//           401  not authenticated
//           500  upload or database error

import { NextRequest, NextResponse } from 'next/server'
import {
  createSupabaseServerClient,
  createSupabaseServerClientAdmin,
} from '@/lib/supabase/server'

const BUCKET = 'restaurant-assets'
const MAX_BYTES = 5 * 1024 * 1024 // 5MB — matches the bucket's limit

// Allowed image types and the file extension we store each as.
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Not authenticated.' },
        { status: 401 }
      )
    }

    // 2. Find the user's draft restaurant row
    const { data: restaurant, error: lookupError } = await supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (lookupError) {
      console.error('photo route lookup error:', lookupError)
      return NextResponse.json(
        { ok: false, error: 'Could not load your restaurant.' },
        { status: 500 }
      )
    }

    if (!restaurant) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Complete the earlier steps before uploading a photo.',
        },
        { status: 400 }
      )
    }

    // 3. Read and validate the uploaded file
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid upload.' },
        { status: 400 }
      )
    }

    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'No file provided.' },
        { status: 400 }
      )
    }

    const ext = ALLOWED[file.type]
    if (!ext) {
      return NextResponse.json(
        { ok: false, error: 'File must be a JPEG or WebP image.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Image must be 5MB or smaller.' },
        { status: 400 }
      )
    }

    // 4. Upload to storage using the service-role admin client
    const admin = await createSupabaseServerClientAdmin()
    const objectPath = `${restaurant.id}/hero.${ext}`

    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(objectPath, arrayBuffer, {
        contentType: file.type,
        upsert: true, // re-uploading overwrites the previous hero image
      })

    if (uploadError) {
      console.error('photo route upload error:', uploadError)
      return NextResponse.json(
        { ok: false, error: 'Upload failed. Please try again.' },
        { status: 500 }
      )
    }

    // 5. Resolve the public URL and save it on the restaurant row
    const { data: publicUrlData } = admin.storage
      .from(BUCKET)
      .getPublicUrl(objectPath)

    let publicUrl = publicUrlData.publicUrl
    // Cache-bust so a re-upload visibly refreshes (same path, new content).
    publicUrl = `${publicUrl}?v=${Date.now()}`

    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ hero_image_url: publicUrl })
      .eq('id', restaurant.id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('photo route db update error:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Could not save the photo.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, url: publicUrl }, { status: 200 })
  } catch (err) {
    console.error('photo route unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
