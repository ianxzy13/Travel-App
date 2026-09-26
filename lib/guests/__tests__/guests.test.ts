import { describe, expect, it } from "vitest";
import {
  guessMapping,
  mapRows,
  parseAgeGroup,
  parseBool,
  parseList,
  parseSide,
  safeCell,
  splitFullName,
} from "../csv";
import { DEFAULT_FILTERS, filterGuests, groupByHousehold, sortGuests } from "../filter";
import { buildGuestViews, type GuestView } from "../model";
import { computeStats } from "../stats";

const names = { a: "Ian", b: "Maria" };

function guest(overrides: Partial<GuestView>): GuestView {
  return {
    id: "g",
    householdId: "h",
    householdName: "Household",
    firstName: "",
    lastName: "",
    name: "",
    email: null,
    phone: null,
    side: "both",
    ageGroup: "adult",
    plusOneAllowed: false,
    plusOneOf: null,
    dietary: null,
    accessibility: null,
    notes: null,
    list: "a",
    tagIds: [],
    eventIds: [],
    ...overrides,
  };
}

describe("CSV import mapping", () => {
  it("guesses columns from common header names", () => {
    const mapping = guessMapping([
      "First Name",
      "Surname",
      "E-mail",
      "Group",
      "Zip Code",
      "Shoe size",
    ]);
    expect(mapping).toEqual({
      "First Name": "first_name",
      Surname: "last_name",
      "E-mail": "email",
      Group: "household",
      "Zip Code": "postal_code",
      "Shoe size": "ignore",
    });
  });

  it("never maps two columns to the same field", () => {
    const mapping = guessMapping(["Email", "email"]);
    expect(Object.values(mapping).filter((v) => v === "email")).toHaveLength(1);
  });

  it("parses side, age, list and yes/no values", () => {
    expect(parseSide("Ian's side", names)).toBe("partner_a");
    expect(parseSide("maria", names)).toBe("partner_b");
    expect(parseSide("B", names)).toBe("partner_b");
    expect(parseSide("mutual", names)).toBe("both");
    expect(parseSide("", names)).toBe("both");
    expect(parseAgeGroup("Kid (8)")).toBe("child");
    expect(parseAgeGroup("baby")).toBe("infant");
    expect(parseAgeGroup("")).toBe("adult");
    expect(parseList("B-list")).toBe("b");
    expect(parseList("waitlist")).toBe("b");
    expect(parseList("")).toBe("a");
    expect(parseBool("Yes")).toBe(true);
    expect(parseBool("no")).toBe(false);
  });

  it("splits full names on the last space", () => {
    expect(splitFullName("Ann Marie Smith")).toEqual(["Ann Marie", "Smith"]);
    expect(splitFullName("Cher")).toEqual(["Cher", ""]);
  });

  it("maps rows, defaults households and reports rows without names", () => {
    const rows = [
      { Name: "Ann Smith", Family: "The Smiths", Tags: "family; school", "+1": "Tom Jones" },
      { Name: "", Family: "", Tags: "", "+1": "" }, // empty line: skipped silently
      { Name: "", Family: "The Smiths", Tags: "x", "+1": "" }, // no name: error
      { Name: "Bob", Family: "", Tags: "", "+1": "" },
    ];
    const mapping = {
      Name: "full_name",
      Family: "household",
      Tags: "tags",
      "+1": "plus_one_name",
    } as const;
    const result = mapRows(rows, mapping, names);

    expect(result.errors).toEqual([{ row: 4, message: "No name, row skipped" }]);
    expect(result.guests).toHaveLength(2);
    expect(result.guests[0]).toMatchObject({
      firstName: "Ann",
      lastName: "Smith",
      household: "The Smiths",
      tags: ["family", "school"],
      plusOneAllowed: true,
      plusOneName: "Tom Jones",
    });
    // no household column value → the guest gets their own household
    expect(result.guests[1].household).toBe("Bob");
  });

  it("reads the 'Plus-one of' column from our own export", () => {
    const rows = [
      { First: "Ann", Last: "Smith", "Plus-one of": "" },
      { First: "Tom", Last: "Jones", "Plus-one of": "Ann Smith" },
      { First: "", Last: "", "Plus-one of": "Bob Brown" }, // unnamed plus-one: skipped, no error
    ];
    const mapping = guessMapping(["First", "Last", "Plus-one of"]);
    expect(mapping["Plus-one of"]).toBe("plus_one_of");
    const result = mapRows(rows, mapping, names);
    expect(result.errors).toEqual([]);
    expect(result.guests.map((g) => g.plusOneOf)).toEqual(["", "Ann Smith"]);
  });

  it("neutralises spreadsheet formulas on export", () => {
    expect(safeCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeCell("+44 20 1234")).toBe("'+44 20 1234");
    expect(safeCell("Ann")).toBe("Ann");
    expect(safeCell(null)).toBe("");
  });
});

