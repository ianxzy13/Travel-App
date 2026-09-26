// Types describing the Supabase database, in the same shape that
// `npx supabase gen types typescript` produces. Once the Supabase CLI is
// linked you can regenerate this file instead of editing it by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "owner" | "editor" | "viewer";
export type Accent = "rose" | "sage";

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export type WeddingRow = Timestamps & {
  id: string;
  partner_a_name: string;
  partner_b_name: string;
  wedding_date: string | null;
  location: string | null;
  currency: string;
  estimated_guests: number | null;
  style_tags: string[];
  accent: Accent;
  created_by: string | null;
};

export type WeddingMemberRow = Timestamps & {
  id: string;
  wedding_id: string;
  user_id: string;
  role: MemberRole;
};

export type WeddingInvitationRow = Timestamps & {
  id: string;
  wedding_id: string;
  email: string;
  role: MemberRole;
  token: string;
  invited_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
};

// Helper: columns with DB defaults become optional on insert.
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: InsertOf<ProfileRow, "id">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      weddings: {
        Row: WeddingRow;
        Insert: InsertOf<WeddingRow, "partner_a_name" | "partner_b_name">;
        Update: Partial<WeddingRow>;
        Relationships: [];
      };
      wedding_members: {
        Row: WeddingMemberRow;
        Insert: InsertOf<WeddingMemberRow, "wedding_id" | "user_id">;
        Update: Partial<WeddingMemberRow>;
        Relationships: [
          {
            foreignKeyName: "wedding_members_wedding_id_fkey";
            columns: ["wedding_id"];
            isOneToOne: false;
            referencedRelation: "weddings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wedding_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wedding_invitations: {
        Row: WeddingInvitationRow;
        Insert: InsertOf<WeddingInvitationRow, "wedding_id" | "email">;
        Update: Partial<WeddingInvitationRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_wedding: {
        Args: {
          p_partner_a_name: string;
          p_partner_b_name: string;
          p_wedding_date: string | null;
          p_location: string | null;
          p_currency: string;
          p_estimated_guests: number | null;
          p_style_tags: string[];
          p_accent: Accent;
        };
        Returns: string;
      };
      get_invitation: {
        Args: { invite_token: string };
        Returns: {
          wedding_id: string;
          partner_a_name: string;
          partner_b_name: string;
          role: MemberRole;
          status: "pending" | "accepted" | "expired";
        }[];
      };
      accept_invitation: {
        Args: { invite_token: string };
        Returns: string;
      };
      is_wedding_member: { Args: { wid: string }; Returns: boolean };
      can_edit_wedding: { Args: { wid: string }; Returns: boolean };
      is_wedding_owner: { Args: { wid: string }; Returns: boolean };
    };
    Enums: { member_role: MemberRole };
    CompositeTypes: { [_ in never]: never };
  };
};
