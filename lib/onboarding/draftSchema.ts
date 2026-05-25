import { z } from 'zod'

// ---- Enum schemas -----------------------------------------------------------

const mollieStatusSchema = z.enum([
  'not_started',
  'pending',
  'verified',
  'rejected',
  'needs_action',
])

const qrPlanSchema = z.enum(['basic', 'premium'])

const subscriptionTierSchema = z.enum(['starter', 'plus', 'premium'])

const qrMenuLanguageSchema = z.enum(['nl', 'en', 'nl_en'])

const serviceScopeSchema = z.enum(['all', 'reservations', 'takeaway', 'qr'])

const menuUploadChannelSchema = z.enum(['takeaway', 'qr', 'both'])

const menuUploadTypeSchema = z.enum(['menu', 'photo', 'reference'])

// ---- Common helpers ---------------------------------------------------------

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-character hex colour like #d4820a')

const time24 = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM in 24-hour time')

const nonEmpty = z.string().min(1).max(2000)

const uuid = z.string().uuid()

// ---- Restaurant fields (PATCHable subset of the restaurants table) ----------

export const restaurantPatchSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).optional(),

    // service selection (Step 0)
    service_reservations_enabled: z.boolean().optional(),
    service_takeaway_enabled: z.boolean().optional(),
    service_qr_enabled: z.boolean().optional(),
    service_delivery_enabled: z.boolean().optional(),

    // onboarding progress
    current_onboarding_step: z.number().int().min(0).max(20).optional(),

    // KVK (Step 1)
    kvk_number: z
      .string()
      .regex(/^\d{8}$/, 'KVK number must be exactly 8 digits')
      .optional(),
    legal_name: z.string().max(300).optional(),
    trade_name: z.string().max(300).optional(),
    display_name: z.string().max(300).optional(),
    legal_form: z.string().max(100).optional(),
    sbi_code: z.string().max(20).optional(),
    legal_address_street: z.string().max(200).optional(),
    legal_address_house_number: z.string().max(20).optional(),
    legal_address_house_letter: z.string().max(10).optional(),
    legal_address_house_number_addition: z.string().max(20).optional(),
    legal_address_postcode: z
      .string()
      .regex(/^\d{4}\s?[A-Za-z]{2}$/, 'Postcode must look like 1011AC')
      .optional(),
    legal_address_city: z.string().max(100).optional(),
    director_name: z.string().max(200).optional(),

    // public contact (Step 1)
    contact_email: z.string().email().max(300).optional(),
    contact_phone: z.string().max(50).optional(),
    website: z.string().url().max(500).optional(),
    cuisine_type: z.string().max(100).optional(),
    hero_image_url: z.string().max(500).optional(),

    // floor plan (Step 2)
    occupancy_duration_minutes: z.number().int().min(15).max(600).optional(),
    occupancy_duration_by_party: z
      .record(z.string(), z.number().int().positive())
      .optional(),
    turnover_buffer_minutes: z.number().int().min(0).max(120).optional(),

    // hours (Step 3)
    slot_interval_minutes: z.number().int().min(5).max(120).optional(),
    kitchen_closes_offset_minutes: z.number().int().min(0).max(240).optional(),
    hours_per_service_override: z.boolean().optional(),

    // booking rules (Step 4)
    min_lead_time_minutes: z.number().int().min(0).max(43200).optional(),
    max_party_size: z.number().int().min(2).max(100).nullable().optional(),
    booking_window_days: z.number().int().min(1).max(365).optional(),
    max_guests_per_slot: z
      .number()
      .int()
      .min(2)
      .max(500)
      .nullable()
      .optional(),
    waitlist_enabled: z.boolean().optional(),
    guest_zone_choice_enabled: z.boolean().optional(),

    // no-show protection (Step 5)
    noshow_reminders_email_enabled: z.boolean().optional(),
    noshow_reminders_whatsapp_enabled: z.boolean().optional(),
    noshow_reconfirmation_enabled: z.boolean().optional(),
    noshow_prepaid_enabled: z.boolean().optional(),
    noshow_prepaid_amount_cents: z
      .number()
      .int()
      .positive()
      .max(50000)
      .nullable()
      .optional(),

    // guest experience (Step 6)
    confirmation_template_nl: z.string().max(5000).optional(),
    confirmation_template_en: z.string().max(5000).optional(),
    booking_question_allergies: z.boolean().optional(),
    booking_question_occasion: z.boolean().optional(),
    booking_question_requests: z.boolean().optional(),

    // takeaway settings (Step 7)
    takeaway_prep_time_minutes: z.number().int().min(5).max(180).optional(),
    takeaway_min_order_cents: z.number().int().min(0).max(50000).optional(),
    takeaway_slot_interval_minutes: z
      .number()
      .int()
      .min(5)
      .max(60)
      .optional(),
    takeaway_accepting_orders: z.boolean().optional(),
    takeaway_item_notes_allowed: z.boolean().optional(),
    takeaway_scheduled_orders_allowed: z.boolean().optional(),

    // menu (Step 8)
    menu_same_for_both: z.boolean().optional(),
    menu_cuisine_description: z.string().max(2000).optional(),
    menu_design_preferences: z.string().max(2000).optional(),

    // QR setup (Step 9)
    qr_plan: qrPlanSchema.nullable().optional(),
    qr_auto_accept: z.boolean().optional(),
    qr_item_notes_allowed: z.boolean().optional(),
    qr_menu_language: qrMenuLanguageSchema.optional(),
    qr_widget_accent_color: hexColor.optional(),

    // subscription (Step 12)
    subscription_tier: subscriptionTierSchema.nullable().optional(),
  })
  .strict()

