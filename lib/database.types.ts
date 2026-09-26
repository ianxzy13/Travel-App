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
  slug: string;
  rsvp_deadline: string | null;
  rsvp_contact: string | null;
  rsvp_ask_song: boolean;
  rsvp_notify_email: boolean;
  budget_total: number | null;
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
  meal_choice: boolean;
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
  rsvp_code: string;
  rsvp_song_request: string | null;
  rsvp_message: string | null;
  rsvp_responded_at: string | null;
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

// ---------- Phase 3: RSVP ----------

export type RsvpStatus = "attending" | "declined";
export type EmailKind = "invitation" | "reminder";
export type EmailStatus = "sent" | "delivered" | "opened" | "bounced" | "complained" | "failed";

export type MealOptionRow = WeddingScoped & {
  name: string;
  description: string | null;
  sort_order: number;
};

export type RsvpResponseRow = WeddingScoped & {
  guest_id: string;
  event_id: string;
  status: RsvpStatus;
  meal_option_id: string | null;
  responded_by: "guest" | "couple";
  responded_at: string;
};

export type EmailSendRow = WeddingScoped & {
  household_id: string;
  kind: EmailKind;
  to_emails: string[];
  resend_id: string | null;
  status: EmailStatus;
  error: string | null;
  sent_by: string | null;
  delivered_at: string | null;
  opened_at: string | null;
};

export type NotificationRow = WeddingScoped & {
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
};

// ---------- Phase 4: seating ----------

export type SeatingLayoutRow = WeddingScoped & {
  event_id: string;
  room_width: number;
  room_height: number;
};

export type SeatingObjectRow = Timestamps & {
  id: string;
  wedding_id: string;
  layout_id: string;
  kind: import("@/lib/seating/types").SeatingKind;
  label: string | null;
  number: number | null;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  seat_count: number;
  ends: boolean;
};

export type SeatAssignmentRow = Timestamps & {
  layout_id: string;
  guest_id: string;
  wedding_id: string;
  object_id: string;
  seat_index: number;
};

// ---------- Phase 5: budget & vendors ----------
// (numeric columns: Supabase may return them as strings; convert with Number())

export type VendorStatus = "researching" | "contacted" | "quoted" | "booked" | "rejected";

export type BudgetCategoryRow = WeddingScoped & {
  name: string;
  allocated: number;
  sort_order: number;
};

export type VendorRow = WeddingScoped & {
  name: string;
  category_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  address: string | null;
  quote: number | null;
  status: VendorStatus;
  notes: string | null;
  contract_path: string | null;
  contract_name: string | null;
};

export type ExpenseRow = WeddingScoped & {
  category_id: string;
  vendor_id: string | null;
  name: string;
  estimated: number;
  actual: number | null;
  notes: string | null;
  receipt_path: string | null;
  receipt_name: string | null;
};

export type PaymentRow = WeddingScoped & {
  expense_id: string;
  amount: number;
  due_date: string | null;
  paid: boolean;
  paid_on: string | null;
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
      meal_options: Table<MealOptionRow, "wedding_id" | "name">;
      rsvp_responses: Table<RsvpResponseRow, "wedding_id" | "guest_id" | "event_id" | "status">;
      email_sends: Table<EmailSendRow, "wedding_id" | "household_id" | "kind" | "to_emails">;
      notifications: Table<NotificationRow, "wedding_id" | "user_id" | "type" | "title">;
      seating_layouts: Table<SeatingLayoutRow, "wedding_id" | "event_id">;
      seating_objects: Table<
        SeatingObjectRow,
        "id" | "wedding_id" | "layout_id" | "kind" | "width" | "height"
      >;
      seat_assignments: Table<
        SeatAssignmentRow,
        "layout_id" | "guest_id" | "wedding_id" | "object_id" | "seat_index"
      >;
      budget_categories: Table<BudgetCategoryRow, "wedding_id" | "name">;
      vendors: Table<VendorRow, "wedding_id" | "name">;
      expenses: Table<ExpenseRow, "wedding_id" | "category_id" | "name">;
      payments: Table<PaymentRow, "wedding_id" | "expense_id" | "amount">;
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
      get_rsvp: { Args: { p_code: string }; Returns: Json };
      submit_rsvp: {
        Args: { p_code: string; p_payload: Json; p_as_couple?: boolean };
        Returns: Json;
      };
      get_wedding_public: { Args: { p_slug: string }; Returns: Json };
      find_rsvp_code: { Args: { p_slug: string; p_name: string }; Returns: string | null };
      apply_seating_changes: { Args: { p_layout_id: string; p_changes: Json }; Returns: undefined };
      record_email_event: {
        Args: { p_resend_id: string; p_event: string; p_at: string };
        Returns: undefined;
      };
    };
    Enums: {
      member_role: MemberRole;
      guest_side: GuestSide;
      age_group: AgeGroup;
      guest_list: GuestList;
      relationship_type: RelationshipType;
      rsvp_status: RsvpStatus;
      vendor_status: VendorStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
