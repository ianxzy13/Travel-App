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

// ---------- Phase 2: guests & events ----------

export type GuestSide = "partner_a" | "partner_b" | "both";
export type AgeGroup = "adult" | "child" | "infant";
export type GuestList = "a" | "b";
export type RelationshipType = "keep_together" | "keep_apart";
export type TagColor = "stone" | "rose" | "sage" | "sky" | "amber" | "violet";

type WeddingScoped = Timestamps & { id: string; wedding_id: string };

export type EventRow = WeddingScoped & {
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  dress_code: string | null;
  description: string | null;
  sort_order: number;
};

export type HouseholdRow = WeddingScoped & {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
};

export type GuestRow = WeddingScoped & {
  household_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  side: GuestSide;
  age_group: AgeGroup;
  plus_one_allowed: boolean;
  plus_one_of: string | null;
  dietary: string | null;
  accessibility: string | null;
  notes: string | null;
  list: GuestList;
};

export type GuestEventInviteRow = WeddingScoped & { guest_id: string; event_id: string };
export type TagRow = WeddingScoped & { name: string; color: TagColor };
export type GuestTagRow = WeddingScoped & { guest_id: string; tag_id: string };
export type GuestRelationshipRow = WeddingScoped & {
  guest_a: string;
  guest_b: string;
  type: RelationshipType;
  note: string | null;
};

// Helper: columns with DB defaults become optional on insert.
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

// Helper for tables we don't join through the API.
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: InsertOf<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

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
      events: Table<EventRow, "wedding_id" | "name">;
      households: Table<HouseholdRow, "wedding_id" | "name">;
      guests: Table<GuestRow, "wedding_id" | "household_id">;
      guest_event_invites: Table<GuestEventInviteRow, "wedding_id" | "guest_id" | "event_id">;
      tags: Table<TagRow, "wedding_id" | "name">;
      guest_tags: Table<GuestTagRow, "wedding_id" | "guest_id" | "tag_id">;
      guest_relationships: Table<
        GuestRelationshipRow,
        "wedding_id" | "guest_a" | "guest_b" | "type"
      >;
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
      delete_empty_households: { Args: { wid: string }; Returns: undefined };
    };
    Enums: {
      member_role: MemberRole;
      guest_side: GuestSide;
      age_group: AgeGroup;
      guest_list: GuestList;
      relationship_type: RelationshipType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
