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
      distinguished_students: {
        Row: {
          added_by: string | null
          date_added: string
          id: string
          is_star: boolean
          notes: string | null
          student_id: string
          track_id: string
        }
        Insert: {
          added_by?: string | null
          date_added?: string
          id?: string
          is_star?: boolean
          notes?: string | null
          student_id: string
          track_id: string
        }
        Update: {
          added_by?: string | null
          date_added?: string
          id?: string
          is_star?: boolean
          notes?: string | null
          student_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distinguished_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distinguished_students_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "excellence_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string
          file_size: number | null
          file_type: string | null
          file_url: string | null
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
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
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
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
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
          form_data: Json | null
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
          form_data?: Json | null
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
          form_data?: Json | null
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
      excellence_attendance: {
        Row: {
          created_at: string
          id: string
          is_present: boolean
          notes: string | null
          session_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_present?: boolean
          notes?: string | null
          session_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_present?: boolean
          notes?: string | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excellence_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "excellence_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_elite_students: {
        Row: {
          added_by: string | null
          created_at: string
          halaqa_id: string
          id: string
          notes: string | null
          student_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          halaqa_id: string
          id?: string
          notes?: string | null
          student_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          halaqa_id?: string
          id?: string
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excellence_elite_students_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_monthly_report: {
        Row: {
          average_score: number | null
          created_at: string
          final_rank: number | null
          halaqa_id: string | null
          id: string
          month: number
          student_id: string
          total_attendance: number | null
          total_hizb: number | null
          total_pages: number | null
          total_sessions: number | null
          updated_at: string
          year: number
        }
        Insert: {
          average_score?: number | null
          created_at?: string
          final_rank?: number | null
          halaqa_id?: string | null
          id?: string
          month: number
          student_id: string
          total_attendance?: number | null
          total_hizb?: number | null
          total_pages?: number | null
          total_sessions?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          average_score?: number | null
          created_at?: string
          final_rank?: number | null
          halaqa_id?: string | null
          id?: string
          month?: number
          student_id?: string
          total_attendance?: number | null
          total_hizb?: number | null
          total_pages?: number | null
          total_sessions?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "excellence_monthly_report_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_performance: {
        Row: {
          created_at: string
          hizb_count: number | null
          id: string
          lahon_count: number | null
          mistakes_count: number | null
          pages_displayed: number | null
          rank_in_group: number | null
          session_id: string
          student_id: string
          total_score: number | null
          updated_at: string
          warnings_count: number | null
        }
        Insert: {
          created_at?: string
          hizb_count?: number | null
          id?: string
          lahon_count?: number | null
          mistakes_count?: number | null
          pages_displayed?: number | null
          rank_in_group?: number | null
          session_id: string
          student_id: string
          total_score?: number | null
          updated_at?: string
          warnings_count?: number | null
        }
        Update: {
          created_at?: string
          hizb_count?: number | null
          id?: string
          lahon_count?: number | null
          mistakes_count?: number | null
          pages_displayed?: number | null
          rank_in_group?: number | null
          session_id?: string
          student_id?: string
          total_score?: number | null
          updated_at?: string
          warnings_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "excellence_performance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "excellence_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          halaqa_id: string | null
          id: string
          notes: string | null
          session_date: string
          session_hijri_date: string | null
          total_hizb_in_session: number | null
          total_pages_displayed: number | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          halaqa_id?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_hijri_date?: string | null
          total_hizb_in_session?: number | null
          total_pages_displayed?: number | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          halaqa_id?: string | null
          id?: string
          notes?: string | null
          session_date?: string
          session_hijri_date?: string | null
          total_hizb_in_session?: number | null
          total_pages_displayed?: number | null
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excellence_sessions_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excellence_sessions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "excellence_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_settings: {
        Row: {
          created_at: string
          deduction_per_lahn: number
          deduction_per_mistake: number
          deduction_per_warning: number
          id: string
          max_grade: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduction_per_lahn?: number
          deduction_per_mistake?: number
          deduction_per_warning?: number
          id?: string
          max_grade?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduction_per_lahn?: number
          deduction_per_mistake?: number
          deduction_per_warning?: number
          id?: string
          max_grade?: number
          updated_at?: string
        }
        Relationships: []
      }
      excellence_track_settings: {
        Row: {
          auto_notify_parent: boolean | null
          auto_remove_on_failure: boolean | null
          created_at: string
          id: string
          min_attendance_rate: number | null
          min_hizb_count: number | null
          min_monthly_performance: number | null
          track_id: string
          updated_at: string
        }
        Insert: {
          auto_notify_parent?: boolean | null
          auto_remove_on_failure?: boolean | null
          created_at?: string
          id?: string
          min_attendance_rate?: number | null
          min_hizb_count?: number | null
          min_monthly_performance?: number | null
          track_id: string
          updated_at?: string
        }
        Update: {
          auto_notify_parent?: boolean | null
          auto_remove_on_failure?: boolean | null
          created_at?: string
          id?: string
          min_attendance_rate?: number | null
          min_hizb_count?: number | null
          min_monthly_performance?: number | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excellence_track_settings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
            referencedRelation: "excellence_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      excellence_tracks: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json | null
          description: string | null
          id: string
          is_active: boolean
          track_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          track_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean
          track_name?: string
          updated_at?: string
        }
        Relationships: []
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
          level_track_id: string | null
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
          level_track_id?: string | null
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
          level_track_id?: string | null
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
            foreignKeyName: "halaqat_level_track_id_fkey"
            columns: ["level_track_id"]
            isOneToOne: false
            referencedRelation: "level_tracks"
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
      internal_request_replies: {
        Row: {
          body: string
          created_at: string
          from_user_id: string
          id: string
          request_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_user_id: string
          id?: string
          request_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_user_id?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_request_replies_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "internal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_requests: {
        Row: {
          body: string | null
          created_at: string
          due_date: string | null
          from_user_id: string
          id: string
          priority: Database["public"]["Enums"]["request_priority"]
          request_type: Database["public"]["Enums"]["request_type"]
          status: Database["public"]["Enums"]["request_status"]
          title: string
          to_role: string | null
          to_user_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          due_date?: string | null
          from_user_id: string
          id?: string
          priority?: Database["public"]["Enums"]["request_priority"]
          request_type?: Database["public"]["Enums"]["request_type"]
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          to_role?: string | null
          to_user_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          due_date?: string | null
          from_user_id?: string
          id?: string
          priority?: Database["public"]["Enums"]["request_priority"]
          request_type?: Database["public"]["Enums"]["request_type"]
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          to_role?: string | null
          to_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      level_branches: {
        Row: {
          branch_number: number
          created_at: string
          description: string | null
          id: string
          level_track_id: string
          sort_order: number
        }
        Insert: {
          branch_number: number
          created_at?: string
          description?: string | null
          id?: string
          level_track_id: string
          sort_order?: number
        }
        Update: {
          branch_number?: number
          created_at?: string
          description?: string | null
          id?: string
          level_track_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_branches_level_track_id_fkey"
            columns: ["level_track_id"]
            isOneToOne: false
            referencedRelation: "level_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      level_parts: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          level_track_id: string
          part_number: number
          sort_order: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          level_track_id: string
          part_number: number
          sort_order?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          level_track_id?: string
          part_number?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "level_parts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "level_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_parts_level_track_id_fkey"
            columns: ["level_track_id"]
            isOneToOne: false
            referencedRelation: "level_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      level_tracks: {
        Row: {
          active: boolean
          branches_count: number
          created_at: string
          description: string | null
          id: string
          level_number: number
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          branches_count?: number
          created_at?: string
          description?: string | null
          id?: string
          level_number: number
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          branches_count?: number
          created_at?: string
          description?: string | null
          id?: string
          level_number?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      madarij_daily_progress: {
        Row: {
          created_at: string
          enrollment_id: string
          execution: string | null
          grade: number | null
          id: string
          linking: string | null
          listening: number | null
          memorization: string | null
          mistakes_count: number | null
          progress_date: string
          repetition_after: number | null
          repetition_before: number | null
          review: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          execution?: string | null
          grade?: number | null
          id?: string
          linking?: string | null
          listening?: number | null
          memorization?: string | null
          mistakes_count?: number | null
          progress_date?: string
          repetition_after?: number | null
          repetition_before?: number | null
          review?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          execution?: string | null
          grade?: number | null
          id?: string
          linking?: string | null
          listening?: number | null
          memorization?: string | null
          mistakes_count?: number | null
          progress_date?: string
          repetition_after?: number | null
          repetition_before?: number | null
          review?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madarij_daily_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "madarij_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_daily_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      madarij_enrollments: {
        Row: {
          branch_id: string | null
          created_at: string
          end_date: string | null
          failed_attempts: number
          hizb_number: number
          id: string
          level_downgraded: boolean
          level_track_id: string | null
          part_number: number
          previous_track_id: string | null
          start_date: string
          status: string
          student_id: string
          track_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          end_date?: string | null
          failed_attempts?: number
          hizb_number?: number
          id?: string
          level_downgraded?: boolean
          level_track_id?: string | null
          part_number?: number
          previous_track_id?: string | null
          start_date?: string
          status?: string
          student_id: string
          track_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          end_date?: string | null
          failed_attempts?: number
          hizb_number?: number
          id?: string
          level_downgraded?: boolean
          level_track_id?: string | null
          part_number?: number
          previous_track_id?: string | null
          start_date?: string
          status?: string
          student_id?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "madarij_enrollments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "level_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_enrollments_level_track_id_fkey"
            columns: ["level_track_id"]
            isOneToOne: false
            referencedRelation: "level_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_enrollments_previous_track_id_fkey"
            columns: ["previous_track_id"]
            isOneToOne: false
            referencedRelation: "madarij_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_enrollments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "madarij_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      madarij_hizb_exams: {
        Row: {
          attempt_number: number
          created_at: string
          enrollment_id: string
          exam_type: string
          examiner_name: string | null
          extra_points: number | null
          failed_reason: string | null
          final_grade: number | null
          id: string
          memorization_grade: number | null
          pass_date: string | null
          passed: boolean | null
          review_total: number | null
          segment1_errors: number | null
          segment1_grade: number | null
          segment1_warnings: number | null
          segment2_errors: number | null
          segment2_grade: number | null
          segment2_warnings: number | null
          segment3_errors: number | null
          segment3_grade: number | null
          segment3_warnings: number | null
          segment4_errors: number | null
          segment4_grade: number | null
          segment4_warnings: number | null
          segment5_errors: number | null
          segment5_grade: number | null
          segment5_warnings: number | null
          student_id: string
          supervisor_approval: string | null
          updated_at: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          enrollment_id: string
          exam_type?: string
          examiner_name?: string | null
          extra_points?: number | null
          failed_reason?: string | null
          final_grade?: number | null
          id?: string
          memorization_grade?: number | null
          pass_date?: string | null
          passed?: boolean | null
          review_total?: number | null
          segment1_errors?: number | null
          segment1_grade?: number | null
          segment1_warnings?: number | null
          segment2_errors?: number | null
          segment2_grade?: number | null
          segment2_warnings?: number | null
          segment3_errors?: number | null
          segment3_grade?: number | null
          segment3_warnings?: number | null
          segment4_errors?: number | null
          segment4_grade?: number | null
          segment4_warnings?: number | null
          segment5_errors?: number | null
          segment5_grade?: number | null
          segment5_warnings?: number | null
          student_id: string
          supervisor_approval?: string | null
          updated_at?: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          enrollment_id?: string
          exam_type?: string
          examiner_name?: string | null
          extra_points?: number | null
          failed_reason?: string | null
          final_grade?: number | null
          id?: string
          memorization_grade?: number | null
          pass_date?: string | null
          passed?: boolean | null
          review_total?: number | null
          segment1_errors?: number | null
          segment1_grade?: number | null
          segment1_warnings?: number | null
          segment2_errors?: number | null
          segment2_grade?: number | null
          segment2_warnings?: number | null
          segment3_errors?: number | null
          segment3_grade?: number | null
          segment3_warnings?: number | null
          segment4_errors?: number | null
          segment4_grade?: number | null
          segment4_warnings?: number | null
          segment5_errors?: number | null
          segment5_grade?: number | null
          segment5_warnings?: number | null
          student_id?: string
          supervisor_approval?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "madarij_hizb_exams_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "madarij_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_hizb_exams_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      madarij_level_changes: {
        Row: {
          changed_by: string | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          new_track_id: string | null
          old_track_id: string | null
          reason: string | null
          student_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          new_track_id?: string | null
          old_track_id?: string | null
          reason?: string | null
          student_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          new_track_id?: string | null
          old_track_id?: string | null
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "madarij_level_changes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "madarij_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_level_changes_new_track_id_fkey"
            columns: ["new_track_id"]
            isOneToOne: false
            referencedRelation: "madarij_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_level_changes_old_track_id_fkey"
            columns: ["old_track_id"]
            isOneToOne: false
            referencedRelation: "madarij_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_level_changes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      madarij_mistakes: {
        Row: {
          ayah: string | null
          created_at: string
          enrollment_id: string
          id: string
          mistake_text: string
          student_id: string
          surah: string | null
        }
        Insert: {
          ayah?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          mistake_text: string
          student_id: string
          surah?: string | null
        }
        Update: {
          ayah?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          mistake_text?: string
          student_id?: string
          surah?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "madarij_mistakes_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "madarij_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "madarij_mistakes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      madarij_tracks: {
        Row: {
          active: boolean
          created_at: string
          days_required: number
          description: string | null
          id: string
          name: string
          repetition_rules: Json | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_required?: number
          description?: string | null
          id?: string
          name: string
          repetition_rules?: Json | null
        }
        Update: {
          active?: boolean
          created_at?: string
          days_required?: number
          description?: string | null
          id?: string
          name?: string
          repetition_rules?: Json | null
        }
        Relationships: []
      }
      memorization_levels: {
        Row: {
          active: boolean
          created_at: string
          daily_target: string | null
          description: string | null
          id: string
          madarij_track_id: string | null
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
          madarij_track_id?: string | null
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
          madarij_track_id?: string | null
          name?: string
          review_requirement?: string | null
          sort_order?: number
          suitable_for?: string | null
          target_memorization?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memorization_levels_madarij_track_id_fkey"
            columns: ["madarij_track_id"]
            isOneToOne: false
            referencedRelation: "madarij_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_attempts: {
        Row: {
          created_at: string
          grade: number
          id: string
          lahn_count: number
          manual_entry: boolean
          mistakes_count: number
          narration_type: string
          notes: string | null
          session_id: string
          status: string
          student_id: string
          total_hizb_count: number
          total_pages_approx: number
          updated_at: string
          warnings_count: number
        }
        Insert: {
          created_at?: string
          grade?: number
          id?: string
          lahn_count?: number
          manual_entry?: boolean
          mistakes_count?: number
          narration_type?: string
          notes?: string | null
          session_id: string
          status?: string
          student_id: string
          total_hizb_count?: number
          total_pages_approx?: number
          updated_at?: string
          warnings_count?: number
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          lahn_count?: number
          manual_entry?: boolean
          mistakes_count?: number
          narration_type?: string
          notes?: string | null
          session_id?: string
          status?: string
          student_id?: string
          total_hizb_count?: number
          total_pages_approx?: number
          updated_at?: string
          warnings_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "narration_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "narration_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_goals: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          halaqa_id: string
          id: string
          notes: string | null
          semester: string
          start_date: string
          target_hizb_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          halaqa_id: string
          id?: string
          notes?: string | null
          semester?: string
          start_date?: string
          target_hizb_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          halaqa_id?: string
          id?: string
          notes?: string | null
          semester?: string
          start_date?: string
          target_hizb_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narration_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_goals_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_ranges: {
        Row: {
          attempt_id: string
          created_at: string
          from_hizb: number
          hizb_count: number
          id: string
          section: string
          to_hizb: number
        }
        Insert: {
          attempt_id: string
          created_at?: string
          from_hizb?: number
          hizb_count?: number
          id?: string
          section?: string
          to_hizb?: number
        }
        Update: {
          attempt_id?: string
          created_at?: string
          from_hizb?: number
          hizb_count?: number
          id?: string
          section?: string
          to_hizb?: number
        }
        Relationships: [
          {
            foreignKeyName: "narration_ranges_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "narration_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_results: {
        Row: {
          created_at: string
          grade: number
          hizb_from: number
          hizb_to: number
          id: string
          lahn_count: number
          manual_entry: boolean
          mistakes_count: number
          notes: string | null
          session_id: string
          status: string
          student_id: string
          total_hizbat: number
          updated_at: string
          warnings_count: number
        }
        Insert: {
          created_at?: string
          grade?: number
          hizb_from?: number
          hizb_to?: number
          id?: string
          lahn_count?: number
          manual_entry?: boolean
          mistakes_count?: number
          notes?: string | null
          session_id: string
          status?: string
          student_id: string
          total_hizbat?: number
          updated_at?: string
          warnings_count?: number
        }
        Update: {
          created_at?: string
          grade?: number
          hizb_from?: number
          hizb_to?: number
          id?: string
          lahn_count?: number
          manual_entry?: boolean
          mistakes_count?: number
          notes?: string | null
          session_id?: string
          status?: string
          student_id?: string
          total_hizbat?: number
          updated_at?: string
          warnings_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "narration_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "narration_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          external_teacher_name: string | null
          external_teacher_phone: string | null
          halaqa_id: string | null
          hizb_from: number | null
          hizb_to: number | null
          id: string
          notes: string | null
          session_date: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_teacher_name?: string | null
          external_teacher_phone?: string | null
          halaqa_id?: string | null
          hizb_from?: number | null
          hizb_to?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_teacher_name?: string | null
          external_teacher_phone?: string | null
          halaqa_id?: string | null
          hizb_from?: number | null
          hizb_to?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "narration_sessions_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      narration_settings: {
        Row: {
          created_at: string
          deduction_per_lahn: number
          deduction_per_mistake: number
          deduction_per_warning: number
          id: string
          mastery_weight: number
          max_grade: number
          memorization_weight: number
          min_grade: number
          min_hizb_required: number
          min_pages_required: number
          pages_per_hizb: number
          performance_weight: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deduction_per_lahn?: number
          deduction_per_mistake?: number
          deduction_per_warning?: number
          id?: string
          mastery_weight?: number
          max_grade?: number
          memorization_weight?: number
          min_grade?: number
          min_hizb_required?: number
          min_pages_required?: number
          pages_per_hizb?: number
          performance_weight?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deduction_per_lahn?: number
          deduction_per_mistake?: number
          deduction_per_warning?: number
          id?: string
          mastery_weight?: number
          max_grade?: number
          memorization_weight?: number
          min_grade?: number
          min_hizb_required?: number
          min_pages_required?: number
          pages_per_hizb?: number
          performance_weight?: number
          updated_at?: string
        }
        Relationships: []
      }
      narration_test_results: {
        Row: {
          attempt_number: number
          created_at: string
          created_by: string | null
          halaqa_id: string
          hizb_number: number | null
          id: string
          mistakes: number
          narration_score: number
          notes: string | null
          passed: boolean
          sections: Json | null
          student_id: string
          test_date: string
          test_type: string
          total_score: number
          warnings: number
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          created_by?: string | null
          halaqa_id: string
          hizb_number?: number | null
          id?: string
          mistakes?: number
          narration_score?: number
          notes?: string | null
          passed?: boolean
          sections?: Json | null
          student_id: string
          test_date?: string
          test_type?: string
          total_score?: number
          warnings?: number
        }
        Update: {
          attempt_number?: number
          created_at?: string
          created_by?: string | null
          halaqa_id?: string
          hizb_number?: number | null
          id?: string
          mistakes?: number
          narration_score?: number
          notes?: string | null
          passed?: boolean
          sections?: Json | null
          student_id?: string
          test_date?: string
          test_type?: string
          total_score?: number
          warnings?: number
        }
        Relationships: [
          {
            foreignKeyName: "narration_test_results_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "narration_test_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          category: string
          code: string
          created_at: string
          default_channels: string[]
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          code: string
          created_at?: string
          default_channels?: string[]
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          code?: string
          created_at?: string
          default_channels?: string[]
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          meta_data: Json | null
          read_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          meta_data?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          meta_data?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          name_ar: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          name_ar: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          name_ar?: string
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
          assigned_assistant_halaqa_id: string | null
          assigned_halaqa_id: string | null
          avatar_url: string | null
          created_at: string
          department: string | null
          full_name: string
          id: string
          is_reserve: boolean
          is_staff: boolean
          job_title: string | null
          last_login_at: string | null
          phone: string | null
          position_title: string | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_assistant_halaqa_id?: string | null
          assigned_halaqa_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name: string
          id: string
          is_reserve?: boolean
          is_staff?: boolean
          job_title?: string | null
          last_login_at?: string | null
          phone?: string | null
          position_title?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_assistant_halaqa_id?: string | null
          assigned_halaqa_id?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          is_reserve?: boolean
          is_staff?: boolean
          job_title?: string | null
          last_login_at?: string | null
          phone?: string | null
          position_title?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_assistant_halaqa_id_fkey"
            columns: ["assigned_assistant_halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_assigned_halaqa_id_fkey"
            columns: ["assigned_halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          expected_answer: string | null
          id: string
          is_correct: boolean | null
          question_number: number
          question_text: string
          question_type: string
          quiz_id: string
          student_answer: string | null
          teacher_note: string | null
        }
        Insert: {
          created_at?: string
          expected_answer?: string | null
          id?: string
          is_correct?: boolean | null
          question_number: number
          question_text: string
          question_type: string
          quiz_id: string
          student_answer?: string | null
          teacher_note?: string | null
        }
        Update: {
          created_at?: string
          expected_answer?: string | null
          id?: string
          is_correct?: boolean | null
          question_number?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
          student_answer?: string | null
          teacher_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "student_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      recitation_records: {
        Row: {
          audio_url: string | null
          created_at: string
          halaqa_id: string
          id: string
          linking_from: string | null
          linking_to: string | null
          memorization_quality: number | null
          memorized_from: string | null
          memorized_to: string | null
          mistakes_breakdown: Json | null
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
          linking_from?: string | null
          linking_to?: string | null
          memorization_quality?: number | null
          memorized_from?: string | null
          memorized_to?: string | null
          mistakes_breakdown?: Json | null
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
          linking_from?: string | null
          linking_to?: string | null
          memorization_quality?: number | null
          memorized_from?: string | null
          memorized_to?: string | null
          mistakes_breakdown?: Json | null
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
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          name_ar: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          name_ar: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          name_ar?: string
        }
        Relationships: []
      }
      staff_attendance: {
        Row: {
          attendance_date: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          early_leave_minutes: number
          id: string
          late_minutes: number
          notes: string | null
          shift_id: string | null
          staff_id: string
          status: string
          total_work_minutes: number
          updated_at: string
        }
        Insert: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          notes?: string | null
          shift_id?: string | null
          staff_id: string
          status?: string
          total_work_minutes?: number
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          early_leave_minutes?: number
          id?: string
          late_minutes?: number
          notes?: string | null
          shift_id?: string | null
          staff_id?: string
          status?: string
          total_work_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "staff_attendance_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_shifts: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          grace_in_minutes: number
          grace_out_minutes: number
          id: string
          name: string
          start_time: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          grace_in_minutes?: number
          grace_out_minutes?: number
          id?: string
          name: string
          start_time: string
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          grace_in_minutes?: number
          grace_out_minutes?: number
          id?: string
          name?: string
          start_time?: string
        }
        Relationships: []
      }
      staff_task_comments: {
        Row: {
          body: string
          created_at: string | null
          from_user_id: string
          id: string
          task_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          from_user_id: string
          id?: string
          task_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          from_user_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "staff_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          actual_minutes: number | null
          assigned_by: string | null
          assigned_to: string | null
          assigned_to_role: string | null
          attachments: Json | null
          category: string
          completed_at: string | null
          completion_note: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          estimated_minutes: number | null
          id: string
          priority: string
          recurrence: string | null
          reminder_at: string | null
          reminder_sent: boolean | null
          started_at: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_minutes?: number | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_role?: string | null
          attachments?: Json | null
          category?: string
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string
          recurrence?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean | null
          started_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_minutes?: number | null
          assigned_by?: string | null
          assigned_to?: string | null
          assigned_to_role?: string | null
          attachments?: Json | null
          category?: string
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          estimated_minutes?: number | null
          id?: string
          priority?: string
          recurrence?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean | null
          started_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
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
      student_annual_plans: {
        Row: {
          academic_year: string
          created_at: string
          created_by: string | null
          daily_linking_pages: number | null
          daily_memorization_pages: number | null
          daily_review_pages: number | null
          daily_target_pages: number
          end_date: string | null
          halaqa_id: string
          id: string
          plan_type: string
          previous_memorized_from: string | null
          previous_memorized_pages: number | null
          previous_memorized_to: string | null
          start_date: string
          status: string
          student_id: string
          total_target_pages: number
          updated_at: string
          working_days_per_week: number
        }
        Insert: {
          academic_year?: string
          created_at?: string
          created_by?: string | null
          daily_linking_pages?: number | null
          daily_memorization_pages?: number | null
          daily_review_pages?: number | null
          daily_target_pages?: number
          end_date?: string | null
          halaqa_id: string
          id?: string
          plan_type?: string
          previous_memorized_from?: string | null
          previous_memorized_pages?: number | null
          previous_memorized_to?: string | null
          start_date?: string
          status?: string
          student_id: string
          total_target_pages?: number
          updated_at?: string
          working_days_per_week?: number
        }
        Update: {
          academic_year?: string
          created_at?: string
          created_by?: string | null
          daily_linking_pages?: number | null
          daily_memorization_pages?: number | null
          daily_review_pages?: number | null
          daily_target_pages?: number
          end_date?: string | null
          halaqa_id?: string
          id?: string
          plan_type?: string
          previous_memorized_from?: string | null
          previous_memorized_pages?: number | null
          previous_memorized_to?: string | null
          start_date?: string
          status?: string
          student_id?: string
          total_target_pages?: number
          updated_at?: string
          working_days_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_annual_plans_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_annual_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          source_detail: string | null
          student_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          note?: string | null
          source_detail?: string | null
          student_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          note?: string | null
          source_detail?: string | null
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
          guardian_phone_override: string | null
          id: string
          student_id: string
        }
        Insert: {
          active?: boolean
          bus_id: string
          created_at?: string
          guardian_phone_override?: string | null
          id?: string
          student_id: string
        }
        Update: {
          active?: boolean
          bus_id?: string
          created_at?: string
          guardian_phone_override?: string | null
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
      student_levels: {
        Row: {
          branch_id: string | null
          completion_date: string | null
          created_at: string
          id: string
          level_track_id: string
          part_number: number
          progress_percentage: number
          start_date: string
          student_id: string
          updated_at: string
          updated_by_manager: boolean
        }
        Insert: {
          branch_id?: string | null
          completion_date?: string | null
          created_at?: string
          id?: string
          level_track_id: string
          part_number?: number
          progress_percentage?: number
          start_date?: string
          student_id: string
          updated_at?: string
          updated_by_manager?: boolean
        }
        Update: {
          branch_id?: string | null
          completion_date?: string | null
          created_at?: string
          id?: string
          level_track_id?: string
          part_number?: number
          progress_percentage?: number
          start_date?: string
          student_id?: string
          updated_at?: string
          updated_by_manager?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_levels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "level_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_levels_level_track_id_fkey"
            columns: ["level_track_id"]
            isOneToOne: false
            referencedRelation: "level_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_levels_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_plan_progress: {
        Row: {
          actual_linking: number | null
          actual_memorization: number | null
          actual_pages: number
          actual_review: number | null
          attendance_days: number
          commitment_percentage: number
          created_at: string
          id: string
          month_number: number
          notes: string | null
          plan_id: string
          status: string
          student_id: string
          target_pages: number
          updated_at: string
          week_number: number
        }
        Insert: {
          actual_linking?: number | null
          actual_memorization?: number | null
          actual_pages?: number
          actual_review?: number | null
          attendance_days?: number
          commitment_percentage?: number
          created_at?: string
          id?: string
          month_number?: number
          notes?: string | null
          plan_id: string
          status?: string
          student_id: string
          target_pages?: number
          updated_at?: string
          week_number?: number
        }
        Update: {
          actual_linking?: number | null
          actual_memorization?: number | null
          actual_pages?: number
          actual_review?: number | null
          attendance_days?: number
          commitment_percentage?: number
          created_at?: string
          id?: string
          month_number?: number
          notes?: string | null
          plan_id?: string
          status?: string
          student_id?: string
          target_pages?: number
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_plan_progress_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "student_annual_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_plan_progress_student_id_fkey"
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
      student_quizzes: {
        Row: {
          correct_answers: number | null
          created_at: string
          difficulty: string
          grade_label: string | null
          halaqa_id: string | null
          id: string
          memorized_content: string | null
          notes: string | null
          quiz_date: string
          score: number | null
          status: string
          student_id: string
          teacher_id: string | null
          total_questions: number
          updated_at: string
        }
        Insert: {
          correct_answers?: number | null
          created_at?: string
          difficulty?: string
          grade_label?: string | null
          halaqa_id?: string | null
          id?: string
          memorized_content?: string | null
          notes?: string | null
          quiz_date?: string
          score?: number | null
          status?: string
          student_id: string
          teacher_id?: string | null
          total_questions?: number
          updated_at?: string
        }
        Update: {
          correct_answers?: number | null
          created_at?: string
          difficulty?: string
          grade_label?: string | null
          halaqa_id?: string | null
          id?: string
          memorized_content?: string | null
          notes?: string | null
          quiz_date?: string
          score?: number | null
          status?: string
          student_id?: string
          teacher_id?: string | null
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_quizzes_halaqa_id_fkey"
            columns: ["halaqa_id"]
            isOneToOne: false
            referencedRelation: "halaqat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_quizzes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_quizzes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_status_log: {
        Row: {
          changed_by: string | null
          changed_by_name: string | null
          created_at: string
          id: string
          is_system: boolean
          new_status: string
          old_status: string | null
          reason_category: string
          reason_detail: string | null
          student_id: string
          transfer_destination: string | null
        }
        Insert: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          new_status: string
          old_status?: string | null
          reason_category?: string
          reason_detail?: string | null
          student_id: string
          transfer_destination?: string | null
        }
        Update: {
          changed_by?: string | null
          changed_by_name?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          new_status?: string
          old_status?: string | null
          reason_category?: string
          reason_detail?: string | null
          student_id?: string
          transfer_destination?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_status_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          accompanied_by: string | null
          birth_date_gregorian: string | null
          birth_date_hijri: string | null
          created_at: string
          current_level: string | null
          father_alive: boolean | null
          full_name: string
          grade: string | null
          guardian_name: string | null
          guardian_national_id: string | null
          guardian_phone: string | null
          guardian_phone_alt: string | null
          guardian_relation: string | null
          guardian_work: string | null
          halaqa_id: string | null
          has_anemia: boolean | null
          has_asthma: boolean | null
          has_chest_sensitivity: boolean | null
          has_diabetes: boolean | null
          has_epilepsy: boolean | null
          has_frequent_urination: boolean | null
          has_hearing_impairment: boolean | null
          has_hypertension: boolean | null
          has_vision_impairment: boolean | null
          id: string
          inactivation_date: string | null
          inactivation_reason: string | null
          join_date: string
          lives_with: string | null
          lives_with_other: string | null
          memorization_amount: string | null
          mother_alive: boolean | null
          national_id: string | null
          nationality: string | null
          notes: string | null
          other_health_conditions: string | null
          previously_enrolled: boolean | null
          registration_date_hijri: string | null
          residence_location: string | null
          school_name: string | null
          status: Database["public"]["Enums"]["student_status"]
          student_phone: string | null
          total_memorized_pages: number | null
          transfer_destination: string | null
          updated_at: string
          warning_level: number | null
        }
        Insert: {
          accompanied_by?: string | null
          birth_date_gregorian?: string | null
          birth_date_hijri?: string | null
          created_at?: string
          current_level?: string | null
          father_alive?: boolean | null
          full_name: string
          grade?: string | null
          guardian_name?: string | null
          guardian_national_id?: string | null
          guardian_phone?: string | null
          guardian_phone_alt?: string | null
          guardian_relation?: string | null
          guardian_work?: string | null
          halaqa_id?: string | null
          has_anemia?: boolean | null
          has_asthma?: boolean | null
          has_chest_sensitivity?: boolean | null
          has_diabetes?: boolean | null
          has_epilepsy?: boolean | null
          has_frequent_urination?: boolean | null
          has_hearing_impairment?: boolean | null
          has_hypertension?: boolean | null
          has_vision_impairment?: boolean | null
          id?: string
          inactivation_date?: string | null
          inactivation_reason?: string | null
          join_date?: string
          lives_with?: string | null
          lives_with_other?: string | null
          memorization_amount?: string | null
          mother_alive?: boolean | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          other_health_conditions?: string | null
          previously_enrolled?: boolean | null
          registration_date_hijri?: string | null
          residence_location?: string | null
          school_name?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_phone?: string | null
          total_memorized_pages?: number | null
          transfer_destination?: string | null
          updated_at?: string
          warning_level?: number | null
        }
        Update: {
          accompanied_by?: string | null
          birth_date_gregorian?: string | null
          birth_date_hijri?: string | null
          created_at?: string
          current_level?: string | null
          father_alive?: boolean | null
          full_name?: string
          grade?: string | null
          guardian_name?: string | null
          guardian_national_id?: string | null
          guardian_phone?: string | null
          guardian_phone_alt?: string | null
          guardian_relation?: string | null
          guardian_work?: string | null
          halaqa_id?: string | null
          has_anemia?: boolean | null
          has_asthma?: boolean | null
          has_chest_sensitivity?: boolean | null
          has_diabetes?: boolean | null
          has_epilepsy?: boolean | null
          has_frequent_urination?: boolean | null
          has_hearing_impairment?: boolean | null
          has_hypertension?: boolean | null
          has_vision_impairment?: boolean | null
          id?: string
          inactivation_date?: string | null
          inactivation_reason?: string | null
          join_date?: string
          lives_with?: string | null
          lives_with_other?: string | null
          memorization_amount?: string | null
          mother_alive?: boolean | null
          national_id?: string | null
          nationality?: string | null
          notes?: string | null
          other_health_conditions?: string | null
          previously_enrolled?: boolean | null
          registration_date_hijri?: string | null
          residence_location?: string | null
          school_name?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          student_phone?: string | null
          total_memorized_pages?: number | null
          transfer_destination?: string | null
          updated_at?: string
          warning_level?: number | null
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
      talqeen_sessions: {
        Row: {
          created_at: string | null
          from_ayah: number | null
          halaqa_id: string
          id: string
          notes: string | null
          session_date: string
          status: string | null
          surah: string
          to_ayah: number | null
        }
        Insert: {
          created_at?: string | null
          from_ayah?: number | null
          halaqa_id: string
          id?: string
          notes?: string | null
          session_date?: string
          status?: string | null
          surah: string
          to_ayah?: number | null
        }
        Update: {
          created_at?: string | null
          from_ayah?: number | null
          halaqa_id?: string
          id?: string
          notes?: string | null
          session_date?: string
          status?: string | null
          surah?: string
          to_ayah?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "talqeen_sessions_halaqa_id_fkey"
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
      user_notification_preferences: {
        Row: {
          academic_notifications: boolean
          attendance_notifications: boolean
          created_at: string
          enable_email: boolean
          enable_in_app: boolean
          enable_whatsapp: boolean
          id: string
          rewards_notifications: boolean
          system_notifications: boolean
          updated_at: string
          user_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          academic_notifications?: boolean
          attendance_notifications?: boolean
          created_at?: string
          enable_email?: boolean
          enable_in_app?: boolean
          enable_whatsapp?: boolean
          id?: string
          rewards_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          academic_notifications?: boolean
          attendance_notifications?: boolean
          created_at?: string
          enable_email?: boolean
          enable_in_app?: boolean
          enable_whatsapp?: boolean
          id?: string
          rewards_notifications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_enrollment_status: {
        Args: { phone_number: string }
        Returns: {
          created_at: string
          rejection_reason: string
          status: string
          student_full_name: string
        }[]
      }
      get_staff_role: { Args: { _user_id: string }; Returns: string }
      has_permission: {
        Args: { _permission_name: string; _user_id: string }
        Returns: boolean
      }
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
      request_priority: "عاجل" | "عادي" | "منخفض"
      request_status: "new" | "in_progress" | "done" | "rejected"
      request_type:
        | "إجازة"
        | "مستلزمات"
        | "صيانة"
        | "استفسار"
        | "أخرى"
        | "أمر عمل"
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
      request_priority: ["عاجل", "عادي", "منخفض"],
      request_status: ["new", "in_progress", "done", "rejected"],
      request_type: [
        "إجازة",
        "مستلزمات",
        "صيانة",
        "استفسار",
        "أخرى",
        "أمر عمل",
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
