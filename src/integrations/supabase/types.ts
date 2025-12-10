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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_twins: {
        Row: {
          consent_audio_url: string | null
          created_at: string
          description: string | null
          face_description: string | null
          gender: string | null
          id: string
          name: string
          reference_images: string[] | null
          updated_at: string
          user_id: string
          voice_cloning_key: string | null
          voice_sample_url: string | null
        }
        Insert: {
          consent_audio_url?: string | null
          created_at?: string
          description?: string | null
          face_description?: string | null
          gender?: string | null
          id?: string
          name: string
          reference_images?: string[] | null
          updated_at?: string
          user_id: string
          voice_cloning_key?: string | null
          voice_sample_url?: string | null
        }
        Update: {
          consent_audio_url?: string | null
          created_at?: string
          description?: string | null
          face_description?: string | null
          gender?: string | null
          id?: string
          name?: string
          reference_images?: string[] | null
          updated_at?: string
          user_id?: string
          voice_cloning_key?: string | null
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kie_voice_id: string | null
          name: string
          personality: string | null
          reference_images: string[] | null
          updated_at: string
          user_id: string
          voice_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kie_voice_id?: string | null
          name: string
          personality?: string | null
          reference_images?: string[] | null
          updated_at?: string
          user_id: string
          voice_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kie_voice_id?: string | null
          name?: string
          personality?: string | null
          reference_images?: string[] | null
          updated_at?: string
          user_id?: string
          voice_type?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          project_id: string | null
          prompt: string | null
          reference_image_url: string | null
          scene_number: number | null
          source: string | null
          transformation: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          project_id?: string | null
          prompt?: string | null
          reference_image_url?: string | null
          scene_number?: number | null
          source?: string | null
          transformation?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          project_id?: string | null
          prompt?: string | null
          reference_image_url?: string | null
          scene_number?: number | null
          source?: string | null
          transformation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      movie_projects: {
        Row: {
          created_at: string
          id: string
          movie_idea: string
          outline: string | null
          scenes: Json | null
          stitched_video_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_idea: string
          outline?: string | null
          scenes?: Json | null
          stitched_video_url?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_idea?: string
          outline?: string | null
          scenes?: Json | null
          stitched_video_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          aspect_ratio: string
          character_id: string | null
          consistency_settings: Json | null
          created_at: string
          id: string
          is_stitched: boolean | null
          model_type: string
          script: string | null
          segments: Json | null
          source_audio_url: string | null
          source_image_url: string | null
          stitched_url: string | null
          title: string
          total_duration: number | null
          updated_at: string
          user_id: string
          voice_settings: Json | null
        }
        Insert: {
          aspect_ratio?: string
          character_id?: string | null
          consistency_settings?: Json | null
          created_at?: string
          id?: string
          is_stitched?: boolean | null
          model_type?: string
          script?: string | null
          segments?: Json | null
          source_audio_url?: string | null
          source_image_url?: string | null
          stitched_url?: string | null
          title: string
          total_duration?: number | null
          updated_at?: string
          user_id: string
          voice_settings?: Json | null
        }
        Update: {
          aspect_ratio?: string
          character_id?: string | null
          consistency_settings?: Json | null
          created_at?: string
          id?: string
          is_stitched?: boolean | null
          model_type?: string
          script?: string | null
          segments?: Json | null
          source_audio_url?: string | null
          source_image_url?: string | null
          stitched_url?: string | null
          title?: string
          total_duration?: number | null
          updated_at?: string
          user_id?: string
          voice_settings?: Json | null
        }
        Relationships: []
      }
      reels: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          scenes: Json | null
          thumbnail_url: string | null
          topic: string
          total_duration: number | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          scenes?: Json | null
          thumbnail_url?: string | null
          topic: string
          total_duration?: number | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          scenes?: Json | null
          thumbnail_url?: string | null
          topic?: string
          total_duration?: number | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      scripts: {
        Row: {
          audience: string | null
          content: string
          created_at: string
          duration: number
          id: string
          segments: Json | null
          style: string | null
          title: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string | null
          content: string
          created_at?: string
          duration: number
          id?: string
          segments?: Json | null
          style?: string | null
          title: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string | null
          content?: string
          created_at?: string
          duration?: number
          id?: string
          segments?: Json | null
          style?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_logos: {
        Row: {
          created_at: string
          id: string
          logo_url: string
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url: string
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      visual_presets: {
        Row: {
          camera_angle: string
          created_at: string
          id: string
          lighting_style: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          camera_angle: string
          created_at?: string
          id?: string
          lighting_style: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          camera_angle?: string
          created_at?: string
          id?: string
          lighting_style?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
