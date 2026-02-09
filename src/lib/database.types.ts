export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      trips: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          destination: string | null;
          start_date: string | null;
          end_date: string | null;
          cover_image_url: string | null;
          is_archived: boolean;
          public_share_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          destination?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          cover_image_url?: string | null;
          is_archived?: boolean;
          public_share_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          destination?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          cover_image_url?: string | null;
          is_archived?: boolean;
          public_share_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trip_shares: {
        Row: {
          id: string;
          trip_id: string;
          shared_with_email: string;
          shared_with_user_id: string | null;
          permission: string;
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          shared_with_email: string;
          shared_with_user_id?: string | null;
          permission?: string;
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          shared_with_email?: string;
          shared_with_user_id?: string | null;
          permission?: string;
          invited_at?: string;
          accepted_at?: string | null;
        };
      };
      plan_versions: {
        Row: {
          id: string;
          trip_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          total_cost: number;
          currency: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          total_cost?: number;
          currency?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          total_cost?: number;
          currency?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      itinerary_days: {
        Row: {
          id: string;
          plan_version_id: string;
          day_number: number;
          date: string | null;
          location: string;
          location_coordinates: Json | null;
          icon: string;
          color: string;
          activities: Json;
          notes: string | null;
          drive_time: string | null;
          drive_distance: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          day_number: number;
          date?: string | null;
          location: string;
          location_coordinates?: Json | null;
          icon?: string;
          color?: string;
          activities?: Json;
          notes?: string | null;
          drive_time?: string | null;
          drive_distance?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          day_number?: number;
          date?: string | null;
          location?: string;
          location_coordinates?: Json | null;
          icon?: string;
          color?: string;
          activities?: Json;
          notes?: string | null;
          drive_time?: string | null;
          drive_distance?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      accommodations: {
        Row: {
          id: string;
          plan_version_id: string;
          name: string;
          type: string;
          location: string | null;
          address: string | null;
          coordinates: Json | null;
          check_in: string;
          check_out: string;
          nights: number;
          cost: number | null;
          currency: string;
          booking_reference: string | null;
          booking_url: string | null;
          cancellation_policy: string | null;
          amenities: Json;
          notes: string | null;
          color: string;
          is_confirmed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          name: string;
          type?: string;
          location?: string | null;
          address?: string | null;
          coordinates?: Json | null;
          check_in: string;
          check_out: string;
          cost?: number | null;
          currency?: string;
          booking_reference?: string | null;
          booking_url?: string | null;
          cancellation_policy?: string | null;
          amenities?: Json;
          notes?: string | null;
          color?: string;
          is_confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          name?: string;
          type?: string;
          location?: string | null;
          address?: string | null;
          coordinates?: Json | null;
          check_in?: string;
          check_out?: string;
          cost?: number | null;
          currency?: string;
          booking_reference?: string | null;
          booking_url?: string | null;
          cancellation_policy?: string | null;
          amenities?: Json;
          notes?: string | null;
          color?: string;
          is_confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      transport: {
        Row: {
          id: string;
          plan_version_id: string;
          type: string;
          provider: string | null;
          vehicle: string | null;
          reference_number: string | null;
          pickup_location: string | null;
          pickup_date: string | null;
          pickup_time: string | null;
          dropoff_location: string | null;
          dropoff_date: string | null;
          dropoff_time: string | null;
          cost: number | null;
          currency: string;
          includes: Json;
          booking_url: string | null;
          notes: string | null;
          is_confirmed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          type: string;
          provider?: string | null;
          vehicle?: string | null;
          reference_number?: string | null;
          pickup_location?: string | null;
          pickup_date?: string | null;
          pickup_time?: string | null;
          dropoff_location?: string | null;
          dropoff_date?: string | null;
          dropoff_time?: string | null;
          cost?: number | null;
          currency?: string;
          includes?: Json;
          booking_url?: string | null;
          notes?: string | null;
          is_confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          type?: string;
          provider?: string | null;
          vehicle?: string | null;
          reference_number?: string | null;
          pickup_location?: string | null;
          pickup_date?: string | null;
          pickup_time?: string | null;
          dropoff_location?: string | null;
          dropoff_date?: string | null;
          dropoff_time?: string | null;
          cost?: number | null;
          currency?: string;
          includes?: Json;
          booking_url?: string | null;
          notes?: string | null;
          is_confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      costs: {
        Row: {
          id: string;
          plan_version_id: string;
          itinerary_day_id: string | null;
          category: string;
          item: string;
          amount: number;
          currency: string;
          is_paid: boolean;
          is_estimated: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          itinerary_day_id?: string | null;
          category: string;
          item: string;
          amount: number;
          currency?: string;
          is_paid?: boolean;
          is_estimated?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          itinerary_day_id?: string | null;
          category?: string;
          item?: string;
          amount?: number;
          currency?: string;
          is_paid?: boolean;
          is_estimated?: boolean;
          notes?: string | null;
          created_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          plan_version_id: string;
          itinerary_day_id: string;
          name: string;
          description: string | null;
          time_start: string | null;
          time_end: string | null;
          location: string | null;
          cost: number | null;
          currency: string;
          booking_status: string;
          booking_reference: string | null;
          sort_order: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          itinerary_day_id: string;
          name: string;
          description?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          location?: string | null;
          cost?: number | null;
          currency?: string;
          booking_status?: string;
          booking_reference?: string | null;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          itinerary_day_id?: string;
          name?: string;
          description?: string | null;
          time_start?: string | null;
          time_end?: string | null;
          location?: string | null;
          cost?: number | null;
          currency?: string;
          booking_status?: string;
          booking_reference?: string | null;
          sort_order?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      decisions: {
        Row: {
          id: string;
          trip_id: string;
          plan_version_id: string | null;
          title: string;
          description: string | null;
          options: Json;
          selected_option: number | null;
          due_date: string | null;
          priority: string;
          status: string;
          decided_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          plan_version_id?: string | null;
          title: string;
          description?: string | null;
          options?: Json;
          selected_option?: number | null;
          due_date?: string | null;
          priority?: string;
          status?: string;
          decided_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          plan_version_id?: string | null;
          title?: string;
          description?: string | null;
          options?: Json;
          selected_option?: number | null;
          due_date?: string | null;
          priority?: string;
          status?: string;
          decided_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      travellers: {
        Row: {
          id: string;
          trip_id: string;
          name: string;
          passport_number: string | null;
          passport_expiry: string | null;
          nationality: string | null;
          esta_status: string;
          dietary: string | null;
          medical_notes: string | null;
          is_child: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          name: string;
          passport_number?: string | null;
          passport_expiry?: string | null;
          nationality?: string | null;
          esta_status?: string;
          dietary?: string | null;
          medical_notes?: string | null;
          is_child?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          name?: string;
          passport_number?: string | null;
          passport_expiry?: string | null;
          nationality?: string | null;
          esta_status?: string;
          dietary?: string | null;
          medical_notes?: string | null;
          is_child?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      travel_insurance: {
        Row: {
          id: string;
          trip_id: string;
          provider: string;
          policy_number: string | null;
          emergency_phone: string | null;
          coverage_start: string | null;
          coverage_end: string | null;
          document_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          provider: string;
          policy_number?: string | null;
          emergency_phone?: string | null;
          coverage_start?: string | null;
          coverage_end?: string | null;
          document_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          provider?: string;
          policy_number?: string | null;
          emergency_phone?: string | null;
          coverage_start?: string | null;
          coverage_end?: string | null;
          document_url?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          trip_id: string;
          plan_version_id: string | null;
          linked_item_type: string | null;
          linked_item_id: string | null;
          file_name: string;
          file_url: string;
          file_type: string | null;
          uploaded_by: string;
          uploaded_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          trip_id: string;
          plan_version_id?: string | null;
          linked_item_type?: string | null;
          linked_item_id?: string | null;
          file_name: string;
          file_url: string;
          file_type?: string | null;
          uploaded_by: string;
          uploaded_at?: string;
          notes?: string | null;
        };
        Update: {
          id?: string;
          trip_id?: string;
          plan_version_id?: string | null;
          linked_item_type?: string | null;
          linked_item_id?: string | null;
          file_name?: string;
          file_url?: string;
          file_type?: string | null;
          uploaded_by?: string;
          uploaded_at?: string;
          notes?: string | null;
        };
      };
      packing_items: {
        Row: {
          id: string;
          trip_id: string;
          category: string;
          name: string;
          quantity: number;
          packed: boolean;
          assigned_to: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          category?: string;
          name: string;
          quantity?: number;
          packed?: boolean;
          assigned_to?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          category?: string;
          name?: string;
          quantity?: number;
          packed?: boolean;
          assigned_to?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          trip_id: string;
          item_type: string;
          item_id: string;
          user_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id: string;
          item_type: string;
          item_id: string;
          user_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string;
          item_type?: string;
          item_id?: string;
          user_id?: string;
          message?: string;
          created_at?: string;
        };
      };
      checklist_items: {
        Row: {
          id: string;
          plan_version_id: string;
          category: string;
          name: string;
          description: string | null;
          source_type: string | null;
          source_id: string | null;
          booking_status: string;
          booking_reference: string | null;
          booking_url: string | null;
          total_cost: number;
          deposit_amount: number;
          amount_paid: number;
          is_fully_paid: boolean;
          payment_type: string;
          payment_due_date: string | null;
          payment_due_context: string;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_version_id: string;
          category?: string;
          name: string;
          description?: string | null;
          source_type?: string | null;
          source_id?: string | null;
          booking_status?: string;
          booking_reference?: string | null;
          booking_url?: string | null;
          total_cost?: number;
          deposit_amount?: number;
          amount_paid?: number;
          is_fully_paid?: boolean;
          payment_type?: string;
          payment_due_date?: string | null;
          payment_due_context?: string;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_version_id?: string;
          category?: string;
          name?: string;
          description?: string | null;
          source_type?: string | null;
          source_id?: string | null;
          booking_status?: string;
          booking_reference?: string | null;
          booking_url?: string | null;
          total_cost?: number;
          deposit_amount?: number;
          amount_paid?: number;
          is_fully_paid?: boolean;
          payment_type?: string;
          payment_due_date?: string | null;
          payment_due_context?: string;
          notes?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          keys_p256dh: string;
          keys_auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          keys_p256dh: string;
          keys_auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          keys_p256dh?: string;
          keys_auth?: string;
          created_at?: string;
        };
      };
      ai_research_cache: {
        Row: {
          id: string;
          trip_id: string | null;
          query: string;
          query_type: string | null;
          results: Json;
          model: string | null;
          tokens_used: number | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trip_id?: string | null;
          query: string;
          query_type?: string | null;
          results: Json;
          model?: string | null;
          tokens_used?: number | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trip_id?: string | null;
          query?: string;
          query_type?: string | null;
          results?: Json;
          model?: string | null;
          tokens_used?: number | null;
          expires_at?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_trip_shared_with_user: {
        Args: { p_trip_id: string; p_user_id: string };
        Returns: boolean;
      };
      is_trip_owner: {
        Args: { p_trip_id: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}
