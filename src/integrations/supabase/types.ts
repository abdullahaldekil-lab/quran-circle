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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action_type: string
          actor_user_id: string | null
          created_at: string
          details: string | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          halaqa_id: string
          id: string
          marked_at: string | null
          note: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          attendance_date?: string
          created_at?: string
          halaqa_id: string
          id?: string
          marked_at?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          halaqa_id?: string
          id?: string
          marked_at?: string | null
          note?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_audit_log: {
        Row: {
          attendance_date: string
          attendance_id: string
          edited_at: string
          edited_by: string
          id: string
          new_status: string
          old_status: string
          student_id: string
        }
        Insert: {
          attendance_date: string
          attendance_id: string
          edited_at?: string
          edited_by: string
          id?: string
          new_status: string
          old_status: string
          student_id: string
        }
        Update: {
          attendance_date?: string
          attendance_id?: string
          edited_at?: string
          edited_by?: string
          id?: string
          new_status?: string
          old_status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_audit_log_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_audit_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          category: string
          created_at: string
          criteria_type: string | null
          description: string | null
          icon: string
          id: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          criteria_type?: string | null
          description?: string | null
          icon?: string
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          criteria_type?: string | null
          description?: string | null
          icon?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      buses: {
        Row: {
          active: boolean
          bus_name: string
          capacity: number
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bus_name: string
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bus_name?: string
          capacity?: number
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string
          id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url: string
          id?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string
          id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_requests: {
        Row: {
          assigned_halaqa_id: string | null
          converted_guardian_id: string | null
          converted_student_id: string | null
          created_at: string
          guardian_full_name: string
          guardian_phone: string
          id: string
          ip_address: string | null
          notes: string | null
          preferred_time: string | null
          rejection_reason: string | null
          requested_halaqa_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["enrollment_request_status"]
          student_birth_year: number | null
          student_full_name: string
          updated_at: string
        }
        Insert: {
          assigned_halaqa_id?: string | null
          converted_guardian_id?: string | null
          converted_student_id?: string | null
          created_at?: string
          guardian_full_name: string
          guardian_phone: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          preferred_time?: string | null
          rejection_reason?: string | null
          requested_halaqa_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_request_status"]
          student_birth_year?: number | null
          student_full_name: string
          updated_at?: string
        }
        Update: {
          assigned_halaqa_id?: string | null
          converted_guardian_id?: string | null
          converted_student_id?: string | null
          created_at?: string
          guardian_full_name?: string
          guardian_phone?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          preferred_time?: string | null
          rejection_reason?: string | null
          requested_halaqa_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["enrollment_request_status"]
          student_birth_year?: number | null
          student_full_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_requests_assigned_halaqa_id_fkey"
            columns: ["assigned_halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_requested_halaqa_id_fkey"
            columns: ["requested_halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_name: string
          bank_name: string | null
          created_at: string
          created_by: string | null
          iban: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_name: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          iban?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          iban?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          action: string
          details: string | null
          id: string
          performed_at: string
          performed_by: string | null
          transaction_id: string | null
        }
        Insert: {
          action: string
          details?: string | null
          id?: string
          performed_at?: string
          performed_by?: string | null
          transaction_id?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          id?: string
          performed_at?: string
          performed_by?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_url: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          reference_number: string | null
          status: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          status?: string
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_url?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          reference_number?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guardian_students: {
        Row: {
          active: boolean
          created_at: string
          guardian_id: string
          id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          guardian_id: string
          id?: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          guardian_id?: string
          id?: string
          relationship?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_students_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardian_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      halaqat: {
        Row: {
          active: boolean
          assistant_teacher_id: string | null
          capacity_max: number
          created_at: string
          id: string
          location: string | null
          name: string
          schedule: string | null
          teacher_id: string | null
        }
        Insert: {
          active?: boolean
          assistant_teacher_id?: string | null
          capacity_max?: number
          created_at?: string
          id?: string
          location?: string | null
          name: string
          schedule?: string | null
          teacher_id?: string | null
        }
        Update: {
          active?: boolean
          assistant_teacher_id?: string | null
          capacity_max?: number
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          schedule?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "halaqat_assistant_teacher_id_fkey"
            columns: ["assistant_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "halaqat_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string
          holiday_type: string
          id: string
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date: string
          holiday_type?: string
          id?: string
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string
          holiday_type?: string
          id?: string
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instructions: {
        Row: {
          body: string | null
          created_at: string
          from_manager_id: string
          id: string
          priority: string | null
          status: Database["public"]["Enums"]["instruction_status"]
          teacher_comment: string | null
          title: string
          to_teacher_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_manager_id: string
          id?: string
          priority?: string | null
          status?: Database["public"]["Enums"]["instruction_status"]
          teacher_comment?: string | null
          title: string
          to_teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_manager_id?: string
          id?: string
          priority?: string | null
          status?: Database["public"]["Enums"]["instruction_status"]
          teacher_comment?: string | null
          title?: string
          to_teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructions_from_manager_id_fkey"
            columns: ["from_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructions_to_teacher_id_fkey"
            columns: ["to_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memorization_levels: {
        Row: {
          active: boolean
          created_at: string
          daily_target: string | null
          description: string | null
          id: string
          name: string
          review_requirement: string | null
          sort_order: number
          suitable_for: string | null
          target_memorization: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_target?: string | null
          description?: string | null
          id?: string
          name: string
          review_requirement?: string | null
          sort_order?: number
          suitable_for?: string | null
          target_memorization?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_target?: string | null
          description?: string | null
          id?: string
          name?: string
          review_requirement?: string | null
          sort_order?: number
          suitable_for?: string | null
          target_memorization?: string | null
        }
        Relationships: []
      }
      pre_registrations: {
        Row: {
          converted_student_id: string | null
          created_at: string
          created_by: string | null
          guardian_full_name: string
          guardian_phone: string | null
          id: string
          relationship: string | null
          requested_halaqa: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["pre_registration_status"]
          student_full_name: string
          student_notes: string | null
          updated_at: string
        }
        Insert: {
          converted_student_id?: string | null
          created_at?: string
          created_by?: string | null
          guardian_full_name: string
          guardian_phone?: string | null
          id?: string
          relationship?: string | null
          requested_halaqa?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pre_registration_status"]
          student_full_name: string
          student_notes?: string | null
          updated_at?: string
        }
        Update: {
          converted_student_id?: string | null
          created_at?: string
          created_by?: string | null
          guardian_full_name?: string
          guardian_phone?: string | null
          id?: string
          relationship?: string | null
          requested_halaqa?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pre_registration_status"]
          student_full_name?: string
          student_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_registrations_converted_student_id_fkey"
            columns: ["converted_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_registrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preparation_config: {
        Row: {
          base_prayer: string
          duration_minutes: number
          id: string
          offset_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_prayer?: string
          duration_minutes?: number
          id?: string
          offset_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_prayer?: string
          duration_minutes?: number
          id?: string
          offset_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preparation_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          last_login_at: string | null
          phone: string | null
          position_title: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          last_login_at?: string | null
          phone?: string | null
          position_title?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          last_login_at?: string | null
          phone?: string | null
          position_title?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      recitation_records: {
        Row: {
          audio_url: string | null
          created_at: string
          halaqa_id: string
          id: string
          memorization_quality: number | null
          memorized_from: string | null
          memorized_to: string | null
          mistakes_count: number | null
          notes: string | null
          record_date: string
          review_from: string | null
          review_to: string | null
          student_id: string
          tajweed_score: number | null
          teacher_id: string | null
          total_score: number | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          halaqa_id: string
          id?: string
          memorization_quality?: number | null
          memorized_from?: string | null
          memorized_to?: string | null
          mistakes_count?: number | null
          notes?: string | null
          record_date?: string
          review_from?: string | null
          review_to?: string | null
          student_id: string
          tajweed_score?: number | null
          teacher_id?: string | null
          total_score?: number | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          halaqa_id?: string
          id?: string
          memorization_quality?: number | null
          memorized_from?: string | null
          memorized_to?: string | null
          mistakes_count?: number | null
          notes?: string | null
          record_date?: string
          review_from?: string | null
          review_to?: string | null
          student_id?: string
          tajweed_score?: number | null
          teacher_id?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recitation_records_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recitation_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recitation_records_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_nominations: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          nominated_by: string
          note: string | null
          reward_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          nominated_by: string
          note?: string | null
          reward_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          nominated_by?: string
          note?: string | null
          reward_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_nominations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_nominations_nominated_by_fkey"
            columns: ["nominated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_nominations_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_nominations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          points_required: number | null
          reward_type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          points_required?: number | null
          reward_type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          points_required?: number | null
          reward_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_change_log: {
        Row: {
          action: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          action: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_change_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_goals: {
        Row: {
          axis: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          is_activated: boolean
          progress_percentage: number
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          axis?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_activated?: boolean
          progress_percentage?: number
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          axis?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          is_activated?: boolean
          progress_percentage?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          goal_id: string
          id: string
          progress_percentage: number
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          goal_id: string
          id?: string
          progress_percentage?: number
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          goal_id?: string
          id?: string
          progress_percentage?: number
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_objectives_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          notes: string | null
          objective_id: string
          priority: string
          responsible_role: string
          start_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          notes?: string | null
          objective_id: string
          priority?: string
          responsible_role?: string
          start_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          objective_id?: string
          priority?: string
          responsible_role?: string
          start_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategic_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategic_tasks_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "strategic_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          id: string
          note: string | null
          student_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          note?: string | null
          student_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_bus_assignments: {
        Row: {
          active: boolean
          bus_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          active?: boolean
          bus_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          active?: boolean
          bus_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_bus_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_bus_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_points: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string
          source_id: string | null
          source_type: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason: string
          source_id?: string | null
          source_type?: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string
          source_id?: string | null
          source_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          birth_date_gregorian: string | null
          birth_date_hijri: string | null
          created_at: string
          current_level: string | null
          full_name: string
          guardian_name: string | null
          guardian_phone: string | null
          halaqa_id: string | null
          id: string
          join_date: string
          notes: string | null
          status: Database["public"]["Enums"]["student_status"]
          total_memorized_pages: number | null
          updated_at: string
        }
        Insert: {
          birth_date_gregorian?: string | null
          birth_date_hijri?: string | null
          created_at?: string
          current_level?: string | null
          full_name: string
          guardian_name?: string | null
          guardian_phone?: string | null
          halaqa_id?: string | null
          id?: string
          join_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          total_memorized_pages?: number | null
          updated_at?: string
        }
        Update: {
          birth_date_gregorian?: string | null
          birth_date_hijri?: string | null
          created_at?: string
          current_level?: string | null
          full_name?: string
          guardian_name?: string | null
          guardian_phone?: string | null
          halaqa_id?: string | null
          id?: string
          join_date?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          total_memorized_pages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      temporary_access_overrides: {
        Row: {
          created_at: string
          end_date: string
          granted_by: string
          halaqa_id: string
          id: string
          reason: string | null
          start_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date: string
          granted_by: string
          halaqa_id: string
          id?: string
          reason?: string | null
          start_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string
          granted_by?: string
          halaqa_id?: string
          id?: string
          reason?: string | null
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "temporary_access_overrides_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_access_overrides_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "temporary_access_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_attendance: {
        Row: {
          created_at: string
          id: string
          note: string | null
          status: string
          student_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          student_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          status?: string
          student_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_attendance_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_halaqat: {
        Row: {
          created_at: string
          halaqa_id: string
          id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          halaqa_id: string
          id?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          halaqa_id?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_halaqat_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_halaqat_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_status_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          trip_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          trip_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_status_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          estimated_return_time: string | null
          halaqa_id: string | null
          id: string
          location: string | null
          start_time: string | null
          status: string
          supervising_teacher_id: string | null
          title: string
          trip_date: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          estimated_return_time?: string | null
          halaqa_id?: string | null
          id?: string
          location?: string | null
          start_time?: string | null
          status?: string
          supervising_teacher_id?: string | null
          title: string
          trip_date: string
          trip_type?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          estimated_return_time?: string | null
          halaqa_id?: string | null
          id?: string
          location?: string | null
          start_time?: string | null
          status?: string
          supervising_teacher_id?: string | null
          title?: string
          trip_date?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_supervising_teacher_id_fkey"
            columns: ["supervising_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_role: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      attendance_status: "present" | "absent" | "late" | "excused"
      enrollment_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "waiting_list"
      instruction_status: "new" | "in_progress" | "completed"
      pre_registration_status:
        | "new"
        | "under_review"
        | "approved"
        | "rejected"
        | "waiting_list"
      staff_role:
        | "manager"
        | "secretary"
        | "supervisor"
        | "assistant_supervisor"
        | "admin_staff"
        | "teacher"
        | "assistant_teacher"
      student_status: "active" | "inactive" | "graduated" | "suspended"
      transaction_type: "income" | "expense"
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
      attendance_status: ["present", "absent", "late", "excused"],
      enrollment_request_status: [
        "pending",
        "approved",
        "rejected",
        "waiting_list",
      ],
      instruction_status: ["new", "in_progress", "completed"],
      pre_registration_status: [
        "new",
        "under_review",
        "approved",
        "rejected",
        "waiting_list",
      ],
      staff_role: [
        "manager",
        "secretary",
        "supervisor",
        "assistant_supervisor",
        "admin_staff",
        "teacher",
        "assistant_teacher",
      ],
      student_status: ["active", "inactive", "graduated", "suspended"],
      transaction_type: ["income", "expense"],
    },
  },
} as const
