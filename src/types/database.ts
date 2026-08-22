export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          brand_color: string;
          created_at: string;
          id: string;
          logo_path: string | null;
          name: string;
          now_serving: number;
          owner_id: string;
          paused: boolean;
          slug: string;
          welcome_message: string | null;
        };
        Insert: {
          brand_color?: string;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name: string;
          now_serving?: number;
          owner_id: string;
          paused?: boolean;
          slug: string;
          welcome_message?: string | null;
        };
        Update: {
          brand_color?: string;
          created_at?: string;
          id?: string;
          logo_path?: string | null;
          name?: string;
          now_serving?: number;
          owner_id?: string;
          paused?: boolean;
          slug?: string;
          welcome_message?: string | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          business_id: string;
          created_at: string;
          customer_name: string;
          id: string;
          number: number;
          served_at: string | null;
          status: "waiting" | "serving" | "served" | "skipped";
        };
        Insert: {
          business_id: string;
          created_at?: string;
          customer_name: string;
          id?: string;
          number: number;
          served_at?: string | null;
          status?: "waiting" | "serving" | "served" | "skipped";
        };
        Update: {
          business_id?: string;
          created_at?: string;
          customer_name?: string;
          id?: string;
          number?: number;
          served_at?: string | null;
          status?: "waiting" | "serving" | "served" | "skipped";
        };
        Relationships: [
          {
            foreignKeyName: "tickets_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_queue_info: {
        Args: { p_slug: string };
        Returns: {
          brand_color: string;
          business_name: string;
          logo_path: string;
          now_serving: number;
          paused: boolean;
          waiting_count: number;
          welcome_message: string;
        }[];
      };
      get_ticket_status: {
        Args: { p_ticket_id: string };
        Returns: {
          business_name: string;
          customer_name: string;
          now_serving: number;
          people_ahead: number;
          status: string;
          ticket_number: number;
        }[];
      };
      join_queue: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          business_name: string;
          ticket_id: string;
          ticket_number: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
