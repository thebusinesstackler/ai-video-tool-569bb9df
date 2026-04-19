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
          google_voice_id: string | null
          id: string
          name: string
          reference_images: string[] | null
          updated_at: string
          user_id: string
          voice_cloning_key: string | null
          voice_engine: string
          voice_sample_url: string | null
        }
        Insert: {
          consent_audio_url?: string | null
          created_at?: string
          description?: string | null
          face_description?: string | null
          gender?: string | null
          google_voice_id?: string | null
          id?: string
          name: string
          reference_images?: string[] | null
          updated_at?: string
          user_id: string
          voice_cloning_key?: string | null
          voice_engine?: string
          voice_sample_url?: string | null
        }
        Update: {
          consent_audio_url?: string | null
          created_at?: string
          description?: string | null
          face_description?: string | null
          gender?: string | null
          google_voice_id?: string | null
          id?: string
          name?: string
          reference_images?: string[] | null
          updated_at?: string
          user_id?: string
          voice_cloning_key?: string | null
          voice_engine?: string
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      animated_statics: {
        Row: {
          analysis: Json | null
          animation_url: string | null
          created_at: string
          id: string
          music_url: string | null
          prompt: string | null
          source_image_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          animation_url?: string | null
          created_at?: string
          id?: string
          music_url?: string | null
          prompt?: string | null
          source_image_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          animation_url?: string | null
          created_at?: string
          id?: string
          music_url?: string | null
          prompt?: string | null
          source_image_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
          user_id?: string
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
      chatcut_drafts: {
        Row: {
          chat_history: Json
          created_at: string | null
          id: string
          name: string
          timeline_state: Json
          transcript: Json | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          chat_history?: Json
          created_at?: string | null
          id?: string
          name?: string
          timeline_state?: Json
          transcript?: Json | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          chat_history?: Json
          created_at?: string | null
          id?: string
          name?: string
          timeline_state?: Json
          transcript?: Json | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
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
      hook_folders: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifestyle_stories: {
        Row: {
          brand_analysis: Json | null
          brand_url: string | null
          concepts: Json | null
          created_at: string
          duration: number | null
          id: string
          music_url: string | null
          scenes: Json | null
          selected_concept_index: number | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          voiceover_url: string | null
        }
        Insert: {
          brand_analysis?: Json | null
          brand_url?: string | null
          concepts?: Json | null
          created_at?: string
          duration?: number | null
          id?: string
          music_url?: string | null
          scenes?: Json | null
          selected_concept_index?: number | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          voiceover_url?: string | null
        }
        Update: {
          brand_analysis?: Json | null
          brand_url?: string | null
          concepts?: Json | null
          created_at?: string
          duration?: number | null
          id?: string
          music_url?: string | null
          scenes?: Json | null
          selected_concept_index?: number | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          voiceover_url?: string | null
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
          story_bible: Json | null
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
          story_bible?: Json | null
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
          story_bible?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      music_library: {
        Row: {
          audio_url: string
          created_at: string
          duration: number | null
          id: string
          label: string
          mood: string | null
          prompt: string | null
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration?: number | null
          id?: string
          label: string
          mood?: string | null
          prompt?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration?: number | null
          id?: string
          label?: string
          mood?: string | null
          prompt?: string | null
          user_id?: string
        }
        Relationships: []
      }
      podcast_projects: {
        Row: {
          audience: string | null
          audio_url: string | null
          created_at: string
          duration: number | null
          error: string | null
          featured_product: string | null
          hook: string | null
          id: string
          narration: string
          scene_image_url: string | null
          setting_label: string | null
          status: string
          style_label: string | null
          topic: string
          twin_id: string | null
          twin_name: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          visual_description: string | null
        }
        Insert: {
          audience?: string | null
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          error?: string | null
          featured_product?: string | null
          hook?: string | null
          id?: string
          narration: string
          scene_image_url?: string | null
          setting_label?: string | null
          status?: string
          style_label?: string | null
          topic: string
          twin_id?: string | null
          twin_name?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          visual_description?: string | null
        }
        Update: {
          audience?: string | null
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          error?: string | null
          featured_product?: string | null
          hook?: string | null
          id?: string
          narration?: string
          scene_image_url?: string | null
          setting_label?: string | null
          status?: string
          style_label?: string | null
          topic?: string
          twin_id?: string | null
          twin_name?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visual_description?: string | null
        }
        Relationships: []
      }
      product_gallery: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          label: string | null
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          label?: string | null
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          label?: string | null
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_gallery_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_graphics: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_original: boolean
          label: string | null
          product_id: string
          source_style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_original?: boolean
          label?: string | null
          product_id: string
          source_style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_original?: boolean
          label?: string | null
          product_id?: string
          source_style?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_graphics_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          benefits: string[] | null
          brand_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          target_audience: string | null
          updated_at: string
          user_id: string
          youtube_short_url: string | null
        }
        Insert: {
          benefits?: string[] | null
          brand_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          target_audience?: string | null
          updated_at?: string
          user_id: string
          youtube_short_url?: string | null
        }
        Update: {
          benefits?: string[] | null
          brand_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          target_audience?: string | null
          updated_at?: string
          user_id?: string
          youtube_short_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          brand_analysis: Json | null
          brand_description: string | null
          brand_guidelines_url: string | null
          brand_url: string | null
          company_name: string | null
          content_goal: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_analysis?: Json | null
          brand_description?: string | null
          brand_guidelines_url?: string | null
          brand_url?: string | null
          company_name?: string | null
          content_goal?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_analysis?: Json | null
          brand_description?: string | null
          brand_guidelines_url?: string | null
          brand_url?: string | null
          company_name?: string | null
          content_goal?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
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
          caption_settings: Json | null
          created_at: string
          draft_state: Json | null
          id: string
          is_draft: boolean | null
          scenes: Json | null
          thumbnail_url: string | null
          topic: string
          total_duration: number | null
          updated_at: string
          user_id: string
          video_url: string | null
          video_url_no_captions: string | null
        }
        Insert: {
          audio_url?: string | null
          caption_settings?: Json | null
          created_at?: string
          draft_state?: Json | null
          id?: string
          is_draft?: boolean | null
          scenes?: Json | null
          thumbnail_url?: string | null
          topic: string
          total_duration?: number | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          video_url_no_captions?: string | null
        }
        Update: {
          audio_url?: string | null
          caption_settings?: Json | null
          created_at?: string
          draft_state?: Json | null
          id?: string
          is_draft?: boolean | null
          scenes?: Json | null
          thumbnail_url?: string | null
          topic?: string
          total_duration?: number | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          video_url_no_captions?: string | null
        }
        Relationships: []
      }
      saved_hooks: {
        Row: {
          best_for: string[] | null
          best_platform: string | null
          created_at: string
          folder_id: string
          hook_text: string
          hook_type: string | null
          id: string
          on_screen_text: string | null
          scores: Json | null
          user_id: string
          visual_direction: string | null
          voiceover_version: string | null
          why_chosen: string | null
        }
        Insert: {
          best_for?: string[] | null
          best_platform?: string | null
          created_at?: string
          folder_id: string
          hook_text: string
          hook_type?: string | null
          id?: string
          on_screen_text?: string | null
          scores?: Json | null
          user_id: string
          visual_direction?: string | null
          voiceover_version?: string | null
          why_chosen?: string | null
        }
        Update: {
          best_for?: string[] | null
          best_platform?: string | null
          created_at?: string
          folder_id?: string
          hook_text?: string
          hook_type?: string | null
          id?: string
          on_screen_text?: string | null
          scores?: Json | null
          user_id?: string
          visual_direction?: string | null
          voiceover_version?: string | null
          why_chosen?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_hooks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "hook_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_voices: {
        Row: {
          created_at: string | null
          gender: string | null
          id: string
          sample_audio_url: string | null
          user_id: string
          voice_description: string | null
          voice_id: string
          voice_label: string
        }
        Insert: {
          created_at?: string | null
          gender?: string | null
          id?: string
          sample_audio_url?: string | null
          user_id: string
          voice_description?: string | null
          voice_id: string
          voice_label: string
        }
        Update: {
          created_at?: string | null
          gender?: string | null
          id?: string
          sample_audio_url?: string | null
          user_id?: string
          voice_description?: string | null
          voice_id?: string
          voice_label?: string
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
      testimonial_commercials: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          name: string
          segments: Json
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          name: string
          segments?: Json
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          name?: string
          segments?: Json
          updated_at?: string
          user_id?: string
          video_url?: string | null
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
      user_preferences: {
        Row: {
          created_at: string
          creator_mode: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_mode?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_mode?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_clip_templates: {
        Row: {
          category: string | null
          created_at: string
          end_time: number
          id: string
          label: string
          source_video_url: string
          start_time: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          end_time?: number
          id?: string
          label?: string
          source_video_url: string
          start_time?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          end_time?: number
          id?: string
          label?: string
          source_video_url?: string
          start_time?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_hooks: {
        Row: {
          content_summary: Json | null
          context_settings: Json | null
          created_at: string
          hooks: Json | null
          id: string
          selected_hook_index: number | null
          status: string
          updated_at: string
          user_id: string
          video_title: string | null
          video_url: string | null
        }
        Insert: {
          content_summary?: Json | null
          context_settings?: Json | null
          created_at?: string
          hooks?: Json | null
          id?: string
          selected_hook_index?: number | null
          status?: string
          updated_at?: string
          user_id: string
          video_title?: string | null
          video_url?: string | null
        }
        Update: {
          content_summary?: Json | null
          context_settings?: Json | null
          created_at?: string
          hooks?: Json | null
          id?: string
          selected_hook_index?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          video_title?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      video_repo_projects: {
        Row: {
          analysis_text: string | null
          category: string | null
          created_at: string
          custom_name: string | null
          external_task_id: string | null
          generated_video_url: string | null
          id: string
          is_favorite: boolean
          model: string | null
          product_image_url: string | null
          prompt: string | null
          reference_video_url: string | null
          segment_urls: string[] | null
          status: string
          updated_at: string
          user_id: string
          video_prompt: string | null
        }
        Insert: {
          analysis_text?: string | null
          category?: string | null
          created_at?: string
          custom_name?: string | null
          external_task_id?: string | null
          generated_video_url?: string | null
          id?: string
          is_favorite?: boolean
          model?: string | null
          product_image_url?: string | null
          prompt?: string | null
          reference_video_url?: string | null
          segment_urls?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          video_prompt?: string | null
        }
        Update: {
          analysis_text?: string | null
          category?: string | null
          created_at?: string
          custom_name?: string | null
          external_task_id?: string | null
          generated_video_url?: string | null
          id?: string
          is_favorite?: boolean
          model?: string | null
          product_image_url?: string | null
          prompt?: string | null
          reference_video_url?: string | null
          segment_urls?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          video_prompt?: string | null
        }
        Relationships: []
      }
      video_tasks: {
        Row: {
          created_at: string
          id: string
          model: string | null
          prompt: string | null
          scene_number: number | null
          source: string | null
          source_id: string | null
          status: string
          task_id: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          prompt?: string | null
          scene_number?: number | null
          source?: string | null
          source_id?: string | null
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          prompt?: string | null
          scene_number?: number | null
          source?: string | null
          source_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
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
      vizard_projects: {
        Row: {
          clips: Json
          created_at: string
          error: string | null
          id: string
          source_video_url: string | null
          status: string
          title: string
          transcript: Json | null
          updated_at: string
          user_id: string
          vizard_api_project_id: number | null
          vizard_share_link: string | null
          vizard_videos: Json | null
        }
        Insert: {
          clips?: Json
          created_at?: string
          error?: string | null
          id?: string
          source_video_url?: string | null
          status?: string
          title?: string
          transcript?: Json | null
          updated_at?: string
          user_id: string
          vizard_api_project_id?: number | null
          vizard_share_link?: string | null
          vizard_videos?: Json | null
        }
        Update: {
          clips?: Json
          created_at?: string
          error?: string | null
          id?: string
          source_video_url?: string | null
          status?: string
          title?: string
          transcript?: Json | null
          updated_at?: string
          user_id?: string
          vizard_api_project_id?: number | null
          vizard_share_link?: string | null
          vizard_videos?: Json | null
        }
        Relationships: []
      }
      voiceover_studio_projects: {
        Row: {
          created_at: string
          edited_script: string | null
          final_video_url: string | null
          id: string
          name: string
          new_voiceover_url: string | null
          original_audio_url: string | null
          source_video_url: string | null
          status: string
          transcript: string | null
          updated_at: string
          user_id: string
          voice_source: Json | null
        }
        Insert: {
          created_at?: string
          edited_script?: string | null
          final_video_url?: string | null
          id?: string
          name?: string
          new_voiceover_url?: string | null
          original_audio_url?: string | null
          source_video_url?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          user_id: string
          voice_source?: Json | null
        }
        Update: {
          created_at?: string
          edited_script?: string | null
          final_video_url?: string | null
          id?: string
          name?: string
          new_voiceover_url?: string | null
          original_audio_url?: string | null
          source_video_url?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
          voice_source?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_twins_summary: {
        Args: { _user_id: string }
        Returns: {
          face_description: string
          first_image: string
          gender: string
          google_voice_id: string
          id: string
          image_count: number
          name: string
          voice_cloning_key: string
          voice_engine: string
          voice_sample_url: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      introspect_schema: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
