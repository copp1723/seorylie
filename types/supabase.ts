/**
 * Supabase Database Type Definitions
 * 
 * Auto-generated types based on the Supabase schema
 * These types provide type safety when using the Supabase client
 * 
 * @file types/supabase.ts
 */

export interface Database {
  public: {
    Tables: {
      dealerships: {
        Row: {
          id: number;
          name: string;
          subdomain: string;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          country: string | null;
          timezone: string;
          is_active: boolean;
          settings: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          subdomain: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          timezone?: string;
          is_active?: boolean;
          settings?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          subdomain?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          country?: string | null;
          timezone?: string;
          is_active?: boolean;
          settings?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: number;
          username: string;
          email: string;
          password: string;
          role: string;
          dealership_id: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          username: string;
          email: string;
          password: string;
          role?: string;
          dealership_id?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          username?: string;
          email?: string;
          password?: string;
          role?: string;
          dealership_id?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      vehicles: {
        Row: {
          id: number;
          vin: string;
          make: string | null;
          model: string | null;
          year: number | null;
          trim: string | null;
          dealership_id: number;
          status: string;
          price: number | null;
          mileage: number | null;
          exterior_color: string | null;
          interior_color: string | null;
          transmission: string | null;
          engine: string | null;
          fuel_type: string | null;
          body_style: string | null;
          features: string[] | null;
          description: string | null;
          images: string[] | null;
          metadata: Record<string, any> | null;
          // New fields from STAB-303
          fuel_economy_city: number | null;
          fuel_economy_highway: number | null;
          safety_rating: string | null;
          warranty_months: number | null;
          availability_status: string;
          location_on_lot: string | null;
          days_on_lot: number;
          priority_listing: boolean;
          financing_options: Record<string, any> | null;
          comparable_vehicles: number[] | null;
          dealer_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          vin: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          trim?: string | null;
          dealership_id: number;
          status?: string;
          price?: number | null;
          mileage?: number | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          transmission?: string | null;
          engine?: string | null;
          fuel_type?: string | null;
          body_style?: string | null;
          features?: string[] | null;
          description?: string | null;
          images?: string[] | null;
          metadata?: Record<string, any> | null;
          fuel_economy_city?: number | null;
          fuel_economy_highway?: number | null;
          safety_rating?: string | null;
          warranty_months?: number | null;
          availability_status?: string;
          location_on_lot?: string | null;
          days_on_lot?: number;
          priority_listing?: boolean;
          financing_options?: Record<string, any> | null;
          comparable_vehicles?: number[] | null;
          dealer_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          vin?: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          trim?: string | null;
          dealership_id?: number;
          status?: string;
          price?: number | null;
          mileage?: number | null;
          exterior_color?: string | null;
          interior_color?: string | null;
          transmission?: string | null;
          engine?: string | null;
          fuel_type?: string | null;
          body_style?: string | null;
          features?: string[] | null;
          description?: string | null;
          images?: string[] | null;
          metadata?: Record<string, any> | null;
          fuel_economy_city?: number | null;
          fuel_economy_highway?: number | null;
          safety_rating?: string | null;
          warranty_months?: number | null;
          availability_status?: string;
          location_on_lot?: string | null;
          days_on_lot?: number;
          priority_listing?: boolean;
          financing_options?: Record<string, any> | null;
          comparable_vehicles?: number[] | null;
          dealer_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: number;
          subject: string | null;
          status: string;
          channel: string;
          user_id: number | null;
          dealership_id: number;
          customer_id: number | null;
          assigned_agent_id: number | null;
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          subject?: string | null;
          status?: string;
          channel?: string;
          user_id?: number | null;
          dealership_id: number;
          customer_id?: number | null;
          assigned_agent_id?: number | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          subject?: string | null;
          status?: string;
          channel?: string;
          user_id?: number | null;
          dealership_id?: number;
          customer_id?: number | null;
          assigned_agent_id?: number | null;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: number;
          conversation_id: number;
          sender: string;
          sender_type: string;
          content: string;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          conversation_id: number;
          sender: string;
          sender_type?: string;
          content: string;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          conversation_id?: number;
          sender?: string;
          sender_type?: string;
          content?: string;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      customers: {
        Row: {
          id: number;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          dealership_id: number;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          dealership_id: number;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          dealership_id?: number;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      leads: {
        Row: {
          id: number;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          dealership_id: number;
          source: string | null;
          status: string;
          assigned_agent_id: number | null;
          conversation_id: number | null;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          dealership_id: number;
          source?: string | null;
          status?: string;
          assigned_agent_id?: number | null;
          conversation_id?: number | null;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          dealership_id?: number;
          source?: string | null;
          status?: string;
          assigned_agent_id?: number | null;
          conversation_id?: number | null;
          metadata?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      vehicles_enhanced: {
        Row: {
          id: number;
          vin: string;
          make: string | null;
          model: string | null;
          year: number | null;
          trim: string | null;
          dealership_id: number;
          status: string;
          price: number | null;
          mileage: number | null;
          fuel_economy_combined: number | null;
          inventory_age_category: string;
          dealership_name: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
    Functions: {
      set_tenant_context: {
        Args: { dealership_id: number };
        Returns: void;
      };
      has_dealership_access: {
        Args: { dealership_id: number };
        Returns: boolean;
      };
      can_modify_record: {
        Args: { record_dealership_id: number };
        Returns: boolean;
      };
      update_vehicle_days_on_lot: {
        Args: Record<string, never>;
        Returns: any;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}