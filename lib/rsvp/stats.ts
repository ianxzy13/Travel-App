import type { RsvpStatus } from "@/lib/database.types";

type Invite = { guest_id: string; event_id: string };
type Response = {
  guest_id: string;
  event_id: string;
  status: RsvpStatus;
  meal_option_id: string | null;
};

export type EventTotals = { invited: number; attending: number; declined: number; waiting: number };

/** Attending / declined / waiting per event. Only counts answers to real invitations. */
export function eventTotals(eventIds: string[], invites: Invite[], responses: Response[]) {
  const answer = new Map(responses.map((r) => [`${r.guest_id}:${r.event_id}`, r.status]));
  const totals: Record<string, EventTotals> = {};
  for (const id of eventIds) totals[id] = { invited: 0, attending: 0, declined: 0, waiting: 0 };

  for (const i of invites) {
    const t = totals[i.event_id];
    if (!t) continue;
    t.invited++;
    const status = answer.get(`${i.guest_id}:${i.event_id}`);
    if (status === "attending") t.attending++;
    else if (status === "declined") t.declined++;
    else t.waiting++;
  }
  return totals;
}

export type MealCounts = { byMeal: Record<string, number>; noChoice: number };

/** How many attending guests chose each meal, per event (for the caterer). */
export function mealCounts(mealEventIds: string[], responses: Response[]) {
  const counts: Record<string, MealCounts> = {};
  for (const id of mealEventIds) counts[id] = { byMeal: {}, noChoice: 0 };
  for (const r of responses) {
    const c = counts[r.event_id];
    if (!c || r.status !== "attending") continue;
    if (r.meal_option_id) c.byMeal[r.meal_option_id] = (c.byMeal[r.meal_option_id] ?? 0) + 1;
    else c.noChoice++;
  }
  return counts;
}

export type HouseholdReply = {
  /** replied = every invitation answered; partial = some; waiting = none */
  status: "replied" | "partial" | "waiting" | "not_invited";
  attending: number;
  declined: number;
};

/** Reply state of one household, counted per person (coming to at least one event = attending). */
export function householdReply(
  guestIds: string[],
  invites: Invite[],
  responses: Response[],
): HouseholdReply {
  const ids = new Set(guestIds);
  const myInvites = invites.filter((i) => ids.has(i.guest_id));
  if (myInvites.length === 0) return { status: "not_invited", attending: 0, declined: 0 };

  const answered = new Map(
    responses
      .filter((r) => ids.has(r.guest_id))
      .map((r) => [`${r.guest_id}:${r.event_id}`, r.status]),
  );
  const done = myInvites.filter((i) => answered.has(`${i.guest_id}:${i.event_id}`)).length;

  let attending = 0;
  let declined = 0;
  for (const id of ids) {
    const statuses = myInvites
      .filter((i) => i.guest_id === id)
      .map((i) => answered.get(`${i.guest_id}:${i.event_id}`))
      .filter(Boolean);
    if (statuses.includes("attending")) attending++;
    else if (statuses.length > 0) declined++;
  }

  return {
    status: done === 0 ? "waiting" : done === myInvites.length ? "replied" : "partial",
    attending,
    declined,
  };
}
