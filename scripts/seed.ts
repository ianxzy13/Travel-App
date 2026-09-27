/**
 * Demo data: `npm run seed`
 *
 * Creates (or re-creates) a demo wedding, "Sofia & Lucas", with ~80 guests in
 * households, RSVPs, a budget with vendors and payments, 3 venues, 2 hotels,
 * flights, a half-finished seating chart, inspiration boards, a published
 * website, a planning timeline and a day-of schedule.
 *
 * Needs in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL   (you have this already)
 *   SUPABASE_SECRET_KEY        (server-only admin key, see .env.example)
 *   SEED_OWNER_EMAIL           (the email you sign in with; you become the owner)
 * Optional: UNSPLASH_ACCESS_KEY (real wedding photos for the boards)
 *
 * Running it again deletes the previous demo wedding first. Your own
 * weddings are never touched.
 */
import { createClient } from "@supabase/supabase-js";
import { addDays, differenceInCalendarDays, format, nextSaturday, subDays } from "date-fns";
import type { AgeGroup, Database, GuestSide } from "@/lib/database.types";
import { SUGGESTED_CATEGORIES } from "@/lib/budget/suggested";
import { DEFAULT_VISIT_QUESTIONS } from "@/lib/places/labels";
import { DAY_TEMPLATE, fromMinutes } from "@/lib/schedule/time";
import { tableSize } from "@/lib/seating/geometry";
import { missingSuggestions } from "@/lib/tasks/timeline";

const SLUG = "sofia-and-lucas-demo";

// ---------- setup ----------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
if (!url || !secret || !ownerEmail) {
  console.error(`
Missing settings in .env.local:
${url ? "" : "  - NEXT_PUBLIC_SUPABASE_URL\n"}${secret ? "" : "  - SUPABASE_SECRET_KEY  (Supabase → Project Settings → API Keys → Secret key)\n"}${ownerEmail ? "" : "  - SEED_OWNER_EMAIL     (the email you sign in to Vow with)\n"}
Add them, save the file, and run "npm run seed" again.`);
  process.exit(1);
}

