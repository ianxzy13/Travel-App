import type { Accent, AgeGroup, RsvpStatus } from "@/lib/database.types";

/** What the get_rsvp() database function returns for one household code. */
export type RsvpData = {
  wedding: {
    id: string;
    slug: string;
    partner_a_name: string;
    partner_b_name: string;
    wedding_date: string | null;
    location: string | null;
    accent: Accent;
    rsvp_deadline: string | null;
    rsvp_contact: string | null;
    rsvp_ask_song: boolean;
    deadline_passed: boolean;
  };
  household: {
    id: string;
    name: string;
    code: string;
    song_request: string | null;
    message: string | null;
    responded_at: string | null;
  };
  guests: {
    id: string;
    first_name: string;
    last_name: string;
    plus_one_of: string | null;
    age_group: AgeGroup;
    dietary: string | null;
  }[];
  events: {
    id: string;
    name: string;
    event_date: string | null;
    start_time: string | null;
    end_time: string | null;
    venue_name: string | null;
    address: string | null;
    dress_code: string | null;
    description: string | null;
    meal_choice: boolean;
  }[];
  invites: { guest_id: string; event_id: string }[];
  responses: {
    guest_id: string;
    event_id: string;
    status: RsvpStatus;
    meal_option_id: string | null;
  }[];
  meal_options: { id: string; name: string; description: string | null }[];
};

/** What submit_rsvp() returns. */
export type RsvpResult = {
  household_id: string;
  household_name: string;
  wedding_id: string;
  attending: number;
  declined: number;
  updated: boolean;
};

/** Error codes raised by submit_rsvp(), in plain English. */
export const RSVP_ERRORS: Record<string, string> = {
  rsvp_not_found: "We couldn't find that invitation. Please check the link or code.",
  deadline_passed: "The RSVP deadline has passed. Please contact the couple directly.",
  invalid_guest_or_event:
    "Something in your answers didn't match your invitation. Please reload the page.",
  invalid_status: "Please answer attending or not attending for everyone.",
  not_allowed: "You don't have permission to record replies for this wedding.",
};

export function rsvpErrorMessage(message: string | undefined) {
  const key = Object.keys(RSVP_ERRORS).find((k) => message?.includes(k));
  return key ? RSVP_ERRORS[key] : "We couldn't save your reply. Please try again in a moment.";
}

/** Codes are 6 characters; people may type them lowercase or with spaces/dashes. */
export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const CODE_PATTERN = /^[2-9A-HJ-NP-Z]{6}$/;
