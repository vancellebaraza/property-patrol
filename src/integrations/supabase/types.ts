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
      checklist_categories: {
        Row: {
          id: string
          name: string
          sort_order: number
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_entries: {
        Row: {
          comment: string | null
          day_of_week: number | null
          filled_at: string
          filled_by: string
          id: string
          item_id: string
          photo_url: string | null
          status: Database["public"]["Enums"]["entry_status"]
          submission_id: string
        }
        Insert: {
          comment?: string | null
          day_of_week?: number | null
          filled_at?: string
          filled_by: string
          id?: string
          item_id: string
          photo_url?: string | null
          status: Database["public"]["Enums"]["entry_status"]
          submission_id: string
        }
        Update: {
          comment?: string | null
          day_of_week?: number | null
          filled_at?: string
          filled_by?: string
          id?: string
          item_id?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["entry_status"]
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          category_id: string
          id: string
          label: string
          parent_item_id: string | null
          sort_order: number
        }
        Insert: {
          category_id: string
          id?: string
          label: string
          parent_item_id?: string | null
          sort_order?: number
        }
        Update: {
          category_id?: string
          id?: string
          label?: string
          parent_item_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "checklist_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_submissions: {
        Row: {
          created_at: string
          id: string
          period_end: string
          period_start: string
          property_id: string
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          property_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          property_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_submissions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          cadence: Database["public"]["Enums"]["checklist_cadence"]
          created_at: string
          format: Database["public"]["Enums"]["checklist_format"]
          id: string
          name: string
          property_id: string
          role_required: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          cadence: Database["public"]["Enums"]["checklist_cadence"]
          created_at?: string
          format: Database["public"]["Enums"]["checklist_format"]
          id?: string
          name: string
          property_id: string
          role_required: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          cadence?: Database["public"]["Enums"]["checklist_cadence"]
          created_at?: string
          format?: Database["public"]["Enums"]["checklist_format"]
          id?: string
          name?: string
          property_id?: string
          role_required?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      fault_log_entries: {
        Row: {
          equipment_type: string
          fault_description: string
          id: string
          property_id: string
          reported_at: string
          reported_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["fault_status"]
          submission_id: string | null
        }
        Insert: {
          equipment_type: string
          fault_description: string
          id?: string
          property_id: string
          reported_at?: string
          reported_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["fault_status"]
          submission_id?: string | null
        }
        Update: {
          equipment_type?: string
          fault_description?: string
          id?: string
          property_id?: string
          reported_at?: string
          reported_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["fault_status"]
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fault_log_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fault_log_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "checklist_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          theme_color: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          theme_color?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          theme_color?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          property_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          full_name?: string
          id: string
          property_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          property_id?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_property: { Args: { _uid: string }; Returns: string }
      get_user_role: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "caretaker" | "site_rep"
      checklist_cadence: "daily" | "weekly" | "monthly"
      checklist_format: "status_comment" | "day_grid" | "fault_log"
      entry_status: "done" | "not_done" | "na"
      fault_status: "reported" | "broken" | "repaired"
      submission_status: "in_progress" | "submitted"
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
      app_role: ["admin", "supervisor", "caretaker", "site_rep"],
      checklist_cadence: ["daily", "weekly", "monthly"],
      checklist_format: ["status_comment", "day_grid", "fault_log"],
      entry_status: ["done", "not_done", "na"],
      fault_status: ["reported", "broken", "repaired"],
      submission_status: ["in_progress", "submitted"],
    },
  },
} as const