export type RestaurantPatch = z.infer<typeof restaurantPatchSchema>

// ---- Zones (Step 2) ---------------------------------------------------------

export const zoneSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().min(1).max(100),
    display_order: z.number().int().min(0).max(1000).default(0),
    color: hexColor.default('#d4820a'),
  })
  .strict()

export type ZoneInput = z.infer<typeof zoneSchema>

// ---- Tables (Step 2) --------------------------------------------------------

export const tableSchema = z
  .object({
    id: uuid.optional(),
    zone_id: uuid,
    label: z.string().min(1).max(50),
    seats: z.number().int().min(1).max(30),
    is_bookable: z.boolean().default(true),
    is_qr_enabled: z.boolean().default(true),
  })
  .strict()

export type TableInput = z.infer<typeof tableSchema>

// ---- Availability (Step 3) --------------------------------------------------

export const availabilitySchema = z
  .object({
    id: uuid.optional(),
    day_of_week: z.number().int().min(1).max(7),
    service_scope: serviceScopeSchema.default('all'),
    open_time: time24,
    close_time: time24,
    closes_next_day: z.boolean().default(false),
    is_active: z.boolean().default(true),
    tag_brunch: z.boolean().default(false),
    tag_lunch: z.boolean().default(false),
    tag_dinner: z.boolean().default(false),
  })
  .strict()

export type AvailabilityInput = z.infer<typeof availabilitySchema>

// ---- Menu source uploads (Step 8) ------------------------------------------

export const menuUploadSchema = z
  .object({
    id: uuid.optional(),
    channel: menuUploadChannelSchema.default('both'),
    upload_type: menuUploadTypeSchema.default('menu'),
    storage_path: nonEmpty,
    original_filename: nonEmpty,
    file_size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
    mime_type: z.string().min(1).max(100),
  })
  .strict()

export type MenuUploadInput = z.infer<typeof menuUploadSchema>

// ---- Top-level PATCH body ---------------------------------------------------

export const draftPatchBodySchema = z
  .object({
    restaurant: restaurantPatchSchema.optional(),
    zones: z.array(zoneSchema).max(50).optional(),
    tables: z.array(tableSchema).max(500).optional(),
    availability: z.array(availabilitySchema).max(100).optional(),
    menu_uploads: z.array(menuUploadSchema).max(20).optional(),
  })
  .strict()

export type DraftPatchBody = z.infer<typeof draftPatchBodySchema>