describe("guest list filtering and sorting", () => {
  const guests = [
    guest({
      id: "1",
      firstName: "José",
      lastName: "Álvarez",
      name: "José Álvarez",
      side: "partner_a",
      tagIds: ["t1"],
      eventIds: ["e1"],
    }),
    guest({
      id: "2",
      firstName: "Ann",
      lastName: "Smith",
      name: "Ann Smith",
      side: "partner_b",
      ageGroup: "child",
      list: "b",
    }),
    guest({
      id: "3",
      firstName: "Bob",
      lastName: "Brown",
      name: "Bob Brown",
      eventIds: ["e1", "e2"],
    }),
  ];

  it("searches ignoring accents and case", () => {
    expect(
      filterGuests(guests, { ...DEFAULT_FILTERS, search: "jose alv" }).map((g) => g.id),
    ).toEqual(["1"]);
  });

  it("filters by side, tag, event, list and 'not invited'", () => {
    const ids = (f: Partial<typeof DEFAULT_FILTERS>) =>
      filterGuests(guests, { ...DEFAULT_FILTERS, ...f }).map((g) => g.id);
    expect(ids({ side: "partner_b" })).toEqual(["2"]);
    expect(ids({ tagId: "t1" })).toEqual(["1"]);
    expect(ids({ eventId: "e2" })).toEqual(["3"]);
    expect(ids({ eventId: "none" })).toEqual(["2"]);
    expect(ids({ list: "b" })).toEqual(["2"]);
  });

  it("sorts by last name, both directions", () => {
    expect(sortGuests(guests, { key: "name", dir: "asc" }).map((g) => g.lastName)).toEqual([
      "Álvarez",
      "Brown",
      "Smith",
    ]);
    expect(sortGuests(guests, { key: "name", dir: "desc" }).map((g) => g.lastName)).toEqual([
      "Smith",
      "Brown",
      "Álvarez",
    ]);
  });

  it("groups households and keeps plus-ones next to their host", () => {
    const list = [
      guest({ id: "p", householdId: "h1", householdName: "Zed", plusOneOf: "host" }),
      guest({ id: "x", householdId: "h2", householdName: "Adams" }),
      guest({ id: "host", householdId: "h1", householdName: "Zed" }),
      guest({ id: "y", householdId: "h1", householdName: "Zed" }),
    ];
    const groups = groupByHousehold(list);
    expect(groups.map((g) => g.name)).toEqual(["Adams", "Zed"]);
    expect(groups[1].guests.map((g) => g.id)).toEqual(["host", "p", "y"]);
  });
});

describe("guest stats", () => {
  it("counts ages, sides, events and plus-ones", () => {
    const stats = computeStats([
      guest({ id: "1", householdId: "h1", side: "partner_a", eventIds: ["e1"] }),
      guest({ id: "2", householdId: "h1", ageGroup: "child", eventIds: ["e1", "e2"] }),
      guest({ id: "3", householdId: "h2", ageGroup: "infant", plusOneOf: "1" }),
      guest({ id: "4", householdId: "h2", firstName: "Tom", plusOneOf: "2" }),
    ]);
    expect(stats).toMatchObject({
      total: 4,
      households: 2,
      adults: 2,
      children: 1,
      infants: 1,
      plusOnes: 2,
      unnamedPlusOnes: 1,
      bySide: { partner_a: 1, partner_b: 0, both: 3 },
      byEvent: { e1: 2, e2: 1 },
      uninvited: 2,
    });
  });
});

describe("buildGuestViews", () => {
  it("names unnamed plus-ones after their host", () => {
    const base = {
      wedding_id: "w",
      household_id: "h",
      email: null,
      phone: null,
      side: "both" as const,
      age_group: "adult" as const,
      plus_one_allowed: false,
      dietary: null,
      accessibility: null,
      notes: null,
      list: "a" as const,
      created_at: "",
      updated_at: "",
    };
    const views = buildGuestViews({
      guests: [
        { ...base, id: "1", first_name: "Ann", last_name: "Smith", plus_one_of: null },
        { ...base, id: "2", first_name: "", last_name: "", plus_one_of: "1" },
      ],
      households: [{ id: "h", name: "Smiths" }],
      invites: [{ guest_id: "1", event_id: "e" }],
      guestTags: [],
    });
    expect(views[1].name).toBe("Ann's guest");
    expect(views[0]).toMatchObject({ householdName: "Smiths", eventIds: ["e"] });
  });
});
