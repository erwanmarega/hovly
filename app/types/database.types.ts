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
      alertes: {
        Row: {
          ancien_prix: number | null
          bien_id: string
          envoyee_le: string
          id: string
          nouveau_prix: number | null
          type: string | null
          vue: boolean
        }
        Insert: {
          ancien_prix?: number | null
          bien_id: string
          envoyee_le?: string
          id?: string
          nouveau_prix?: number | null
          type?: string | null
          vue?: boolean
        }
        Update: {
          ancien_prix?: number | null
          bien_id?: string
          envoyee_le?: string
          id?: string
          nouveau_prix?: number | null
          type?: string | null
          vue?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alertes_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      biens: {
        Row: {
          actif: boolean
          adresse: string | null
          charges: number | null
          checklist: Json
          code_postal: string | null
          compte_rendu: string | null
          created_at: string
          description: string | null
          dpe: string | null
          etage: number | null
          geo_precision: string | null
          geocode_le: string | null
          id: string
          lat: number | null
          lon: number | null
          nb_pieces: number | null
          note_perso: string | null
          photos: string[] | null
          prix: number | null
          rappel_envoye_le: string | null
          site_source: string | null
          statut: string
          surface: number | null
          titre: string | null
          transaction: string
          type_bien: string | null
          updated_at: string
          url_source: string
          user_id: string
          ville: string | null
          visite_le: string | null
        }
        Insert: {
          actif?: boolean
          adresse?: string | null
          charges?: number | null
          checklist?: Json
          code_postal?: string | null
          compte_rendu?: string | null
          created_at?: string
          description?: string | null
          dpe?: string | null
          etage?: number | null
          geo_precision?: string | null
          geocode_le?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          nb_pieces?: number | null
          note_perso?: string | null
          photos?: string[] | null
          prix?: number | null
          rappel_envoye_le?: string | null
          site_source?: string | null
          statut?: string
          surface?: number | null
          titre?: string | null
          transaction?: string
          type_bien?: string | null
          updated_at?: string
          url_source: string
          user_id: string
          ville?: string | null
          visite_le?: string | null
        }
        Update: {
          actif?: boolean
          adresse?: string | null
          charges?: number | null
          checklist?: Json
          code_postal?: string | null
          compte_rendu?: string | null
          created_at?: string
          description?: string | null
          dpe?: string | null
          etage?: number | null
          geo_precision?: string | null
          geocode_le?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          nb_pieces?: number | null
          note_perso?: string | null
          photos?: string[] | null
          prix?: number | null
          rappel_envoye_le?: string | null
          site_source?: string | null
          statut?: string
          surface?: number | null
          titre?: string | null
          transaction?: string
          type_bien?: string | null
          updated_at?: string
          url_source?: string
          user_id?: string
          ville?: string | null
          visite_le?: string | null
        }
        Relationships: []
      }
      demarches: {
        Row: {
          bien_id: string
          created_at: string
          fait_le: string
          id: string
          montant: number | null
          note: string | null
          type: string
        }
        Insert: {
          bien_id: string
          created_at?: string
          fait_le?: string
          id?: string
          montant?: number | null
          note?: string | null
          type: string
        }
        Update: {
          bien_id?: string
          created_at?: string
          fait_le?: string
          id?: string
          montant?: number | null
          note?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "demarches_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      marche_quartier: {
        Row: {
          calcule_le: string
          cle: string
          donnees: Json | null
        }
        Insert: {
          calcule_le?: string
          cle: string
          donnees?: Json | null
        }
        Update: {
          calcule_le?: string
          cle?: string
          donnees?: Json | null
        }
        Relationships: []
      }
      partage_biens: {
        Row: {
          bien_id: string
          partage_id: string
        }
        Insert: {
          bien_id: string
          partage_id: string
        }
        Update: {
          bien_id?: string
          partage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partage_biens_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partage_biens_partage_id_fkey"
            columns: ["partage_id"]
            isOneToOne: false
            referencedRelation: "partages"
            referencedColumns: ["id"]
          },
        ]
      }
      partages: {
        Row: {
          cree_le: string
          expire_le: string | null
          id: string
          titre: string | null
          token: string
          user_id: string
        }
        Insert: {
          cree_le?: string
          expire_le?: string | null
          id?: string
          titre?: string | null
          token: string
          user_id: string
        }
        Update: {
          cree_le?: string
          expire_le?: string | null
          id?: string
          titre?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      prix_historique: {
        Row: {
          bien_id: string
          controle_le: string
          id: string
          prix: number | null
        }
        Insert: {
          bien_id: string
          controle_le?: string
          id?: string
          prix?: number | null
        }
        Update: {
          bien_id?: string
          controle_le?: string
          id?: string
          prix?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prix_historique_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      push_abonnements: {
        Row: {
          agent: string | null
          auth: string
          cree_le: string
          derniere_erreur: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          agent?: string | null
          auth: string
          cree_le?: string
          derniere_erreur?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          agent?: string | null
          auth?: string
          cree_le?: string
          derniere_erreur?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recherche_resultats: {
        Row: {
          bien_id: string | null
          code_postal: string | null
          etat: string
          id: string
          nb_pieces: number | null
          photo: string | null
          prix: number | null
          recherche_id: string
          surface: number | null
          titre: string | null
          trouve_le: string
          url: string
          ville: string | null
        }
        Insert: {
          bien_id?: string | null
          code_postal?: string | null
          etat?: string
          id?: string
          nb_pieces?: number | null
          photo?: string | null
          prix?: number | null
          recherche_id: string
          surface?: number | null
          titre?: string | null
          trouve_le?: string
          url: string
          ville?: string | null
        }
        Update: {
          bien_id?: string | null
          code_postal?: string | null
          etat?: string
          id?: string
          nb_pieces?: number | null
          photo?: string | null
          prix?: number | null
          recherche_id?: string
          surface?: number | null
          titre?: string | null
          trouve_le?: string
          url?: string
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recherche_resultats_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recherche_resultats_recherche_id_fkey"
            columns: ["recherche_id"]
            isOneToOne: false
            referencedRelation: "recherches"
            referencedColumns: ["id"]
          },
        ]
      }
      recherches: {
        Row: {
          active: boolean
          created_at: string
          derniere_erreur: string | null
          derniere_verif: string | null
          echecs_consecutifs: number
          frequence_min: number
          id: string
          label: string
          pieces_min: number | null
          prix_max: number | null
          prix_min: number | null
          site_source: string | null
          surface_min: number | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          derniere_erreur?: string | null
          derniere_verif?: string | null
          echecs_consecutifs?: number
          frequence_min?: number
          id?: string
          label: string
          pieces_min?: number | null
          prix_max?: number | null
          prix_min?: number | null
          site_source?: string | null
          surface_min?: number | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          derniere_erreur?: string | null
          derniere_verif?: string | null
          echecs_consecutifs?: number
          frequence_min?: number
          id?: string
          label?: string
          pieces_min?: number | null
          prix_max?: number | null
          prix_min?: number | null
          site_source?: string | null
          surface_min?: number | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      trajets: {
        Row: {
          ancre: string
          ancre_lat: number
          ancre_lon: number
          bien_id: string
          calcule_le: string
          distance_m: number | null
          duree_s: number | null
          id: string
          mode: string
        }
        Insert: {
          ancre: string
          ancre_lat: number
          ancre_lon: number
          bien_id: string
          calcule_le?: string
          distance_m?: number | null
          duree_s?: number | null
          id?: string
          mode: string
        }
        Update: {
          ancre?: string
          ancre_lat?: number
          ancre_lon?: number
          bien_id?: string
          calcule_le?: string
          distance_m?: number | null
          duree_s?: number | null
          id?: string
          mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "trajets_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
