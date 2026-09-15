/**
 * Supabase Database Types
 * 
 * Manually defined to match the PostgreSQL schema and migrations.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'customer' | 'admin';
export type OrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled';
export type IntegrationState = 'awaiting_session' | 'session_created' | 'recovery_needed' | 'cancellation_pending';
export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          price_amount: number;
          image_path: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          description?: string | null;
          price_amount: number;
          image_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          description?: string | null;
          price_amount?: number;
          image_path?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          product_id: string;
          on_hand: number;
          reserved: number;
          available: number; // GENERATED ALWAYS AS (on_hand - reserved) STORED
          updated_at: string;
        };
        Insert: {
          product_id: string;
          on_hand?: number;
          reserved?: number;
          updated_at?: string;
        };
        Update: {
          product_id?: string;
          on_hand?: number;
          reserved?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          customer_id: string;
          email_snapshot: string;
          status: OrderStatus;
          total_amount: number;
          currency: string;
          checkout_request_key: string;
          cart_fingerprint: string;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          session_expires_at: string | null;
          integration_state: IntegrationState;
          shipping_address: {
            name?: string | null;
            address?: {
              line1?: string | null;
              line2?: string | null;
              city?: string | null;
              state?: string | null;
              postal_code?: string | null;
              country?: string | null;
            } | null;
          } | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          email_snapshot: string;
          status?: OrderStatus;
          total_amount: number;
          currency?: string;
          checkout_request_key: string;
          cart_fingerprint: string;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          session_expires_at?: string | null;
          integration_state?: IntegrationState;
          shipping_address?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          email_snapshot?: string;
          status?: OrderStatus;
          total_amount?: number;
          currency?: string;
          checkout_request_key?: string;
          cart_fingerprint?: string;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          session_expires_at?: string | null;
          integration_state?: IntegrationState;
          shipping_address?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          sku_snapshot: string;
          name_snapshot: string;
          unit_price_snapshot: number;
          quantity: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          sku_snapshot: string;
          name_snapshot: string;
          unit_price_snapshot: number;
          quantity: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          sku_snapshot?: string;
          name_snapshot?: string;
          unit_price_snapshot?: number;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          on_hand_delta: number;
          reserved_delta: number;
          reason: string;
          order_id: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          on_hand_delta: number;
          reserved_delta: number;
          reason: string;
          order_id?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          on_hand_delta?: number;
          reserved_delta?: number;
          reason?: string;
          order_id?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          previous_status: OrderStatus | null;
          new_status: OrderStatus;
          description: string;
          actor: string | null;
          is_customer_visible: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          previous_status?: OrderStatus | null;
          new_status: OrderStatus;
          description: string;
          actor?: string | null;
          is_customer_visible?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          previous_status?: OrderStatus | null;
          new_status?: OrderStatus;
          description?: string;
          actor?: string | null;
          is_customer_visible?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'order_status_history_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          event_type: string;
          object_id: string;
          order_id: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          event_type: string;
          object_id: string;
          order_id?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_type?: string;
          object_id?: string;
          order_id?: string | null;
          processed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      refund_requests: {
        Row: {
          id: string;
          order_id: string;
          idempotency_key: string;
          stripe_refund_id: string | null;
          status: RefundStatus;
          admin_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          idempotency_key: string;
          stripe_refund_id?: string | null;
          status?: RefundStatus;
          admin_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          idempotency_key?: string;
          stripe_refund_id?: string | null;
          status?: RefundStatus;
          admin_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refund_requests_order_id_fkey';
            columns: ['order_id'];
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_order_with_reservation: {
        Args: {
          p_customer_id: string;
          p_email: string;
          p_checkout_request_key: string;
          p_cart_fingerprint: string;
          p_items: Array<{ product_id: string; quantity: number }>;
        };
        Returns: {
          order_id: string;
          is_existing: boolean;
        };
      };
      process_payment_success: {
        Args: {
          p_order_id: string;
          p_event_id: string;
          p_payment_intent_id: string;
          p_amount: number;
          p_currency: string;
        };
        Returns: void;
      };
      process_cancellation: {
        Args: {
          p_order_id: string;
          p_event_id?: string | null;
          p_reason: string;
        };
        Returns: void;
      };
      process_refund_success: {
        Args: {
          p_order_id: string;
          p_event_id?: string | null;
          p_refund_id: string;
        };
        Returns: void;
      };
      adjust_stock: {
        Args: {
          p_product_id: string;
          p_on_hand_delta: number;
          p_reason: string;
        };
        Returns: void;
      };
      fulfill_order: {
        Args: {
          p_order_id: string;
        };
        Returns: void;
      };
      get_product_catalog: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          sku: string;
          name: string;
          description: string | null;
          price_amount: number;
          image_path: string | null;
          available: number;
        }>;
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      integration_state: IntegrationState;
      refund_status: RefundStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
