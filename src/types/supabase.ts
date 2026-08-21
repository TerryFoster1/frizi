export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type FriziRole =
  | 'client'
  | 'professional'
  | 'admin'
  | 'commerce_operator'
  | 'salon_owner'
  | 'salon_manager'
  | 'receptionist';

export type FriziDatabase = {
  public: {
    Tables: {
      frizi_profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          account_type: 'client' | 'professional' | 'admin';
          display_name: string;
          email: string | null;
          phone: string | null;
          profile_photo_url: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_profiles']['Row']> & {
          account_type: 'client' | 'professional' | 'admin';
          display_name: string;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_profiles']['Row']>;
      };
      frizi_user_roles: {
        Row: {
          id: string;
          profile_id: string;
          role: FriziRole;
          status: 'active' | 'invited' | 'suspended' | 'revoked';
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_user_roles']['Row']> & {
          profile_id: string;
          role: FriziRole;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_user_roles']['Row']>;
      };
      frizi_professionals: {
        Row: {
          id: string;
          profile_id: string | null;
          public_slug: string | null;
          display_name: string;
          studio_name: string | null;
          salon_id: string | null;
          bio: string | null;
          profile_photo_url: string | null;
          hero_photo_url: string | null;
          portfolio_photo_urls: string[];
          specialties: string[];
          primary_specialty: string | null;
          instagram_url: string | null;
          services: Json;
          location: Json;
          booking_settings: Json;
          stripe_connected_account_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string;
          subscription_plan: string | null;
          subscription_checked_at: string | null;
          onboarding_status: string;
          public_profile_status: string;
          bookable: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_professionals']['Row']> & {
          display_name: string;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_professionals']['Row']>;
      };
      frizi_professional_locations: {
        Row: {
          id: string;
          professional_id: string;
          label: string | null;
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          province: string;
          postal_code: string;
          country: string;
          latitude: number | null;
          longitude: number | null;
          geocoding_status: string;
          service_radius_km: number | null;
          online_booking_enabled: boolean;
          primary_location: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_professional_locations']['Row']> & {
          professional_id: string;
          address_line_1: string;
          city: string;
          province: string;
          postal_code: string;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_professional_locations']['Row']>;
      };
      frizi_services: {
        Row: {
          id: string;
          professional_id: string;
          salon_id: string | null;
          name: string;
          public_description: string | null;
          base_price_cents: number;
          currency: string;
          taxable: boolean;
          tip_eligible: boolean;
          promotion_eligible: boolean;
          active: boolean;
          category: string;
          duration_minutes: number | null;
          pricing_type: 'fixed' | 'starting_at' | 'price_varies' | 'free_consultation';
          deposit_type: 'none' | 'fixed' | 'percentage';
          deposit_amount_cents: number;
          deposit_percentage: number;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
          online_booking_enabled: boolean;
          new_clients_allowed: boolean;
          existing_clients_only: boolean;
          display_order: number;
          service_metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_services']['Row']> & {
          id: string;
          professional_id: string;
          name: string;
          base_price_cents: number;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_services']['Row']>;
      };
      frizi_service_addons: {
        Row: {
          id: string;
          service_id: string;
          professional_id: string;
          name: string;
          price_cents: number;
          duration_minutes: number;
          active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_service_addons']['Row']> & {
          id: string;
          service_id: string;
          professional_id: string;
          name: string;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_service_addons']['Row']>;
      };
      frizi_professional_onboarding_migrations: {
        Row: {
          id: string;
          profile_id: string;
          source: string;
          source_key: string;
          migrated_at: string;
          status: string;
          details: Json;
        };
        Insert: Partial<FriziDatabase['public']['Tables']['frizi_professional_onboarding_migrations']['Row']> & {
          profile_id: string;
          source: string;
          source_key: string;
        };
        Update: Partial<FriziDatabase['public']['Tables']['frizi_professional_onboarding_migrations']['Row']>;
      };
    };
  };
};
