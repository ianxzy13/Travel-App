import type { RelationshipType, TagColor } from "@/lib/database.types";
import type { GuestView, PartnerNames } from "@/lib/guests/model";
import type { AddressValues } from "@/lib/validation/guest";

export type HouseholdOption = { id: string; name: string; address: AddressValues };
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
  canEdit: boolean;
  emailConfigured: boolean;
};