const sb = createClient<Database>(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Fails loudly with the table name, so problems are easy to find. */
function check<T>(what: string, r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

// Same "random" data on every run.
let seed = 20270612;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const today = new Date();
const weddingDay = nextSaturday(addDays(today, 240));
const W = iso(weddingDay);
const beforeW = (days: number) => iso(subDays(weddingDay, days));
const fromToday = (days: number) => iso(addDays(today, days));

async function findUser(email: string) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listing users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`Seeding the demo wedding (wedding day ${format(weddingDay, "EEE d MMM yyyy")})…`);

  // ---------- people ----------
  const owner = await findUser(ownerEmail!);
  if (!owner) {
    console.error(
      `No account for ${ownerEmail} yet. Sign in to the app once with that email, then run the seed again.`,
    );
    process.exit(1);
  }
  const partnerEmail = "lucas.demo@example.com";
  let partner = await findUser(partnerEmail);
  if (!partner) {
    const { data, error } = await sb.auth.admin.createUser({
      email: partnerEmail,
      email_confirm: true,
      user_metadata: { full_name: "Lucas (demo)" },
    });
    if (error || !data.user) throw new Error(`demo partner: ${error?.message}`);
    partner = data.user;
  }

  // ---------- fresh wedding ----------
  check("delete old demo", await sb.from("weddings").delete().eq("slug", SLUG));
  const wedding = check(
    "wedding",
    await sb
      .from("weddings")
      .insert(
        {
          partner_a_name: "Sofia",
          partner_b_name: "Lucas",
          wedding_date: W,
          location: "Sintra, Portugal",
          currency: "EUR",
          estimated_guests: 90,
          style_tags: ["romantic", "garden"],
          accent: "sage",
          created_by: owner.id,
          slug: SLUG,
          rsvp_deadline: beforeW(60),
          rsvp_contact: "Message Sofia on +351 912 000 111",
          budget_total: 32000,
          destination_airport: "LIS",
        },
        { defaultToNull: false },
      )
      .select("id")
      .single(),
  );
  const wid = wedding.id;
  check(
    "members",
    await sb.from("wedding_members").insert(
      [
        { wedding_id: wid, user_id: owner.id, role: "owner" },
        { wedding_id: wid, user_id: partner.id, role: "editor" },
      ],
      { defaultToNull: false },
    ),
  );

  // ---------- events & meals ----------
  const events = check(
    "events",
    await sb
      .from("events")
      .insert(
        [
          {
            wedding_id: wid,
            name: "Welcome drinks",
            event_date: beforeW(1),
            start_time: "19:00",
            end_time: "22:00",
            venue_name: "Terrace bar, Tivoli Palácio de Seteais",
            address: "R. Barbosa du Bocage 8, 2710-517 Sintra",
            dress_code: "Smart casual",
            sort_order: 0,
          },
          {
            wedding_id: wid,
            name: "Ceremony",
            event_date: W,
            start_time: "15:00",
            end_time: "16:00",
            venue_name: "Quinta da Regaleira",
            address: "R. Barbosa du Bocage 5, 2710-567 Sintra",
            dress_code: "Summer formal",
            description: "Please arrive by 14:40. Flat shoes recommended for the gardens.",
            sort_order: 1,
          },
          {
            wedding_id: wid,
            name: "Reception",
            event_date: W,
            start_time: "17:00",
            end_time: "23:59",
            venue_name: "Palácio de Seteais",
            address: "R. Barbosa du Bocage 8, 2710-517 Sintra",
            dress_code: "Summer formal",
            meal_choice: true,
            sort_order: 2,
          },
          {
            wedding_id: wid,
            name: "Farewell brunch",
            event_date: iso(addDays(weddingDay, 1)),
            start_time: "11:00",
            end_time: "13:00",
            venue_name: "Café Saudade",
            address: "Av. Dr. Miguel Bombarda 6, Sintra",
            sort_order: 3,
          },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const ev = Object.fromEntries(events.map((e) => [e.name, e.id])) as Record<string, string>;
  const meals = check(
    "meals",
    await sb
      .from("meal_options")
      .insert(
        [
          {
            wedding_id: wid,
            name: "Slow-roasted beef",
            description: "With port wine jus",
            sort_order: 0,
          },
          { wedding_id: wid, name: "Sea bass", description: "With lemon and herbs", sort_order: 1 },
          {
            wedding_id: wid,
            name: "Wild mushroom risotto",
            description: "Vegetarian",
            sort_order: 2,
          },
          {
            wedding_id: wid,
            name: "Children's menu",
            description: "Chicken, chips and ice cream",
            sort_order: 3,
          },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const meal = Object.fromEntries(meals.map((m) => [m.name, m.id])) as Record<string, string>;

  // ---------- tags, households, guests ----------
  const tags = check(
    "tags",
    await sb
      .from("tags")
      .insert(
        [
          { wedding_id: wid, name: "Family", color: "rose" },
          { wedding_id: wid, name: "Friends", color: "sky" },
          { wedding_id: wid, name: "Work", color: "amber" },
          { wedding_id: wid, name: "University", color: "violet" },
          { wedding_id: wid, name: "Wedding party", color: "sage" },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const tag = Object.fromEntries(tags.map((t) => [t.name, t.id])) as Record<string, string>;

  type Person = {
    first: string;
    last: string;
    age?: AgeGroup;
    diet?: string;
    access?: string;
    plusOne?: boolean | string;
    party?: boolean;
  };
  type House = {
    name: string;
    side: GuestSide;
    tag: string;
    list?: "a" | "b";
    abroad?: boolean;
    city: string;
    country: string;
    people: Person[];
  };
  const P = (first: string, last: string, extra: Partial<Person> = {}): Person => ({
    first,
    last,
    ...extra,
  });
  const kid = (first: string, last: string): Person => ({ first, last, age: "child" });

  const HOUSES: House[] = [
    {
      name: "Ana & João Ferreira",
      side: "partner_a",
      tag: "Family",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Ana", "Ferreira"), P("João", "Ferreira")],
    },
    {
      name: "Inês Ferreira & Diogo Ramos",
      side: "partner_a",
      tag: "Family",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Inês", "Ferreira", { party: true }), P("Diogo", "Ramos")],
    },
    {
      name: "The Ferreira family",
      side: "partner_a",
      tag: "Family",
      city: "Porto",
      country: "Portugal",
      people: [
        P("Miguel", "Ferreira"),
        P("Rita", "Ferreira"),
        kid("Tomás", "Ferreira"),
        kid("Matilde", "Ferreira"),
      ],
    },
    {
      name: "Grandma Lurdes",
      side: "partner_a",
      tag: "Family",
      city: "Cascais",
      country: "Portugal",
      people: [P("Lurdes", "Ferreira", { access: "Uses a wheelchair; needs step-free access" })],
    },
    {
      name: "Clara & Paulo Santos",
      side: "partner_a",
      tag: "Family",
      city: "Coimbra",
      country: "Portugal",
      people: [P("Clara", "Santos"), P("Paulo", "Santos")],
    },
    {
      name: "Beatriz & Duarte Santos",
      side: "partner_a",
      tag: "Family",
      city: "Coimbra",
      country: "Portugal",
      people: [P("Beatriz", "Santos"), P("Duarte", "Santos")],
    },
    {
      name: "The Carvalho family",
      side: "partner_a",
      tag: "Family",
      city: "Sintra",
      country: "Portugal",
      people: [P("Luís", "Carvalho"), P("Mariana", "Carvalho"), kid("Afonso", "Carvalho")],
    },
    {
      name: "Helena Wright",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Helena", "Wright")],
    },
    {
      name: "Richard Almeida & Carla Mendes",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "Brighton",
      country: "United Kingdom",
      people: [P("Richard", "Almeida"), P("Carla", "Mendes")],
    },
    {
      name: "The Wright family",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [
        P("Emma", "Wright"),
        P("James", "Wright"),
        kid("Olivia", "Wright"),
        { first: "Noah", last: "Wright", age: "infant" },
      ],
    },
    {
      name: "Granddad Peter",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "Oxford",
      country: "United Kingdom",
      people: [P("Peter", "Wright", { diet: "Low salt" })],
    },
    {
      name: "Sarah & Mark Collins",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "Manchester",
      country: "United Kingdom",
      people: [P("Sarah", "Collins"), P("Mark", "Collins")],
    },
    {
      name: "Tony & Julie Wright",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "Leeds",
      country: "United Kingdom",
      people: [P("Tony", "Wright"), P("Julie", "Wright", { diet: "Coeliac (no gluten)" })],
    },
    {
      name: "Megan Wright",
      side: "partner_b",
      tag: "Family",
      abroad: true,
      city: "Bristol",
      country: "United Kingdom",
      people: [P("Megan", "Wright", { plusOne: true })],
    },
    {
      name: "Marta Lopes",
      side: "partner_a",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Marta", "Lopes", { plusOne: "Luís Gomes", party: true })],
    },
    {
      name: "Carolina Reis & Pedro Nunes",
      side: "partner_a",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Carolina", "Reis", { party: true }), P("Pedro", "Nunes")],
    },
    {
      name: "Joana Pires",
      side: "partner_a",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Joana", "Pires", { diet: "Vegan" })],
    },
    {
      name: "Filipa & André Costa",
      side: "partner_a",
      tag: "Friends",
      city: "Setúbal",
      country: "Portugal",
      people: [P("Filipa", "Costa"), P("André", "Costa")],
    },
    {
      name: "Rui Martins",
      side: "partner_a",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Rui", "Martins", { plusOne: true })],
    },
    {
      name: "The Sousa family",
      side: "partner_a",
      tag: "Friends",
      city: "Oeiras",
      country: "Portugal",
      people: [P("Catarina", "Sousa"), P("Hugo", "Sousa"), kid("Leonor", "Sousa")],
    },
    {
      name: "Daniela Rocha",
      side: "partner_a",
      tag: "University",
      city: "Braga",
      country: "Portugal",
      people: [P("Daniela", "Rocha", { diet: "Vegetarian" })],
    },
    {
      name: "Tiago & Sara Barros",
      side: "partner_a",
      tag: "University",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Tiago", "Barros"), P("Sara", "Barros")],
    },
    {
      name: "Tom & Hannah Harris",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Tom", "Harris", { party: true }), P("Hannah", "Harris")],
    },
    {
      name: "Oliver & Chloe Bennett",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Oliver", "Bennett"), P("Chloe", "Bennett")],
    },
    {
      name: "Harry Taylor",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Harry", "Taylor", { plusOne: true })],
    },
    {
      name: "Amelia Clarke",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "Edinburgh",
      country: "United Kingdom",
      people: [P("Amelia", "Clarke", { diet: "Gluten free" })],
    },
    {
      name: "George Evans & Priya Patel",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("George", "Evans"), P("Priya", "Patel", { diet: "Vegetarian" })],
    },
    {
      name: "Jack & Sophie Wilson",
      side: "partner_b",
      tag: "Friends",
      abroad: true,
      city: "Cambridge",
      country: "United Kingdom",
      people: [P("Jack", "Wilson"), P("Sophie", "Wilson")],
    },
    {
      name: "Samuel Green",
      side: "partner_b",
      tag: "University",
      abroad: true,
      city: "York",
      country: "United Kingdom",
      people: [P("Samuel", "Green", { plusOne: true })],
    },
    {
      name: "Grace & Daniel Hughes",
      side: "partner_b",
      tag: "University",
      abroad: true,
      city: "Paris",
      country: "France",
      people: [P("Grace", "Hughes"), P("Daniel", "Hughes")],
    },
    {
      name: "Nuno & Paula Teixeira",
      side: "partner_a",
      tag: "Work",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Nuno", "Teixeira"), P("Paula", "Teixeira")],
    },
    {
      name: "Laura Silva",
      side: "partner_a",
      tag: "Work",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Laura", "Silva")],
    },
    {
      name: "Isabel Moreira",
      side: "partner_a",
      tag: "Work",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Isabel", "Moreira")],
    },
    {
      name: "Ben & Lily Carter",
      side: "partner_b",
      tag: "Work",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Ben", "Carter"), P("Lily", "Carter")],
    },
    {
      name: "The Oliveira family",
      side: "both",
      tag: "Friends",
      city: "Sintra",
      country: "Portugal",
      people: [
        P("Ricardo", "Oliveira"),
        P("Sónia", "Oliveira"),
        kid("Francisco", "Oliveira"),
        kid("Maria", "Oliveira"),
      ],
    },
    {
      name: "Madalena & Gonçalo Pinto",
      side: "both",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Madalena", "Pinto"), P("Gonçalo", "Pinto")],
    },
    {
      name: "Lúcia & Carlos Fernandes",
      side: "both",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Lúcia", "Fernandes"), P("Carlos", "Fernandes")],
    },
    {
      name: "Rafael Moreira",
      side: "both",
      tag: "Friends",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Rafael", "Moreira", { plusOne: true })],
    },
    {
      name: "Vasco & Teresa Cardoso",
      side: "partner_a",
      tag: "Work",
      list: "b",
      city: "Lisbon",
      country: "Portugal",
      people: [P("Vasco", "Cardoso"), P("Teresa", "Cardoso")],
    },
    {
      name: "Ethan Moore",
      side: "partner_b",
      tag: "Friends",
      list: "b",
      abroad: true,
      city: "London",
      country: "United Kingdom",
      people: [P("Ethan", "Moore")],
    },
    {
      name: "Rosa Lima",
      side: "partner_a",
      tag: "Friends",
      list: "b",
      city: "Sintra",
      country: "Portugal",
      people: [P("Rosa", "Lima")],
    },
  ];

  const houses = check(
    "households",
    await sb
      .from("households")
      .insert(
        HOUSES.map((h) => ({ wedding_id: wid, name: h.name, city: h.city, country: h.country })),
        { defaultToNull: false },
      )
      .select("id, name, rsvp_code"),
  );

  type Seeded = { id: string; house: number; person: Person; plusOneOf?: string };
  const guests: Seeded[] = [];
  for (const [hi, h] of HOUSES.entries()) {
    const rows = h.people.map((p) => ({
      wedding_id: wid,
      household_id: houses[hi].id,
      first_name: p.first,
      last_name: p.last,
      email: p.age
        ? null
        : `${p.first}.${p.last}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[^\w.]/g, "") + "@example.com",
      phone:
        !p.age && rand() < 0.5
          ? `+${h.country === "Portugal" ? "351 91" : "44 7700"} ${Math.floor(100000 + rand() * 899999)}`
          : null,
      side: h.side,
      age_group: p.age ?? "adult",
      plus_one_allowed: !!p.plusOne,
      dietary: p.diet ?? null,
      accessibility: p.access ?? null,
      list: h.list ?? "a",
    }));
    const inserted = check(
      `guests of ${h.name}`,
      await sb.from("guests").insert(rows, { defaultToNull: false }).select("id"),
    );
    inserted.forEach((g, i) => guests.push({ id: g.id, house: hi, person: h.people[i] }));
    // plus-ones are real guests (named or "Rui's guest")
    for (const [i, p] of h.people.entries()) {
      if (!p.plusOne) continue;
      const [first, last] = typeof p.plusOne === "string" ? p.plusOne.split(" ") : ["", ""];
      const po = check(
        "plus-one",
        await sb
          .from("guests")
          .insert(
            {
              wedding_id: wid,
              household_id: houses[hi].id,
              first_name: first,
              last_name: last,
              side: h.side,
              plus_one_of: inserted[i].id,
              list: h.list ?? "a",
            },
            { defaultToNull: false },
          )
          .select("id")
          .single(),
      );
      guests.push({ id: po.id, house: hi, person: { first, last }, plusOneOf: inserted[i].id });
    }
  }

  check(
    "guest tags",
    await sb.from("guest_tags").insert(
      guests.flatMap((g) => [
        { wedding_id: wid, guest_id: g.id, tag_id: tag[HOUSES[g.house].tag] },
        ...(g.person.party
          ? [{ wedding_id: wid, guest_id: g.id, tag_id: tag["Wedding party"] }]
          : []),
      ]),
      { defaultToNull: false },
    ),
  );

  const byName = (first: string, last: string) =>
    guests.find((g) => g.person.first === first && g.person.last === last)!.id;
  check(
    "relationships",
    await sb.from("guest_relationships").insert(
      [
        {
          wedding_id: wid,
          guest_a: byName("Helena", "Wright"),
          guest_b: byName("Richard", "Almeida"),
          type: "keep_apart",
          note: "Lucas's parents: divorced, keep at different tables",
        },
        {
          wedding_id: wid,
          guest_a: byName("Lurdes", "Ferreira"),
          guest_b: byName("Ana", "Ferreira"),
          type: "keep_together",
          note: "Grandma sits with Sofia's mum",
        },
        {
          wedding_id: wid,
          guest_a: byName("Tom", "Harris"),
          guest_b: byName("Oliver", "Bennett"),
          type: "keep_together",
        },
      ],
      { defaultToNull: false },
    ),
  );

  // ---------- invitations & RSVPs ----------
  const invites: { wedding_id: string; guest_id: string; event_id: string }[] = [];
  for (const g of guests) {
    const h = HOUSES[g.house];
    for (const e of ["Ceremony", "Reception"])
      invites.push({ wedding_id: wid, guest_id: g.id, event_id: ev[e] });
    if (h.tag === "Family" || h.abroad || g.person.party)
      invites.push({ wedding_id: wid, guest_id: g.id, event_id: ev["Welcome drinks"] });
    if (h.tag === "Family")
      invites.push({ wedding_id: wid, guest_id: g.id, event_id: ev["Farewell brunch"] });
  }
  check("invites", await sb.from("guest_event_invites").insert(invites, { defaultToNull: false }));

  const responses: Database["public"]["Tables"]["rsvp_responses"]["Insert"][] = [];
  const attending = new Set<string>();
  const SONGS = [
    "September – Earth, Wind & Fire",
    "Dancing Queen – ABBA",
    "Mr. Brightside – The Killers",
    "Uptown Funk",
    "Canção do Mar",
  ];
  const MESSAGES = [
    "We can't wait to celebrate with you!",
    "So happy for you both ❤",
    "Save us a spot on the dance floor!",
    "Counting the days!",
  ];
  for (const [hi, h] of HOUSES.entries()) {
    if ((h.list ?? "a") === "b" || rand() > 0.8) continue; // ~80% have replied so far
    const wholeHouseDeclines = rand() < 0.1;
    const members = guests.filter((g) => g.house === hi);
    for (const g of members) {
      const coming = !wholeHouseDeclines && rand() < 0.93;
      for (const inv of invites.filter((i) => i.guest_id === g.id)) {
        const isDinner = inv.event_id === ev["Reception"];
        const diet = (g.person.diet ?? "").toLowerCase();
        const mealId =
          !coming || !isDinner
            ? null
            : g.person.age
              ? meal["Children's menu"]
              : /veg/.test(diet)
                ? meal["Wild mushroom risotto"]
                : pick([meal["Slow-roasted beef"], meal["Sea bass"]]);
        responses.push({
          wedding_id: wid,
          guest_id: g.id,
          event_id: inv.event_id,
          status: coming ? "attending" : "declined",
          meal_option_id: mealId,
          responded_by: rand() < 0.9 ? "guest" : "couple",
        });
        if (coming && isDinner) attending.add(g.id);
      }
    }
    check(
      "household reply",
      await sb
        .from("households")
        .update({
          rsvp_responded_at: subDays(today, Math.floor(rand() * 20)).toISOString(),
          rsvp_song_request: rand() < 0.5 ? pick(SONGS) : null,
          rsvp_message: rand() < 0.5 ? pick(MESSAGES) : null,
        })
        .eq("id", houses[hi].id),
    );
  }
  check("RSVPs", await sb.from("rsvp_responses").insert(responses, { defaultToNull: false }));

  // invitation emails (as if sent a month ago) for households with an email address
  const sends = HOUSES.map((h, hi) => ({ h, hi }))
    .filter(({ hi }) => guests.some((g) => g.house === hi && !g.person.age && !g.plusOneOf))
    .slice(0, 30)
    .map(({ hi }) => {
      const status = pick(["delivered", "opened", "opened", "opened"] as const);
      return {
        wedding_id: wid,
        household_id: houses[hi].id,
        kind: "invitation" as const,
        to_emails: guests
          .filter((g) => g.house === hi && !g.person.age && !g.plusOneOf)
          .map(
            (g) =>
              `${g.person.first}.${g.person.last}`
                .toLowerCase()
                .normalize("NFD")
                .replace(/[^\w.]/g, "") + "@example.com",
          ),
        status,
        sent_by: owner.id,
        created_at: subDays(today, 30).toISOString(),
        delivered_at: subDays(today, 30).toISOString(),
        opened_at: status === "opened" ? subDays(today, 29).toISOString() : null,
      };
    });
  check("email sends", await sb.from("email_sends").insert(sends, { defaultToNull: false }));

  // ---------- budget & vendors ----------
  const categories = check(
    "categories",
    await sb
      .from("budget_categories")
      .insert(
        SUGGESTED_CATEGORIES.map((c, i) => ({
          wedding_id: wid,
          name: c.name,
          allocated: Math.round((32000 * c.percent) / 100),
          sort_order: i,
        })),
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const cat = Object.fromEntries(categories.map((c) => [c.name, c.id])) as Record<string, string>;

  const VENDORS = [
    {
      name: "Luz Photography",
      category: "Photography",
      contact_name: "Ana Luz",
      quote: 2600,
      status: "booked" as const,
      instagram: "@luzphotography",
    },
    {
      name: "Flor de Sal Flowers",
      category: "Flowers",
      contact_name: "Marta Sal",
      quote: 1900,
      status: "quoted" as const,
    },
    {
      name: "DJ Rui Beats",
      category: "Music / DJ",
      contact_name: "Rui Costa",
      quote: 1400,
      status: "booked" as const,
    },
    {
      name: "Sabores de Sintra Catering",
      category: "Catering",
      contact_name: "Pedro Alves",
      quote: 8500,
      status: "booked" as const,
    },
    {
      name: "Doce Momento Cakes",
      category: "Catering",
      contact_name: "Rita Doce",
      quote: 480,
      status: "quoted" as const,
    },
    {
      name: "Glow Hair & Makeup",
      category: "Hair & Makeup",
      contact_name: "Joana Brilho",
      quote: 650,
      status: "contacted" as const,
    },
    {
      name: "Moving Pictures Films",
      category: "Videography",
      contact_name: "Nick Moss",
      quote: null,
      status: "researching" as const,
    },
    {
      name: "Sintra Shuttle Co.",
      category: "Transportation",
      contact_name: "Carlos Rota",
      quote: 700,
      status: "booked" as const,
    },
  ];
  const vendors = check(
    "vendors",
    await sb
      .from("vendors")
      .insert(
        VENDORS.map((v) => ({
          wedding_id: wid,
          name: v.name,
          category_id: cat[v.category],
          contact_name: v.contact_name,
          email: `hello@${v.name.toLowerCase().replace(/[^a-z]/g, "")}.example.com`,
          phone: `+351 21 ${Math.floor(100 + rand() * 899)} ${Math.floor(1000 + rand() * 8999)}`,
          website: `https://example.com/${v.name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
          instagram: v.instagram ?? null,
          quote: v.quote,
          status: v.status,
        })),
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const vendor = Object.fromEntries(vendors.map((v) => [v.name, v.id])) as Record<string, string>;

  type Pay = [amount: number, due: string, paid: boolean];
  const EXPENSES: {
    category: string;
    name: string;
    vendor?: string;
    estimated: number;
    actual?: number;
    payments?: Pay[];
  }[] = [
    {
      category: "Venue",
      name: "Reception at Palácio de Seteais",
      estimated: 9000,
      actual: 8800,
      payments: [
        [2600, fromToday(-120), true],
        [3000, fromToday(4), false],
        [3200, beforeW(21), false],
      ],
    },
    {
      category: "Venue",
      name: "Ceremony at Quinta da Regaleira",
      estimated: 1500,
      actual: 1500,
      payments: [
        [750, fromToday(-90), true],
        [750, beforeW(30), false],
      ],
    },
    {
      category: "Catering",
      name: "Dinner & drinks (€85 per guest)",
      vendor: "Sabores de Sintra Catering",
      estimated: 8500,
      payments: [
        [2000, fromToday(-60), true],
        [6500, beforeW(7), false],
      ],
    },
    { category: "Catering", name: "Wedding cake", vendor: "Doce Momento Cakes", estimated: 480 },
    {
      category: "Photography",
      name: "Photographer – full day",
      vendor: "Luz Photography",
      estimated: 2800,
      actual: 2600,
      payments: [
        [800, fromToday(-100), true],
        [1800, beforeW(14), false],
      ],
    },
    { category: "Videography", name: "Videographer", estimated: 1600 },
    {
      category: "Attire",
      name: "Wedding dress",
      estimated: 2200,
      actual: 2350,
      payments: [
        [1000, fromToday(-60), true],
        [1350, fromToday(-5), false],
      ],
    },
    {
      category: "Attire",
      name: "Suit",
      estimated: 800,
      actual: 760,
      payments: [[760, fromToday(-20), true]],
    },
    {
      category: "Flowers",
      name: "Bouquets & centrepieces",
      vendor: "Flor de Sal Flowers",
      estimated: 1800,
    },
    {
      category: "Music / DJ",
      name: "DJ – 6 hours",
      vendor: "DJ Rui Beats",
      estimated: 1400,
      actual: 1400,
      payments: [
        [400, fromToday(-45), true],
        [1000, beforeW(7), false],
      ],
    },
    { category: "Decor", name: "Candles & table linen", estimated: 900 },
    {
      category: "Stationery",
      name: "Invitations & place cards",
      estimated: 450,
      actual: 420,
      payments: [[420, fromToday(-35), true]],
    },
    { category: "Rings", name: "Wedding rings", estimated: 1200 },
    {
      category: "Hair & Makeup",
      name: "Hair & makeup for Sofia + 3",
      vendor: "Glow Hair & Makeup",
      estimated: 650,
    },
    {
      category: "Transportation",
      name: "Guest shuttle bus",
      vendor: "Sintra Shuttle Co.",
      estimated: 700,
      actual: 700,
      payments: [
        [350, fromToday(-10), true],
        [350, fromToday(20), false],
      ],
    },
    { category: "Accommodation", name: "Our suite at Seteais (2 nights)", estimated: 600 },
    { category: "Favors", name: "Pastéis de nata favours", estimated: 250 },
    {
      category: "Honeymoon",
      name: "Flights to Japan",
      estimated: 2400,
      actual: 2280,
      payments: [[2280, fromToday(-15), true]],
    },
  ];
  for (const e of EXPENSES) {
    const row = check(
      `expense ${e.name}`,
      await sb
        .from("expenses")
        .insert(
          {
            wedding_id: wid,
            category_id: cat[e.category],
            vendor_id: e.vendor ? vendor[e.vendor] : null,
            name: e.name,
            estimated: e.estimated,
            actual: e.actual ?? null,
          },
          { defaultToNull: false },
        )
        .select("id")
        .single(),
    );
    if (e.payments?.length) {
      check(
        "payments",
        await sb.from("payments").insert(
          e.payments.map(([amount, due, paid]) => ({
            wedding_id: wid,
            expense_id: row.id,
            amount,
            due_date: due,
            paid,
            paid_on: paid ? due : null,
          })),
          { defaultToNull: false },
        ),
      );
    }
  }

  // ---------- venues ----------
  const VENUES = [
    {
      name: "Quinta da Regaleira",
      kind: "ceremony" as const,
      status: "booked" as const,
      availability: "available" as const,
      capacity: 150,
      price: 1500,
      rating: 5,
      address: "R. Barbosa du Bocage 5, 2710-567 Sintra",
      included: "Chapel and gardens for 2 hours, chairs",
      pros: "Magical gardens, the chapel!",
      cons: "Lots of steps for older guests",
      visit_date: fromToday(-150),
    },
    {
      name: "Palácio de Seteais",
      kind: "reception" as const,
      status: "booked" as const,
      availability: "available" as const,
      capacity: 110,
      price: 8800,
      rating: 5,
      address: "R. Barbosa du Bocage 8, 2710-517 Sintra",
      included: "Ballroom, terrace, tables & linen, parking",
      pros: "Stunning terrace for drinks, 5 min from the ceremony",
      cons: "Music must stop at midnight",
      visit_date: fromToday(-150),
    },
    {
      name: "Quinta do Vale",
      kind: "both" as const,
      status: "rejected" as const,
      availability: "tentative" as const,
      capacity: 200,
      price: 7000,
      rating: 3,
      address: "Estrada de Colares, Sintra",
      included: "Everything incl. catering",
      pros: "All in one place",
      cons: "40 min from Lisbon, felt a bit generic",
      visit_date: fromToday(-160),
    },
  ];
  const venues = check(
    "venues",
    await sb
      .from("venues")
      .insert(
        VENUES.map((v) => ({
          ...v,
          wedding_id: wid,
          contact_name: "Events team",
          email: "events@example.com",
          website: "https://example.com/venue",
        })),
        { defaultToNull: false },
      )
      .select("id, name, status"),
  );
  check(
    "visit checklists",
    await sb.from("venue_checklist_items").insert(
      venues.flatMap((v) =>
        DEFAULT_VISIT_QUESTIONS.map((question, i) => ({
          wedding_id: wid,
          venue_id: v.id,
          question,
          sort_order: i,
          done: v.status === "booked" && i < 7,
          answer: v.status === "booked" && i === 0 ? "Yes, the covered terrace" : null,
        })),
      ),
      { defaultToNull: false },
    ),
  );

  // ---------- hotels ----------
  const hotels = check(
    "hotels",
    await sb
      .from("hotels")
      .insert(
        [
          {
            wedding_id: wid,
            name: "Tivoli Palácio de Seteais",
            status: "block_confirmed",
            address: "R. Barbosa du Bocage 8, Sintra",
            distance: "At the reception venue",
            website: "https://example.com/tivoli",
            booking_url: "https://example.com/tivoli/book",
            price_per_night: 240,
            rooms_held: 20,
            rooms_booked: 12,
            discount_code: "SOFIALUCAS",
            cutoff_date: beforeW(45),
            show_on_website: true,
          },
          {
            wedding_id: wid,
            name: "Sintra Boutique Hotel",
            status: "contacted",
            address: "R. Visconde de Monserrate 48, Sintra",
            distance: "5 min by taxi",
            website: "https://example.com/boutique",
            price_per_night: 130,
            show_on_website: true,
            notes: "Asked about a small block of 8 rooms",
          },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const abroadGuests = guests
    .filter((g) => HOUSES[g.house].abroad && (HOUSES[g.house].list ?? "a") === "a")
    .slice(0, 14);
  check(
    "hotel guests",
    await sb.from("hotel_guest_assignments").insert(
      abroadGuests.map((g, i) => ({
        wedding_id: wid,
        hotel_id: hotels[0].id,
        guest_id: g.id,
        room: `${201 + Math.floor(i / 2)}`,
        check_in: beforeW(1),
        check_out: iso(addDays(weddingDay, 2)),
      })),
      { defaultToNull: false },
    ),
  );

  // ---------- flights ----------
  const FLIGHTS = [
    {
      airline: "TAP Air Portugal",
      flight_number: "TP1351",
      from: "LHR",
      depart: "08:05",
      arrive: "10:45",
      travellers: ["Emma Wright", "James Wright", "Olivia Wright", "Noah Wright"],
    },
    {
      airline: "British Airways",
      flight_number: "BA500",
      from: "LHR",
      depart: "11:40",
      arrive: "14:20",
      travellers: ["Helena Wright", "Peter Wright"],
    },
    {
      airline: "easyJet",
      flight_number: "U27623",
      from: "LGW",
      depart: "13:15",
      arrive: "15:55",
      travellers: ["Tom Harris", "Hannah Harris", "Oliver Bennett", "Chloe Bennett"],
    },
    {
      airline: "Air France",
      flight_number: "AF1024",
      from: "CDG",
      depart: "09:30",
      arrive: "11:05",
      travellers: ["Grace Hughes", "Daniel Hughes"],
    },
  ];
  for (const f of FLIGHTS) {
    const row = check(
      "flight",
      await sb
        .from("flights")
        .insert(
          {
            wedding_id: wid,
            category: "guest",
            direction: "arrival",
            status: "booked",
            airline: f.airline,
            flight_number: f.flight_number,
            from_airport: f.from,
            to_airport: "LIS",
            depart_at: `${beforeW(1)}T${f.depart}:00`,
            arrive_at: `${beforeW(1)}T${f.arrive}:00`,
            needs_pickup: true,
          },
          { defaultToNull: false },
        )
        .select("id")
        .single(),
    );
    const ids = f.travellers
      .map((n) => guests.find((g) => `${g.person.first} ${g.person.last}` === n)?.id)
      .filter((x): x is string => !!x);
    check(
      "travellers",
      await sb.from("flight_travellers").insert(
        ids.map((guest_id) => ({ wedding_id: wid, flight_id: row.id, guest_id })),
        { defaultToNull: false },
      ),
    );
  }
  check(
    "honeymoon",
    await sb.from("flights").insert(
      {
        wedding_id: wid,
        category: "honeymoon",
        direction: "other",
        status: "booked",
        airline: "Lufthansa",
        flight_number: "LH1169",
        from_airport: "LIS",
        to_airport: "HND",
        depart_at: `${iso(addDays(weddingDay, 3))}T06:10:00`,
        arrive_at: `${iso(addDays(weddingDay, 4))}T09:15:00`,
        booking_ref: "X7K2PQ",
        price: 2280,
        other_travellers: "Sofia & Lucas",
        notes: "Change in Munich",
      },
      { defaultToNull: false },
    ),
  );

  // ---------- seating (half finished) ----------
  const layout = check(
    "layout",
    await sb
      .from("seating_layouts")
      .insert(
        { wedding_id: wid, event_id: ev["Reception"], room_width: 2400, room_height: 1600 },
        { defaultToNull: false },
      )
      .select("id")
      .single(),
  );
  const round = tableSize("round", 10);
  const sweet = tableSize("sweetheart", 2);
  const spots = [
    [350, 400],
    [750, 400],
    [350, 820],
    [750, 820],
    [350, 1240],
    [750, 1240],
    [1650, 400],
    [2050, 400],
    [1650, 820],
    [2050, 820],
  ];
  const TABLE_NAMES = [
    "Lisboa",
    "Porto",
    "London",
    "Sintra",
    "Cascais",
    "Oxford",
    "Coimbra",
    "Brighton",
    "Madeira",
    "Edinburgh",
  ];
  const objects = check(
    "tables",
    await sb
      .from("seating_objects")
      .insert(
        [
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "sweetheart",
            label: "Sofia & Lucas",
            x: 1200,
            y: 170,
            width: sweet.width,
            height: sweet.height,
            seat_count: 2,
          },
          ...spots.map(([x, y], i) => ({
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "round" as const,
            number: i + 1,
            label: TABLE_NAMES[i],
            x,
            y,
            width: round.width,
            height: round.height,
            seat_count: 10,
          })),
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "dance_floor",
            label: "Dance floor",
            x: 1200,
            y: 720,
            width: 500,
            height: 500,
          },
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "stage",
            label: "DJ",
            x: 1200,
            y: 1180,
            width: 400,
            height: 200,
          },
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "bar",
            label: "Bar",
            x: 1900,
            y: 1400,
            width: 300,
            height: 80,
          },
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "cake",
            label: "Cake",
            x: 1600,
            y: 1250,
            width: 100,
            height: 100,
          },
          {
            id: crypto.randomUUID(),
            wedding_id: wid,
            layout_id: layout.id,
            kind: "entrance",
            label: "Entrance",
            x: 1200,
            y: 1585,
            width: 200,
            height: 30,
          },
        ],
        { defaultToNull: false },
      )
      .select("id, kind, number"),
  );
  // Fill the first 3 tables household by household (keep Helena and Richard apart).
  const tables = objects
    .filter((o) => o.kind === "round")
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    .slice(0, 3);
  const seats: {
    wedding_id: string;
    layout_id: string;
    guest_id: string;
    object_id: string;
    seat_index: number;
  }[] = [];
  let t = 0;
  let s = 0;
  const helena = byName("Helena", "Wright");
  for (const [hi] of HOUSES.entries()) {
    const coming = guests.filter((g) => g.house === hi && attending.has(g.id));
    if (!coming.length || t >= tables.length) continue;
    if (s + coming.length > 10) {
      t++;
      s = 0;
    }
    if (t >= tables.length) break;
    // Richard's household goes one table further than Helena's
    if (
      coming.some((g) => g.id === byName("Richard", "Almeida")) &&
      seats.some((x) => x.guest_id === helena && x.object_id === tables[t].id)
    ) {
      t++;
      s = 0;
      if (t >= tables.length) break;
    }
    for (const g of coming)
      seats.push({
        wedding_id: wid,
        layout_id: layout.id,
        guest_id: g.id,
        object_id: tables[t].id,
        seat_index: s++,
      });
  }
  if (seats.length)
    check("seats", await sb.from("seat_assignments").insert(seats, { defaultToNull: false }));

  // ---------- inspiration ----------
  const boards = check(
    "boards",
    await sb
      .from("boards")
      .insert(
        [
          {
            wedding_id: wid,
            name: "Flowers",
            description: "Soft, garden-style, lots of peonies",
            sort_order: 0,
          },
          { wedding_id: wid, name: "Dress & attire", sort_order: 1 },
          {
            wedding_id: wid,
            name: "Decor & tablescape",
            description: "Candles, linen, olive branches",
            sort_order: 2,
          },
        ],
        { defaultToNull: false },
      )
      .select("id, name"),
  );
  const QUERIES: Record<string, string> = {
    Flowers: "wedding peony bouquet",
    "Dress & attire": "wedding dress",
    "Decor & tablescape": "wedding table candles",
  };
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const utm = (u: string) =>
    `${u}${u.includes("?") ? "&" : "?"}utm_source=vow_wedding_planner&utm_medium=referral`;
  let pinCount = 0;
  const firstPins: string[] = [];
  for (const b of boards) {
    type Photo = {
      id: string;
      width: number;
      height: number;
      alt_description: string | null;
      urls: { regular: string };
      links: { html: string };
      user: { name: string; links: { html: string } };
    };
    let rows: Database["public"]["Tables"]["pins"]["Insert"][] = [];
    if (unsplashKey) {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(QUERIES[b.name])}&per_page=8&content_filter=high`,
        {
          headers: { Authorization: `Client-ID ${unsplashKey}`, "Accept-Version": "v1" },
        },
      );
      if (res.ok) {
        const photos = ((await res.json()) as { results: Photo[] }).results;
        rows = photos.map((p, i) => ({
          wedding_id: wid,
          board_id: b.id,
          image_url: p.urls.regular,
          width: p.width,
          height: p.height,
          title: p.alt_description
            ? p.alt_description.slice(0, 1).toUpperCase() + p.alt_description.slice(1, 120)
            : null,
          source_url: utm(p.links.html),
          credit_name: p.user.name,
          credit_url: utm(p.user.links.html),
          unsplash_id: p.id,
          status: i === 0 ? ("love" as const) : i === 2 ? ("maybe" as const) : null,
          tags: i % 2 ? ["romantic"] : ["garden", "soft"],
          sort_order: i,
          created_by: i % 3 ? owner.id : partner!.id,
        }));
      } else console.warn(`  (Unsplash said ${res.status}; using placeholder pictures)`);
    }
    if (!rows.length) {
      rows = Array.from({ length: 6 }, (_, i) => ({
        wedding_id: wid,
        board_id: b.id,
        image_url: `https://picsum.photos/seed/vow-${b.name.replace(/\W/g, "")}-${i}/600/${i % 2 ? 800 : 700}`,
        width: 600,
        height: i % 2 ? 800 : 700,
        title: `${b.name} idea ${i + 1}`,
        status: i === 0 ? ("love" as const) : null,
        sort_order: i,
        created_by: owner.id,
      }));
    }
    const pins = check(
      "pins",
      await sb.from("pins").insert(rows, { defaultToNull: false }).select("id"),
    );
    pinCount += pins.length;
    firstPins.push(pins[0].id);
  }
  check(
    "pin chat",
    await sb.from("pin_comments").insert(
      [
        {
          wedding_id: wid,
          pin_id: firstPins[0],
          user_id: partner.id,
          body: "This one! Could Flor de Sal do something like it?",
        },
        {
          wedding_id: wid,
          pin_id: firstPins[0],
          user_id: owner.id,
          body: "Yes, sending it to Marta now.",
        },
      ],
      { defaultToNull: false },
    ),
  );
  check(
    "hearts",
    await sb.from("pin_reactions").insert(
      firstPins.map((pin_id) => ({ wedding_id: wid, pin_id, user_id: partner!.id })),
      { defaultToNull: false },
    ),
  );
  check(
    "palette",
    await sb.from("palette_colors").insert(
      ["#8a9a7b", "#e8c9c1", "#f4efe6", "#c9a86a", "#5b6b4e"].map((hex, i) => ({
        wedding_id: wid,
        hex,
        sort_order: i,
      })),
      { defaultToNull: false },
    ),
  );

  // ---------- website (published) ----------
  check(
    "website",
    await sb
      .from("website_settings")
      .update({ template: "garden", published: true, published_at: new Date().toISOString() })
      .eq("wedding_id", wid),
  );
  const CONTENT = {
    home: { tagline: "We're getting married in Sintra" },
    story: {
      intro:
        "We met in a tiny bookshop in Lisbon, both reaching for the last copy of the same book. Lucas let Sofia have it, on the condition that she tell him how it ended, over coffee.",
      milestones: [
        {
          id: "m1",
          date: "Spring 2019",
          title: "The bookshop",
          text: "Coffee turned into dinner, and dinner into a walk along the river until sunrise.",
          photo: null,
        },
        {
          id: "m2",
          date: "2021",
          title: "London calling",
          text: "Two years of flights between Lisbon and London (and a lot of pastéis de nata in hand luggage).",
          photo: null,
        },
        {
          id: "m3",
          date: "Last summer",
          title: "The proposal",
          text: "In the gardens of Quinta da Regaleira, where we'll say “I do”.",
          photo: null,
        },
      ],
    },
    events: {
      intro: "Here's how the weekend looks. Please ask if you need help getting anywhere!",
    },
    travel: {
      intro: "Sintra is about 40 minutes from Lisbon airport (LIS).",
      notes:
        "A shuttle bus runs between Tivoli Seteais, the ceremony and the reception. Taxis and Uber are easy to find in Sintra. Bring comfortable shoes: Sintra is hilly!",
    },
    rsvp: {
      intro: "We can't wait to celebrate with you. Please reply for everyone in your invitation.",
    },
    party: {
      people: [
        {
          id: "p1",
          name: "Inês",
          role: "Maid of honour",
          bio: "Sofia's sister and lifelong partner in crime.",
          photo: null,
        },
        {
          id: "p2",
          name: "Tom",
          role: "Best man",
          bio: "Lucas's friend since school, in charge of the rings (help).",
          photo: null,
        },
        { id: "p3", name: "Marta", role: "Bridesmaid", bio: "", photo: null },
        { id: "p4", name: "Carolina", role: "Bridesmaid", bio: "", photo: null },
      ],
    },
    registry: {
      intro:
        "Your presence is the greatest gift. If you'd like to give something, we'd love help towards our honeymoon in Japan.",
      links: [
        {
          id: "r1",
          label: "Honeymoon fund",
          url: "https://example.com/honeymoon",
          note: "Ramen and temples, here we come!",
        },
      ],
    },
    faq: {
      items: [
        {
          id: "q1",
          question: "Are children welcome?",
          answer: "Yes! There will be a kids' table and a children's menu.",
        },
        {
          id: "q2",
          question: "Is there parking at the venue?",
          answer: "Yes, free parking at Palácio de Seteais. The shuttle is even easier.",
        },
        {
          id: "q3",
          question: "What should I wear?",
          answer: "Summer formal. The ceremony is in the gardens, so avoid stiletto heels.",
        },
      ],
    },
    gallery: { photos: [] },
  } as const;
  for (const [kind, content] of Object.entries(CONTENT)) {
    check(
      `website ${kind}`,
      await sb
        .from("website_sections")
        .update({ content: content as never })
        .eq("wedding_id", wid)
        .eq("kind", kind as never),
    );
  }

  // ---------- to-dos ----------
  const suggestions = missingSuggestions(new Set(), W, iso(today));
  const DONE = new Set([
    "set-budget",
    "guest-list-draft",
    "inspiration",
    "planner",
    "book-venue",
    "photographer",
    "caterer",
    "music",
    "room-blocks",
    "website",
    "save-the-dates",
    "attire",
  ]);
  check(
    "tasks",
    await sb.from("tasks").insert(
      suggestions.map((r, i) => ({
        ...r,
        wedding_id: wid,
        created_by: owner.id,
        done: DONE.has(r.suggestion_key),
        // a couple of things slipped
        due_date:
          r.suggestion_key === "videographer"
            ? fromToday(-4)
            : r.suggestion_key === "officiant"
              ? fromToday(-1)
              : r.due_date,
        assignee_id: i % 3 === 0 ? partner!.id : i % 3 === 1 ? owner.id : null,
      })),
      { defaultToNull: false },
    ),
  );
  check(
    "own tasks",
    await sb.from("tasks").insert(
      [
        {
          wedding_id: wid,
          title: "Ask Grandma Lurdes about her veil",
          category: "Attire",
          due_date: fromToday(10),
          assignee_id: owner.id,
          created_by: owner.id,
          sort_order: 0,
        },
        {
          wedding_id: wid,
          title: "Book a table for the rehearsal dinner",
          category: "Food",
          due_date: fromToday(21),
          created_by: owner.id,
          sort_order: 0,
        },
      ],
      { defaultToNull: false },
    ),
  );

  // ---------- day-of schedule ----------
  const ceremonyAt = 15 * 60;
  check(
    "schedule",
    await sb.from("schedule_items").insert(
      DAY_TEMPLATE.map((i) => ({
        wedding_id: wid,
        start_time: fromMinutes(ceremonyAt + i.offset),
        duration_min: i.duration,
        title: i.title,
        owner: i.owner ?? null,
        location:
          i.location === "ceremony"
            ? "Quinta da Regaleira"
            : i.location === "reception"
              ? "Palácio de Seteais"
              : null,
        vendor_id:
          i.owner === "Photographer"
            ? vendor["Luz Photography"]
            : i.owner === "DJ / band"
              ? vendor["DJ Rui Beats"]
              : i.owner === "Caterer"
                ? vendor["Sabores de Sintra Catering"]
                : null,
        event_id: i.title === "Ceremony" ? ev["Ceremony"] : null,
      })),
      { defaultToNull: false },
    ),
  );

  // ---------- a clean notification bell with a few examples ----------
  check("clear notifications", await sb.from("notifications").delete().eq("wedding_id", wid));
  const replied = houses
    .filter((_, hi) => guests.some((g) => g.house === hi && attending.has(g.id)))
    .slice(0, 3);
  check(
    "notifications",
    await sb.from("notifications").insert(
      replied.map((h, i) => ({
        wedding_id: wid,
        user_id: owner.id,
        type: "rsvp",
        title: `${h.name} replied`,
        body: "Everyone is coming",
        link: `/app/rsvp?household=${h.id}`,
        created_at: subDays(today, i).toISOString(),
      })),
      { defaultToNull: false },
    ),
  );

  const daysLeft = differenceInCalendarDays(weddingDay, today);
  console.log(`
Done! Demo wedding "Sofia & Lucas" (in ${daysLeft} days) is ready:
  ${guests.length} guests in ${houses.length} households, ${attending.size} attending so far
  ${EXPENSES.length} expenses, ${vendors.length} vendors, ${venues.length} venues, ${hotels.length} hotels, ${FLIGHTS.length + 1} flights
  ${seats.length} guests seated at 3 of 10 tables, ${pinCount} pins${unsplashKey ? " (Unsplash)" : " (placeholder photos)"}, ${suggestions.length + 2} to-dos
  Public website: /w/${SLUG}

Open http://localhost:3000/app and pick "Sofia & Lucas" in the wedding switcher (top left).`);
}

main().catch((e) => {
  console.error("\nSeeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
