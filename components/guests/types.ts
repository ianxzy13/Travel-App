import type { RelationshipType, TagColor } from "@/lib/database.types";
import type { GuestView, PartnerNames } from "@/lib/guests/model";
import type { AddressValues } from "@/lib/validation/guest";

/** language: the household's language code, "" = the couple's own language */
export type HouseholdOption = {
  id: string;
  name: string;
  address: AddressValues;
  language: string;
};
export type EventOption = { id: string; name: string };
export type TagOption = { id: string; name: string; color: TagColor };
export type RelationshipItem = {
  id: string;
  guestA: string;
  guestB: string;
  type: RelationshipType;
  note: string | null;
};

/** Everything the guest list screen receives from the server. */
export type GuestPageData = {
  guests: GuestView[];
  households: HouseholdOption[];
  events: EventOption[];
  tags: TagOption[];
  relationships: RelationshipItem[];
  names: PartnerNames;
  /** the language the couple writes in (households with "" use it) */
  coupleLanguage: string;
  canEdit: boolean;
  emailConfigured: boolean;
};
