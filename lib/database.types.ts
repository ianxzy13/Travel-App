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
  /** app language this person chose */
  locale: string | null;
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
  rsvp_ask_travel: boolean;
  rsvp_notify_email: boolean;
  budget_total: number | null;
  destination_airport: string | null;
  reminders_checked_on: string | null;
  /** languages the wedding is shown in; the first is the main one */
  languages: string[];
  /** IANA time zone of the venue, e.g. "Europe/Ljubljana" */
  time_zone: string | null;
  translations: Translations;
  find_seat_enabled: boolean;
};

/** Per-language versions of texts: { "sl": { "name": "Poroka" } } */
export type Translations = Record<string, Record<string, unknown>>;

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
  translations: Translations;
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
  preferred_language: string | null;
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
  /** languages this guest speaks */
  languages: string[];
  wants_hotel_room: "yes" | "no" | "elsewhere" | null;
  needs_crib: boolean;
  room_pref_share: string | null;
  room_pref_avoid: string | null;
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
  translations: Translations;
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
  dedupe_key: string | null;
  /** what it's about ({ kind, ...values }), shown in the reader's language */
  data: Json | null;
};

// ---------- Phase 4: seating ----------

export type SeatingLayoutRow = WeddingScoped & {
  event_id: string;
  room_width: number;
  room_height: number;
  name: string;
  is_active: boolean;
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

// ---------- Phase 6: venues, hotels, travel ----------

export type VenueKind = "ceremony" | "reception" | "both";
export type VenueStatus =
  "researching" | "contacted" | "visited" | "shortlisted" | "booked" | "rejected";
export type VenueAvailability = "unknown" | "available" | "tentative" | "unavailable";
export type HotelStatus = "considering" | "contacted" | "block_confirmed" | "rejected";
export type FlightCategory = "guest" | "couple" | "honeymoon";
export type FlightDirection = "arrival" | "departure" | "other";
export type FlightStatus = "considering" | "booked";

export type VenueRow = WeddingScoped & {
  name: string;
  kind: VenueKind;
  status: VenueStatus;
  availability: VenueAvailability;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  capacity: number | null;
  price: number | null;
  included: string | null;
  pros: string | null;
  cons: string | null;
  notes: string | null;
  rating: number | null;
  visit_date: string | null;
  photo_paths: string[];
};

export type VenueChecklistRow = WeddingScoped & {
  venue_id: string;
  question: string;
  answer: string | null;
  done: boolean;
  sort_order: number;
};

export type HotelRow = WeddingScoped & {
  name: string;
  status: HotelStatus;
  address: string | null;
  distance: string | null;
  website: string | null;
  booking_url: string | null;
  price_per_night: number | null;
  rooms_held: number | null;
  rooms_booked: number | null;
  discount_code: string | null;
  cutoff_date: string | null;
  show_on_website: boolean;
  for_couple: boolean;
  notes: string | null;
};

export type HotelGuestRow = WeddingScoped & {
  hotel_id: string;
  guest_id: string;
  room: string | null;
  check_in: string | null;
  check_out: string | null;
};

export type BedKind = "double" | "single" | "sofa_bed" | "bunk";
export type BedConfig = { kind: BedKind; count: number };

export type HotelRoomTypeRow = WeddingScoped & {
  hotel_id: string;
  name: string;
  beds: BedConfig[];
  max_guests: number;
  has_crib: boolean;
  accessible: boolean;
  price_per_night: number | null;
  count: number;
  notes: string | null;
  sort_order: number;
};

export type HotelRoomRow = WeddingScoped & {
  hotel_id: string;
  room_type_id: string | null;
  room_number: string;
  floor: string | null;
  is_locked: boolean;
  notes: string | null;
  sort_order: number;
};

export type HotelRoomAssignmentRow = WeddingScoped & {
  room_id: string;
  guest_id: string;
  check_in: string | null;
  check_out: string | null;
  needs_crib: boolean;
};

export type FlightRow = WeddingScoped & {
  category: FlightCategory;
  direction: FlightDirection;
  status: FlightStatus;
  airline: string | null;
  flight_number: string | null;
  from_airport: string | null;
  to_airport: string | null;
  /** local time "YYYY-MM-DDTHH:mm:ss" (no time zone) */
  depart_at: string | null;
  arrive_at: string | null;
  booking_ref: string | null;
  price: number | null;
  baggage: string | null;
  other_travellers: string | null;
  needs_pickup: boolean;
  notes: string | null;
  provider: string | null;
  provider_ref: string | null;
};

export type FlightTravellerRow = Timestamps & {
  flight_id: string;
  guest_id: string;
  wedding_id: string;
};

// ---------- Phase 12: guest travel ----------

export type GuestTravelRow = WeddingScoped & {
  household_id: string;
  arrival_date: string | null;
  arrival_time: string | null;
  arrival_airport: string | null;
  arrival_flight: string | null;
  departure_date: string | null;
  departure_time: string | null;
  departure_airport: string | null;
  departure_flight: string | null;
  staying_at: string | null;
  hotel_id: string | null;
  needs_transfer: boolean;
  transport_notes: string | null;
};

// ---------- Phase 7: inspiration ----------

export type PinStatus = "love" | "maybe";

export type BoardRow = WeddingScoped & {
  name: string;
  description: string | null;
  sort_order: number;
  share_id: string | null;
};

export type PinRow = WeddingScoped & {
  board_id: string;
  image_path: string | null;
  image_url: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
  note: string | null;
  source_url: string | null;
  tags: string[];
  status: PinStatus | null;
  budget_category_id: string | null;
  vendor_id: string | null;
  credit_name: string | null;
  credit_url: string | null;
  unsplash_id: string | null;
  sort_order: number;
  created_by: string | null;
};

export type PinCommentRow = WeddingScoped & { pin_id: string; user_id: string; body: string };
export type PinReactionRow = Timestamps & { pin_id: string; user_id: string; wedding_id: string };
export type PaletteColorRow = WeddingScoped & {
  hex: string;
  source_pin_id: string | null;
  sort_order: number;
};

export type SiteTemplate = "classic" | "modern" | "garden" | "boho" | "beach";
export type SiteSectionKind =
  "home" | "story" | "events" | "travel" | "party" | "rsvp" | "registry" | "faq" | "gallery";
export type HeadingFont =
  "cormorant" | "playfair" | "fraunces" | "josefin" | "inter" | "great-vibes";
export type BodyFont = "inter" | "lora" | "nunito" | "josefin";

export type WebsiteSettingsRow = Timestamps & {
  wedding_id: string;
  template: SiteTemplate;
  accent_color: string | null;
  heading_font: HeadingFont | null;
  body_font: BodyFont | null;
  hero_path: string | null;
  published: boolean;
  published_at: string | null;
};

export type TaskRow = WeddingScoped & {
  title: string;
  notes: string | null;
  due_date: string | null;
  assignee_id: string | null;
  category: string | null;
  link: string | null;
  suggestion_key: string | null;
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  sort_order: number;
  created_by: string | null;
};

export type ScheduleItemRow = WeddingScoped & {
  day: string | null;
  start_time: string;
  duration_min: number | null;
  title: string;
  location: string | null;
  owner: string | null;
  notes: string | null;
  vendor_id: string | null;
  event_id: string | null;
};

export type WebsiteSectionRow = WeddingScoped & {
  kind: SiteSectionKind;
  sort_order: number;
  visible: boolean;
  content: Json;
  translations: Translations;
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
      venues: Table<VenueRow, "wedding_id" | "name">;
      venue_checklist_items: Table<VenueChecklistRow, "wedding_id" | "venue_id" | "question">;
      hotels: Table<HotelRow, "wedding_id" | "name">;
      hotel_guest_assignments: Table<HotelGuestRow, "wedding_id" | "hotel_id" | "guest_id">;
      hotel_room_types: Table<HotelRoomTypeRow, "wedding_id" | "hotel_id" | "name">;
      hotel_rooms: Table<HotelRoomRow, "wedding_id" | "hotel_id" | "room_number">;
      hotel_room_assignments: Table<HotelRoomAssignmentRow, "wedding_id" | "room_id" | "guest_id">;
      flights: Table<FlightRow, "wedding_id">;
      flight_travellers: Table<FlightTravellerRow, "flight_id" | "guest_id" | "wedding_id">;
      guest_travel: Table<GuestTravelRow, "wedding_id" | "household_id">;
      boards: Table<BoardRow, "wedding_id" | "name">;
      pins: Table<PinRow, "wedding_id" | "board_id">;
      pin_comments: Table<PinCommentRow, "wedding_id" | "pin_id" | "user_id" | "body">;
      pin_reactions: Table<PinReactionRow, "pin_id" | "user_id" | "wedding_id">;
      palette_colors: Table<PaletteColorRow, "wedding_id" | "hex">;
      website_settings: Table<WebsiteSettingsRow, "wedding_id">;
      website_sections: Table<WebsiteSectionRow, "wedding_id" | "kind">;
      tasks: Table<TaskRow, "wedding_id" | "title">;
      schedule_items: Table<ScheduleItemRow, "wedding_id" | "start_time" | "title">;
      guest_relationships: Table<
        GuestRelationshipRow,
        "wedding_id" | "guest_a" | "guest_b" | "type"
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      find_seat: {
        Args: { p_slug: string; p_name: string };
        Returns: Json | null;
      };
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
      get_shared_board: { Args: { p_share_id: string }; Returns: Json };
      get_public_site: { Args: { p_slug: string; p_token?: string | null }; Returns: Json };
      unlock_site: { Args: { p_slug: string; p_password: string }; Returns: string | null };
      set_site_password: {
        Args: { p_wedding_id: string; p_password: string | null };
        Returns: undefined;
      };
      site_has_password: { Args: { p_wedding_id: string }; Returns: boolean };
      sync_reminders: { Args: { p_wedding_id: string }; Returns: number };
      get_page_languages: { Args: { p_kind: string; p_key: string }; Returns: Json };
      get_rsvp_extras: { Args: { p_code: string }; Returns: Json };
      set_rsvp_language: { Args: { p_code: string; p_language: string }; Returns: undefined };
      apply_seating_changes: { Args: { p_layout_id: string; p_changes: Json }; Returns: undefined };
      record_email_event: {
        Args: { p_resend_id: string; p_event: string; p_at: string };
        Returns: undefined;
      };
      submit_guest_travel: {
        Args: { p_code: string; p_payload: Json };
        Returns: undefined;
      };
      submit_room_preferences: {
        Args: { p_code: string; p_prefs: Json };
        Returns: Json;
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
      venue_kind: VenueKind;
      venue_status: VenueStatus;
      venue_availability: VenueAvailability;
      hotel_status: HotelStatus;
      bed_kind: BedKind;
      flight_category: FlightCategory;
      flight_direction: FlightDirection;
      flight_status: FlightStatus;
      pin_status: PinStatus;
      site_template: SiteTemplate;
      site_section: SiteSectionKind;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
