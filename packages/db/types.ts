export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          restaurant_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      availability: {
        Row: {
          close_time: string
          closes_next_day: boolean
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          open_time: string
          restaurant_id: string
          service_scope: string
          tag_brunch: boolean
          tag_dinner: boolean
          tag_lunch: boolean
          updated_at: string
        }
        Insert: {
          close_time: string
          closes_next_day?: boolean
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          open_time: string
          restaurant_id: string
          service_scope?: string
          tag_brunch?: boolean
          tag_dinner?: boolean
          tag_lunch?: boolean
          updated_at?: string
        }
        Update: {
          close_time?: string
          closes_next_day?: boolean
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          open_time?: string
          restaurant_id?: string
          service_scope?: string
          tag_brunch?: boolean
          tag_dinner?: boolean
          tag_lunch?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_table_id: string | null
          booking_date: string
          booking_time: string
          created_at: string
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          party_size: number
          restaurant_id: string
          status: string
          zone_id: string | null
        }
        Insert: {
          assigned_table_id?: string | null
          booking_date: string
          booking_time: string
          created_at?: string
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          party_size: number
          restaurant_id: string
          status?: string
          zone_id?: string | null
        }
        Update: {
          assigned_table_id?: string | null
          booking_date?: string
          booking_time?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          party_size?: number
          restaurant_id?: string
          status?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_table_id_fkey"
            columns: ["assigned_table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string
          id: string
          locale: string
          pdf_path: string
          restaurant_id: string
          signature_image_path: string | null
          signed_at: string
          signed_ip: unknown
          signed_name: string
          signed_user_agent: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale: string
          pdf_path: string
          restaurant_id: string
          signature_image_path?: string | null
          signed_at: string
          signed_ip: unknown
          signed_name: string
          signed_user_agent?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          pdf_path?: string
          restaurant_id?: string
          signature_image_path?: string | null
          signed_at?: string
          signed_ip?: unknown
          signed_name?: string
          signed_user_agent?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name_en: string | null
          name_nl: string
          restaurant_id: string
          visible_qr: boolean
          visible_takeaway: boolean
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name_en?: string | null
          name_nl: string
          restaurant_id: string
          visible_qr?: boolean
          visible_takeaway?: boolean
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name_en?: string | null
          name_nl?: string
          restaurant_id?: string
          visible_qr?: boolean
          visible_takeaway?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_variants: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name_nl: string
          price_delta_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name_nl: string
          price_delta_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name_nl?: string
          price_delta_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description_en: string | null
          description_nl: string | null
          dietary_tags: string[]
          display_order: number
          id: string
          name_en: string | null
          name_nl: string
          photo_path: string | null
          price_cents: number
          restaurant_id: string
          updated_at: string
          visible_qr: boolean
          visible_takeaway: boolean
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_nl?: string | null
          dietary_tags?: string[]
          display_order?: number
          id?: string
          name_en?: string | null
          name_nl: string
          photo_path?: string | null
          price_cents: number
          restaurant_id: string
          updated_at?: string
          visible_qr?: boolean
          visible_takeaway?: boolean
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description_en?: string | null
          description_nl?: string | null
          dietary_tags?: string[]
          display_order?: number
          id?: string
          name_en?: string | null
          name_nl?: string
          photo_path?: string | null
          price_cents?: number
          restaurant_id?: string
          updated_at?: string
          visible_qr?: boolean
          visible_takeaway?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_source_uploads: {
        Row: {
          channel: Database["public"]["Enums"]["menu_upload_channel"]
          created_at: string
          deleted_at: string | null
          file_size_bytes: number
          id: string
          mime_type: string
          original_filename: string
          restaurant_id: string
          storage_path: string
          upload_type: Database["public"]["Enums"]["menu_upload_type"]
        }
        Insert: {
          channel?: Database["public"]["Enums"]["menu_upload_channel"]
          created_at?: string
          deleted_at?: string | null
          file_size_bytes: number
          id?: string
          mime_type: string
          original_filename: string
          restaurant_id: string
          storage_path: string
          upload_type?: Database["public"]["Enums"]["menu_upload_type"]
        }
        Update: {
          channel?: Database["public"]["Enums"]["menu_upload_channel"]
          created_at?: string
          deleted_at?: string | null
          file_size_bytes?: number
          id?: string
          mime_type?: string
          original_filename?: string
          restaurant_id?: string
          storage_path?: string
          upload_type?: Database["public"]["Enums"]["menu_upload_type"]
        }
        Relationships: [
          {
            foreignKeyName: "menu_source_uploads_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      mollie_webhook_events: {
        Row: {
          event_type: string
          id: string
          mollie_event_id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          event_type: string
          id?: string
          mollie_event_id: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          event_type?: string
          id?: string
          mollie_event_id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          line_total_cents: number
          menu_item_id: string | null
          notes: string | null
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          line_total_cents: number
          menu_item_id?: string | null
          notes?: string | null
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          line_total_cents?: number
          menu_item_id?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string
          commission_cents: number
          created_at: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          item_notes: string | null
          payment_id: string | null
          payment_status: string
          pickup_time: string | null
          restaurant_id: string
          status: string
          table_session_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          channel: string
          commission_cents?: number
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          item_notes?: string | null
          payment_id?: string | null
          payment_status?: string
          pickup_time?: string | null
          restaurant_id: string
          status?: string
          table_session_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          commission_cents?: number
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          item_notes?: string | null
          payment_id?: string | null
          payment_status?: string
          pickup_time?: string | null
          restaurant_id?: string
          status?: string
          table_session_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_table_session"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          kind: Database["public"]["Enums"]["payment_kind"]
          mollie_payment_id: string | null
          mollie_subscription_id: string | null
          paid_at: string | null
          related_payment_id: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_status"]
          subscription_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          kind: Database["public"]["Enums"]["payment_kind"]
          mollie_payment_id?: string | null
          mollie_subscription_id?: string | null
          paid_at?: string | null
          related_payment_id?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["payment_kind"]
          mollie_payment_id?: string | null
          mollie_subscription_id?: string | null
          paid_at?: string | null
          related_payment_id?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_related_payment_id_fkey"
            columns: ["related_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_bookable: boolean
          is_qr_enabled: boolean
          label: string
          qr_image_path: string | null
          qr_token: string | null
          restaurant_id: string
          seats: number
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_bookable?: boolean
          is_qr_enabled?: boolean
          label: string
          qr_image_path?: string | null
          qr_token?: string | null
          restaurant_id: string
          seats: number
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_bookable?: boolean
          is_qr_enabled?: boolean
          label?: string
          qr_image_path?: string | null
          qr_token?: string | null
          restaurant_id?: string
          seats?: number
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          booking_question_allergies: boolean
          booking_question_occasion: boolean
          booking_question_requests: boolean
          booking_window_days: number | null
          confirmation_template_en: string | null
          confirmation_template_nl: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          cuisine_type: string | null
          current_onboarding_step: number
          deleted_at: string | null
          director_name: string | null
          display_name: string | null
          guest_zone_choice_enabled: boolean
          hero_image_url: string | null
          hours_per_service_override: boolean
          id: string
          kitchen_closes_offset_minutes: number | null
          kvk_number: string | null
          kvk_verified_at: string | null
          legal_address_city: string | null
          legal_address_house_letter: string | null
          legal_address_house_number: string | null
          legal_address_house_number_addition: string | null
          legal_address_postcode: string | null
          legal_address_street: string | null
          legal_form: string | null
          legal_name: string | null
          max_guests_per_slot: number | null
          max_party_size: number | null
          menu_built_at: string | null
          menu_cuisine_description: string | null
          menu_design_preferences: string | null
          menu_same_for_both: boolean
          min_lead_time_minutes: number | null
          mollie_initiated_at: string | null
          mollie_organization_id: string | null
          mollie_status: Database["public"]["Enums"]["mollie_status"]
          mollie_verified_at: string | null
          name: string
          noshow_prepaid_amount_cents: number | null
          noshow_prepaid_enabled: boolean
          noshow_reconfirmation_enabled: boolean
          noshow_reminders_email_enabled: boolean
          noshow_reminders_whatsapp_enabled: boolean
          occupancy_duration_by_party: Json | null
          occupancy_duration_minutes: number | null
          qr_auto_accept: boolean
          qr_cards_shipped_at: string | null
          qr_codes_generated_at: string | null
          qr_item_notes_allowed: boolean
          qr_menu_language: string
          qr_plan: Database["public"]["Enums"]["qr_plan"] | null
          qr_widget_accent_color: string
          sbi_code: string | null
          service_delivery_enabled: boolean
          service_qr_enabled: boolean
          service_reservations_enabled: boolean
          service_takeaway_enabled: boolean
          slot_interval_minutes: number | null
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          submitted_at: string | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          takeaway_accepting_orders: boolean
          takeaway_item_notes_allowed: boolean
          takeaway_min_order_cents: number | null
          takeaway_prep_time_minutes: number | null
          takeaway_scheduled_orders_allowed: boolean
          takeaway_slot_interval_minutes: number | null
          trade_name: string | null
          turnover_buffer_minutes: number | null
          updated_at: string
          user_id: string
          waitlist_enabled: boolean
          website: string | null
          went_live_at: string | null
        }
        Insert: {
          booking_question_allergies?: boolean
          booking_question_occasion?: boolean
          booking_question_requests?: boolean
          booking_window_days?: number | null
          confirmation_template_en?: string | null
          confirmation_template_nl?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          cuisine_type?: string | null
          current_onboarding_step?: number
          deleted_at?: string | null
          director_name?: string | null
          display_name?: string | null
          guest_zone_choice_enabled?: boolean
          hero_image_url?: string | null
          hours_per_service_override?: boolean
          id?: string
          kitchen_closes_offset_minutes?: number | null
          kvk_number?: string | null
          kvk_verified_at?: string | null
          legal_address_city?: string | null
          legal_address_house_letter?: string | null
          legal_address_house_number?: string | null
          legal_address_house_number_addition?: string | null
          legal_address_postcode?: string | null
          legal_address_street?: string | null
          legal_form?: string | null
          legal_name?: string | null
          max_guests_per_slot?: number | null
          max_party_size?: number | null
          menu_built_at?: string | null
          menu_cuisine_description?: string | null
          menu_design_preferences?: string | null
          menu_same_for_both?: boolean
          min_lead_time_minutes?: number | null
          mollie_initiated_at?: string | null
          mollie_organization_id?: string | null
          mollie_status?: Database["public"]["Enums"]["mollie_status"]
          mollie_verified_at?: string | null
          name?: string
          noshow_prepaid_amount_cents?: number | null
          noshow_prepaid_enabled?: boolean
          noshow_reconfirmation_enabled?: boolean
          noshow_reminders_email_enabled?: boolean
          noshow_reminders_whatsapp_enabled?: boolean
          occupancy_duration_by_party?: Json | null
          occupancy_duration_minutes?: number | null
          qr_auto_accept?: boolean
          qr_cards_shipped_at?: string | null
          qr_codes_generated_at?: string | null
          qr_item_notes_allowed?: boolean
          qr_menu_language?: string
          qr_plan?: Database["public"]["Enums"]["qr_plan"] | null
          qr_widget_accent_color?: string
          sbi_code?: string | null
          service_delivery_enabled?: boolean
          service_qr_enabled?: boolean
          service_reservations_enabled?: boolean
          service_takeaway_enabled?: boolean
          slot_interval_minutes?: number | null
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          submitted_at?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          takeaway_accepting_orders?: boolean
          takeaway_item_notes_allowed?: boolean
          takeaway_min_order_cents?: number | null
          takeaway_prep_time_minutes?: number | null
          takeaway_scheduled_orders_allowed?: boolean
          takeaway_slot_interval_minutes?: number | null
          trade_name?: string | null
          turnover_buffer_minutes?: number | null
          updated_at?: string
          user_id: string
          waitlist_enabled?: boolean
          website?: string | null
          went_live_at?: string | null
        }
        Update: {
          booking_question_allergies?: boolean
          booking_question_occasion?: boolean
          booking_question_requests?: boolean
          booking_window_days?: number | null
          confirmation_template_en?: string | null
          confirmation_template_nl?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          cuisine_type?: string | null
          current_onboarding_step?: number
          deleted_at?: string | null
          director_name?: string | null
          display_name?: string | null
          guest_zone_choice_enabled?: boolean
          hero_image_url?: string | null
          hours_per_service_override?: boolean
          id?: string
          kitchen_closes_offset_minutes?: number | null
          kvk_number?: string | null
          kvk_verified_at?: string | null
          legal_address_city?: string | null
          legal_address_house_letter?: string | null
          legal_address_house_number?: string | null
          legal_address_house_number_addition?: string | null
          legal_address_postcode?: string | null
          legal_address_street?: string | null
          legal_form?: string | null
          legal_name?: string | null
          max_guests_per_slot?: number | null
          max_party_size?: number | null
          menu_built_at?: string | null
          menu_cuisine_description?: string | null
          menu_design_preferences?: string | null
          menu_same_for_both?: boolean
          min_lead_time_minutes?: number | null
          mollie_initiated_at?: string | null
          mollie_organization_id?: string | null
          mollie_status?: Database["public"]["Enums"]["mollie_status"]
          mollie_verified_at?: string | null
          name?: string
          noshow_prepaid_amount_cents?: number | null
          noshow_prepaid_enabled?: boolean
          noshow_reconfirmation_enabled?: boolean
          noshow_reminders_email_enabled?: boolean
          noshow_reminders_whatsapp_enabled?: boolean
          occupancy_duration_by_party?: Json | null
          occupancy_duration_minutes?: number | null
          qr_auto_accept?: boolean
          qr_cards_shipped_at?: string | null
          qr_codes_generated_at?: string | null
          qr_item_notes_allowed?: boolean
          qr_menu_language?: string
          qr_plan?: Database["public"]["Enums"]["qr_plan"] | null
          qr_widget_accent_color?: string
          sbi_code?: string | null
          service_delivery_enabled?: boolean
          service_qr_enabled?: boolean
          service_reservations_enabled?: boolean
          service_takeaway_enabled?: boolean
          slot_interval_minutes?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          submitted_at?: string | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          takeaway_accepting_orders?: boolean
          takeaway_item_notes_allowed?: boolean
          takeaway_min_order_cents?: number | null
          takeaway_prep_time_minutes?: number | null
          takeaway_scheduled_orders_allowed?: boolean
          takeaway_slot_interval_minutes?: number | null
          trade_name?: string | null
          turnover_buffer_minutes?: number | null
          updated_at?: string
          user_id?: string
          waitlist_enabled?: boolean
          website?: string | null
          went_live_at?: string | null
        }
        Relationships: []
      }
      review_tasks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_to: string | null
          created_at: string
          id: string
          notes: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_tasks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invite_email: string | null
          restaurant_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_email?: string | null
          restaurant_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invite_email?: string | null
          restaurant_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          mollie_customer_id: string | null
          mollie_mandate_id: string | null
          mollie_subscription_id: string | null
          monthly_amount_cents: number
          next_charge_at: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          suspended_at: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mollie_customer_id?: string | null
          mollie_mandate_id?: string | null
          mollie_subscription_id?: string | null
          monthly_amount_cents: number
          next_charge_at?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at: string
          trial_started_at?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          mollie_customer_id?: string | null
          mollie_mandate_id?: string | null
          mollie_subscription_id?: string | null
          monthly_amount_cents?: number
          next_charge_at?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          closed_by_user_id: string | null
          id: string
          opened_at: string
          restaurant_id: string
          table_id: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          id?: string
          opened_at?: string
          restaurant_id: string
          table_id: string
        }
        Update: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          id?: string
          opened_at?: string
          restaurant_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_entries: {
        Row: {
          booking_date: string
          booking_time: string
          converted_booking_id: string | null
          created_at: string
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          notified_at: string | null
          party_size: number
          restaurant_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          converted_booking_id?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          notified_at?: string | null
          party_size: number
          restaurant_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          converted_booking_id?: string | null
          created_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notified_at?: string | null
          party_size?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_converted_booking_id_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          display_order: number
          id: string
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      menu_upload_channel: "takeaway" | "qr" | "both"
      menu_upload_type: "menu" | "photo" | "reference"
      mollie_status:
        | "not_started"
        | "pending"
        | "verified"
        | "rejected"
        | "needs_action"
      payment_kind:
        | "onetime_qr_setup"
        | "onetime_extra_tables"
        | "subscription_charge"
        | "takeaway_commission"
        | "prepaid_booking"
        | "refund"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      qr_plan: "basic" | "premium"
      restaurant_status:
        | "onboarding"
        | "pending_review"
        | "live"
        | "suspended"
        | "cancelled"
      review_status: "pending" | "approved" | "needs_followup" | "cancelled"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
      subscription_tier: "starter" | "plus" | "premium"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      menu_upload_channel: ["takeaway", "qr", "both"],
      menu_upload_type: ["menu", "photo", "reference"],
      mollie_status: [
        "not_started",
        "pending",
        "verified",
        "rejected",
        "needs_action",
      ],
      payment_kind: [
        "onetime_qr_setup",
        "onetime_extra_tables",
        "subscription_charge",
        "takeaway_commission",
        "prepaid_booking",
        "refund",
      ],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      qr_plan: ["basic", "premium"],
      restaurant_status: [
        "onboarding",
        "pending_review",
        "live",
        "suspended",
        "cancelled",
      ],
      review_status: ["pending", "approved", "needs_followup", "cancelled"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      subscription_tier: ["starter", "plus", "premium"],
    },
  },
} as const
