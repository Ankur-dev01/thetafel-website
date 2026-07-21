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
      availability_exceptions: {
        Row: {
          close_time: string | null
          closed: boolean
          created_at: string
          exception_date: string
          id: string
          note: string | null
          open_time: string | null
          restaurant_id: string
          service_scope: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          closed?: boolean
          created_at?: string
          exception_date: string
          id?: string
          note?: string | null
          open_time?: string | null
          restaurant_id: string
          service_scope?: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          closed?: boolean
          created_at?: string
          exception_date?: string
          id?: string
          note?: string | null
          open_time?: string | null
          restaurant_id?: string
          service_scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tables: {
        Row: {
          booking_id: string
          created_at: string
          table_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          table_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_tables_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tables_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          attended_at: string | null
          attended_marked_by: string | null
          booking_ref: string
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          deposit_amount_cents: number | null
          deposit_currency: string
          deposit_intent_id: string | null
          duration_minutes: number
          guest_id: string
          guest_note: string | null
          id: string
          idempotency_key: string | null
          magic_link_token_hash: string
          party_size: number
          refund_intent_id: string | null
          restaurant_id: string
          slot_time: string
          source: Database["public"]["Enums"]["booking_source"]
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          attended_at?: string | null
          attended_marked_by?: string | null
          booking_ref: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_currency?: string
          deposit_intent_id?: string | null
          duration_minutes: number
          guest_id: string
          guest_note?: string | null
          id?: string
          idempotency_key?: string | null
          magic_link_token_hash: string
          party_size: number
          refund_intent_id?: string | null
          restaurant_id: string
          slot_time: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          attended_at?: string | null
          attended_marked_by?: string | null
          booking_ref?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_currency?: string
          deposit_intent_id?: string | null
          duration_minutes?: number
          guest_id?: string
          guest_note?: string | null
          id?: string
          idempotency_key?: string | null
          magic_link_token_hash?: string
          party_size?: number
          refund_intent_id?: string | null
          restaurant_id?: string
          slot_time?: string
          source?: Database["public"]["Enums"]["booking_source"]
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_attended_marked_by_fkey"
            columns: ["attended_marked_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_deposit_intent_fkey"
            columns: ["deposit_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_refund_intent_fkey"
            columns: ["refund_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
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
      consumer_audit_logs: {
        Row: {
          actor_id: string | null
          actor_type: string
          booking_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          ip_address: unknown
          order_id: string | null
          payment_intent_id: string | null
          restaurant_id: string
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type: string
          booking_id?: string | null
          created_at?: string
          event_data: Json
          event_type: string
          id?: string
          ip_address?: unknown
          order_id?: string | null
          payment_intent_id?: string | null
          restaurant_id: string
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          booking_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          ip_address?: unknown
          order_id?: string | null
          payment_intent_id?: string | null
          restaurant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumer_audit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumer_audit_logs_payment_intent_id_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          authority_confirmed: boolean
          created_at: string
          document_hash: string | null
          dpa_version_accepted: string | null
          id: string
          locale_signed: string
          restaurant_id: string
          signature_image_path: string | null
          signed_at: string
          signed_ip: unknown
          signed_name: string
          signed_user_agent: string | null
          terms_version_accepted: string | null
          updated_at: string
          version: string
        }
        Insert: {
          authority_confirmed?: boolean
          created_at?: string
          document_hash?: string | null
          dpa_version_accepted?: string | null
          id?: string
          locale_signed?: string
          restaurant_id: string
          signature_image_path?: string | null
          signed_at: string
          signed_ip: unknown
          signed_name: string
          signed_user_agent?: string | null
          terms_version_accepted?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          authority_confirmed?: boolean
          created_at?: string
          document_hash?: string | null
          dpa_version_accepted?: string | null
          id?: string
          locale_signed?: string
          restaurant_id?: string
          signature_image_path?: string | null
          signed_at?: string
          signed_ip?: unknown
          signed_name?: string
          signed_user_agent?: string | null
          terms_version_accepted?: string | null
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
      dashboard_audit_logs: {
        Row: {
          booking_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          ip_address: unknown
          order_id: string | null
          payment_intent_id: string | null
          restaurant_id: string
          staff_id: string | null
          tab_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          ip_address?: unknown
          order_id?: string | null
          payment_intent_id?: string | null
          restaurant_id: string
          staff_id?: string | null
          tab_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          ip_address?: unknown
          order_id?: string | null
          payment_intent_id?: string | null
          restaurant_id?: string
          staff_id?: string | null
          tab_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_audit_logs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_pii_columns: {
        Row: {
          anonymise_strategy: string
          category: string
          column_name: string
          notes: string | null
          table_name: string
        }
        Insert: {
          anonymise_strategy: string
          category: string
          column_name: string
          notes?: string | null
          table_name: string
        }
        Update: {
          anonymise_strategy?: string
          category?: string
          column_name?: string
          notes?: string | null
          table_name?: string
        }
        Relationships: []
      }
      guest_notes: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          note: string
          restaurant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          note: string
          restaurant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          note?: string
          restaurant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_notes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          anonymised_at: string | null
          created_at: string
          email: string
          email_lower: string | null
          full_name: string
          id: string
          loyalty_points: number
          loyalty_tier: string
          marketing_consent: boolean
          marketing_consent_at: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          anonymised_at?: string | null
          created_at?: string
          email: string
          email_lower?: string | null
          full_name: string
          id?: string
          loyalty_points?: number
          loyalty_tier?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          anonymised_at?: string | null
          created_at?: string
          email?: string
          email_lower?: string | null
          full_name?: string
          id?: string
          loyalty_points?: number
          loyalty_tier?: string
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      magic_links: {
        Row: {
          booking_id: string | null
          consume_count: number
          consumed_at: string | null
          created_at: string
          expires_at: string
          guest_id: string | null
          id: string
          last_used_ip: unknown
          locale: string | null
          order_id: string | null
          purpose: Database["public"]["Enums"]["magic_link_purpose"]
          token_hash: string
        }
        Insert: {
          booking_id?: string | null
          consume_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          guest_id?: string | null
          id?: string
          last_used_ip?: unknown
          locale?: string | null
          order_id?: string | null
          purpose: Database["public"]["Enums"]["magic_link_purpose"]
          token_hash: string
        }
        Update: {
          booking_id?: string | null
          consume_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          guest_id?: string | null
          id?: string
          last_used_ip?: unknown
          locale?: string | null
          order_id?: string | null
          purpose?: Database["public"]["Enums"]["magic_link_purpose"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_links_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          window_end: string | null
          window_start: string | null
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
          window_end?: string | null
          window_start?: string | null
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
          window_end?: string | null
          window_start?: string | null
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
          allergens: string[]
          available: boolean
          category_id: string | null
          created_at: string
          currency: string
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
          vat_rate_bp: number
          visible_qr: boolean
          visible_takeaway: boolean
        }
        Insert: {
          allergens?: string[]
          available?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
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
          vat_rate_bp?: number
          visible_qr?: boolean
          visible_takeaway?: boolean
        }
        Update: {
          allergens?: string[]
          available?: boolean
          category_id?: string | null
          created_at?: string
          currency?: string
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
          vat_rate_bp?: number
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
          currency: string
          id: string
          item_notes: string | null
          line_total_cents: number
          menu_item_id: string | null
          modifiers: Json | null
          name_snapshot: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          item_notes?: string | null
          line_total_cents: number
          menu_item_id?: string | null
          modifiers?: Json | null
          name_snapshot: string
          order_id: string
          quantity: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          item_notes?: string | null
          line_total_cents?: number
          menu_item_id?: string | null
          modifiers?: Json | null
          name_snapshot?: string
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
          cancelled_by_staff: string | null
          created_at: string
          currency: string
          guest_company_name: string | null
          guest_id: string | null
          guest_note: string | null
          id: string
          idempotency_key: string | null
          magic_link_token_hash: string
          order_ref: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_intent_id: string | null
          payment_status: string
          pickup_time: string | null
          ready_notified_at: string | null
          refund_intent_id: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tab_id: string | null
          table_id: string | null
          total_cents: number
          updated_at: string
          vat_cents: number
        }
        Insert: {
          cancelled_by_staff?: string | null
          created_at?: string
          currency?: string
          guest_company_name?: string | null
          guest_id?: string | null
          guest_note?: string | null
          id?: string
          idempotency_key?: string | null
          magic_link_token_hash: string
          order_ref: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_intent_id?: string | null
          payment_status?: string
          pickup_time?: string | null
          ready_notified_at?: string | null
          refund_intent_id?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tab_id?: string | null
          table_id?: string | null
          total_cents: number
          updated_at?: string
          vat_cents?: number
        }
        Update: {
          cancelled_by_staff?: string | null
          created_at?: string
          currency?: string
          guest_company_name?: string | null
          guest_id?: string | null
          guest_note?: string | null
          id?: string
          idempotency_key?: string | null
          magic_link_token_hash?: string
          order_ref?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_intent_id?: string | null
          payment_status?: string
          pickup_time?: string | null
          ready_notified_at?: string | null
          refund_intent_id?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tab_id?: string | null
          table_id?: string | null
          total_cents?: number
          updated_at?: string
          vat_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_cancelled_by_staff_fkey"
            columns: ["cancelled_by_staff"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_intent_fkey"
            columns: ["payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_refund_intent_fkey"
            columns: ["refund_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          currency: string
          failed_at: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          paid_at: string | null
          provider: string
          provider_mandate_id: string | null
          provider_payment_id: string | null
          purpose: Database["public"]["Enums"]["payment_intent_purpose"]
          refunded_amount_cents: number
          refunded_at: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["payment_intent_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          paid_at?: string | null
          provider?: string
          provider_mandate_id?: string | null
          provider_payment_id?: string | null
          purpose: Database["public"]["Enums"]["payment_intent_purpose"]
          refunded_amount_cents?: number
          refunded_at?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          paid_at?: string | null
          provider?: string
          provider_mandate_id?: string | null
          provider_payment_id?: string | null
          purpose?: Database["public"]["Enums"]["payment_intent_purpose"]
          refunded_amount_cents?: number
          refunded_at?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_restaurant_id_fkey"
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
          vat_rate_bps: number
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
          vat_rate_bps?: number
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
          vat_rate_bps?: number
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
      restaurant_staff: {
        Row: {
          created_at: string
          deactivated_at: string | null
          display_name: string
          id: string
          invited_by: string | null
          language: string
          last_active_at: string | null
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          display_name: string
          id?: string
          invited_by?: string | null
          language?: string
          last_active_at?: string | null
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          display_name?: string
          id?: string
          invited_by?: string | null
          language?: string
          last_active_at?: string | null
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
          brand_display_font_family: string | null
          brand_logo_url: string | null
          brand_menu_texture_url: string | null
          brand_primary_hex: string | null
          brand_secondary_hex: string | null
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
          grace_period_started_at: string | null
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
          marketplace_priority: number
          marketplace_visible: boolean
          max_guests_per_slot: number | null
          max_party_size: number | null
          max_party_size_online: number
          menu_built_at: string | null
          menu_cuisine_description: string | null
          menu_design_preferences: string | null
          menu_same_for_both: boolean
          min_lead_time_minutes: number | null
          mollie_access_token: string | null
          mollie_initiated_at: string | null
          mollie_organization_id: string | null
          mollie_refresh_token: string | null
          mollie_status: Database["public"]["Enums"]["mollie_status"]
          mollie_token_expires_at: string | null
          mollie_verified_at: string | null
          name: string
          neighbourhood: string | null
          noshow_prepaid_amount_cents: number | null
          noshow_prepaid_currency: string
          noshow_prepaid_enabled: boolean
          noshow_prepaid_threshold: number | null
          noshow_prepaid_window: Json | null
          noshow_reconfirmation_enabled: boolean
          noshow_reminders_email_enabled: boolean
          noshow_reminders_whatsapp_enabled: boolean
          occupancy_duration_by_party: Json | null
          occupancy_duration_minutes: number | null
          pause_reason: string | null
          paused_at: string | null
          paused_by: string | null
          phone_public: string | null
          photo_url: string | null
          qr_auto_accept: boolean
          qr_cards_shipped_at: string | null
          qr_codes_generated_at: string | null
          qr_item_notes_allowed: boolean
          qr_item_notes_enabled: boolean
          qr_menu_language: string
          qr_pay_at_table_enabled: boolean
          qr_pay_now_enabled: boolean
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
          brand_display_font_family?: string | null
          brand_logo_url?: string | null
          brand_menu_texture_url?: string | null
          brand_primary_hex?: string | null
          brand_secondary_hex?: string | null
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
          grace_period_started_at?: string | null
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
          marketplace_priority?: number
          marketplace_visible?: boolean
          max_guests_per_slot?: number | null
          max_party_size?: number | null
          max_party_size_online?: number
          menu_built_at?: string | null
          menu_cuisine_description?: string | null
          menu_design_preferences?: string | null
          menu_same_for_both?: boolean
          min_lead_time_minutes?: number | null
          mollie_access_token?: string | null
          mollie_initiated_at?: string | null
          mollie_organization_id?: string | null
          mollie_refresh_token?: string | null
          mollie_status?: Database["public"]["Enums"]["mollie_status"]
          mollie_token_expires_at?: string | null
          mollie_verified_at?: string | null
          name?: string
          neighbourhood?: string | null
          noshow_prepaid_amount_cents?: number | null
          noshow_prepaid_currency?: string
          noshow_prepaid_enabled?: boolean
          noshow_prepaid_threshold?: number | null
          noshow_prepaid_window?: Json | null
          noshow_reconfirmation_enabled?: boolean
          noshow_reminders_email_enabled?: boolean
          noshow_reminders_whatsapp_enabled?: boolean
          occupancy_duration_by_party?: Json | null
          occupancy_duration_minutes?: number | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          phone_public?: string | null
          photo_url?: string | null
          qr_auto_accept?: boolean
          qr_cards_shipped_at?: string | null
          qr_codes_generated_at?: string | null
          qr_item_notes_allowed?: boolean
          qr_item_notes_enabled?: boolean
          qr_menu_language?: string
          qr_pay_at_table_enabled?: boolean
          qr_pay_now_enabled?: boolean
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
          brand_display_font_family?: string | null
          brand_logo_url?: string | null
          brand_menu_texture_url?: string | null
          brand_primary_hex?: string | null
          brand_secondary_hex?: string | null
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
          grace_period_started_at?: string | null
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
          marketplace_priority?: number
          marketplace_visible?: boolean
          max_guests_per_slot?: number | null
          max_party_size?: number | null
          max_party_size_online?: number
          menu_built_at?: string | null
          menu_cuisine_description?: string | null
          menu_design_preferences?: string | null
          menu_same_for_both?: boolean
          min_lead_time_minutes?: number | null
          mollie_access_token?: string | null
          mollie_initiated_at?: string | null
          mollie_organization_id?: string | null
          mollie_refresh_token?: string | null
          mollie_status?: Database["public"]["Enums"]["mollie_status"]
          mollie_token_expires_at?: string | null
          mollie_verified_at?: string | null
          name?: string
          neighbourhood?: string | null
          noshow_prepaid_amount_cents?: number | null
          noshow_prepaid_currency?: string
          noshow_prepaid_enabled?: boolean
          noshow_prepaid_threshold?: number | null
          noshow_prepaid_window?: Json | null
          noshow_reconfirmation_enabled?: boolean
          noshow_reminders_email_enabled?: boolean
          noshow_reminders_whatsapp_enabled?: boolean
          occupancy_duration_by_party?: Json | null
          occupancy_duration_minutes?: number | null
          pause_reason?: string | null
          paused_at?: string | null
          paused_by?: string | null
          phone_public?: string | null
          photo_url?: string | null
          qr_auto_accept?: boolean
          qr_cards_shipped_at?: string | null
          qr_codes_generated_at?: string | null
          qr_item_notes_allowed?: boolean
          qr_item_notes_enabled?: boolean
          qr_menu_language?: string
          qr_pay_at_table_enabled?: boolean
          qr_pay_now_enabled?: boolean
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
        Relationships: [
          {
            foreignKeyName: "restaurants_paused_by_fkey"
            columns: ["paused_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
        ]
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
      reviews: {
        Row: {
          body: string | null
          booking_id: string | null
          created_at: string
          guest_id: string | null
          id: string
          published: boolean
          rating: number
          response: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          booking_id?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          published?: boolean
          rating: number
          response?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          booking_id?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          published?: boolean
          rating?: number
          response?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email_lower: string
          expires_at: string
          id: string
          invited_by: string
          restaurant_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["staff_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email_lower: string
          expires_at: string
          id?: string
          invited_by: string
          restaurant_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email_lower?: string
          expires_at?: string
          id?: string
          invited_by?: string
          restaurant_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_restaurant_id_fkey"
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
          vat_rate_bps: number
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
          vat_rate_bps?: number
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
          vat_rate_bps?: number
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
      tabs: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          currency: string
          id: string
          opened_at: string
          restaurant_id: string
          settled_at: string | null
          settled_payment_intent_id: string | null
          settlement: Database["public"]["Enums"]["tab_settlement"] | null
          status: string
          table_id: string
          total_cents: number
          updated_at: string
          write_off_reason: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          opened_at?: string
          restaurant_id: string
          settled_at?: string | null
          settled_payment_intent_id?: string | null
          settlement?: Database["public"]["Enums"]["tab_settlement"] | null
          status?: string
          table_id: string
          total_cents?: number
          updated_at?: string
          write_off_reason?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          opened_at?: string
          restaurant_id?: string
          settled_at?: string | null
          settled_payment_intent_id?: string | null
          settlement?: Database["public"]["Enums"]["tab_settlement"] | null
          status?: string
          table_id?: string
          total_cents?: number
          updated_at?: string
          write_off_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabs_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "restaurant_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_settled_payment_intent_fkey"
            columns: ["settled_payment_intent_id"]
            isOneToOne: false
            referencedRelation: "payment_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabs_table_id_fkey"
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
      anonymise_guest: { Args: { p_guest_id: string }; Returns: Json }
      lookup_booking_by_magic_link: {
        Args: { p_token: string }
        Returns: {
          booking_id: string
          booking_ref: string
          cancellation_deadline: string
          deposit_amount_cents: number
          deposit_currency: string
          guest_email: string
          guest_full_name: string
          guest_phone: string
          party_size: number
          restaurant_display_name: string
          restaurant_id: string
          restaurant_slug: string
          slot_time: string
          status: Database["public"]["Enums"]["booking_status"]
        }[]
      }
      lookup_order_by_magic_link: {
        Args: { p_token: string }
        Returns: {
          currency: string
          items: Json
          order_id: string
          order_ref: string
          order_type: Database["public"]["Enums"]["order_type"]
          pickup_time: string
          restaurant_display_name: string
          restaurant_id: string
          restaurant_slug: string
          status: Database["public"]["Enums"]["order_status"]
          table_label: string
          total_cents: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      booking_source: "online" | "walk_in" | "phone"
      booking_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "attended"
        | "no_show"
      magic_link_purpose:
        | "manage_booking"
        | "view_order"
        | "cancel_booking"
        | "data_export"
        | "data_deletion"
        | "staff_invite"
      menu_upload_channel: "takeaway" | "qr" | "both"
      menu_upload_type: "menu" | "photo" | "reference"
      mollie_status:
        | "not_started"
        | "pending"
        | "verified"
        | "rejected"
        | "needs_action"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "served"
        | "completed"
        | "cancelled"
        | "refunded"
      order_type: "qr" | "takeaway"
      payment_intent_purpose:
        | "deposit"
        | "qr_order"
        | "takeaway_order"
        | "subscription"
        | "qr_setup_fee"
      payment_intent_status:
        | "pending"
        | "paid"
        | "failed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
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
      staff_role: "owner" | "manager" | "service" | "kitchen"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "suspended"
        | "cancelled"
      subscription_tier: "starter" | "plus" | "premium"
      tab_settlement: "paid_at_table" | "written_off"
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
      booking_source: ["online", "walk_in", "phone"],
      booking_status: [
        "pending",
        "confirmed",
        "cancelled",
        "attended",
        "no_show",
      ],
      magic_link_purpose: [
        "manage_booking",
        "view_order",
        "cancel_booking",
        "data_export",
        "data_deletion",
        "staff_invite",
      ],
      menu_upload_channel: ["takeaway", "qr", "both"],
      menu_upload_type: ["menu", "photo", "reference"],
      mollie_status: [
        "not_started",
        "pending",
        "verified",
        "rejected",
        "needs_action",
      ],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
        "refunded",
      ],
      order_type: ["qr", "takeaway"],
      payment_intent_purpose: [
        "deposit",
        "qr_order",
        "takeaway_order",
        "subscription",
        "qr_setup_fee",
      ],
      payment_intent_status: [
        "pending",
        "paid",
        "failed",
        "cancelled",
        "refunded",
        "partially_refunded",
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
      staff_role: ["owner", "manager", "service", "kitchen"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "suspended",
        "cancelled",
      ],
      subscription_tier: ["starter", "plus", "premium"],
      tab_settlement: ["paid_at_table", "written_off"],
    },
  },
} as const
