import { describe, expect, it, vi } from "vitest";
import type { GuestTravelRow } from "@/lib/database.types";
import { planShuttleRuns } from "../shuttle";
import {
  flightSearchLinks,
  groupByDay,
  iata,
  roomBlockState,
  timeOf,
  type BoardFlight,
} from "../travel";
import { bookingSearch, hasAnyAffiliate } from "@/lib/vendors/search-links";

const f = (id: string, time: string | null, travellers: string[] = []): BoardFlight => ({
  id,
  time,
  flightNumber: null,
  airline: null,
  airport: null,
  travellers,
  needsPickup: false,
  status: "booked",
});

describe("arrivals board", () => {
  it("groups by local day, sorts by time, puts unknown times last", () => {
    const days = groupByDay([
      f("late", "2027-06-11T22:10:00", ["A", "B"]),
      f("none", null),
      f("early", "2027-06-11T06:05:00"),
      f("prev", "2027-06-10T13:00:00"),
    ]);
    expect(days.map((d) => d.date)).toEqual(["2027-06-10", "2027-06-11", null]);
    expect(days[1].flights.map((x) => x.id)).toEqual(["early", "late"]);
    expect(days[1].people).toBe(3); // 1 (nobody linked) + 2
    expect(days[0].label).toBe("Thursday, June 10, 2027");
    expect(days[2].label).toBe("Time not set");
    expect(groupByDay([f("x", "2027-06-10T13:00:00")], { locale: "sl", noTime: "" })[0].label).toBe(
      "četrtek, 10. junij 2027",
    );
    expect(timeOf("2027-06-11T06:05:00")).toBe("06:05");
  });
});

describe("flight search links", () => {
  it("builds Google Flights and Skyscanner links", () => {
    const l = flightSearchLinks({
      from: "lhr",
      to: "LIS",
      depart: "2027-06-10",
      ret: "2027-06-15",
    });
    expect(l.google).toContain(
      encodeURIComponent("Flights from LHR to LIS on 2027-06-10 returning 2027-06-15"),
    );
    expect(l.skyscanner).toBe(
      "https://www.skyscanner.net/transport/flights/lhr/lis/270610/270615/",
    );
  });

  it("skips Skyscanner without an airport code or date", () => {
    expect(flightSearchLinks({ to: "Lisbon" }).skyscanner).toBeNull();
    expect(iata("Lisbon")).toBeNull();
    expect(iata(" lis ")).toBe("LIS");
  });
});

describe("room block reminders", () => {
  const block = { rooms_held: 20, rooms_booked: 12 };
  it("warns within 30 days of the cut-off while rooms are free", () => {
    expect(roomBlockState({ ...block, cutoff_date: "2027-05-01" }, "2027-04-10")).toEqual({
      level: "soon",
      daysLeft: 21,
      free: 8,
    });
    expect(roomBlockState({ ...block, cutoff_date: "2027-05-01" }, "2027-01-10").level).toBe("ok");
    expect(roomBlockState({ ...block, cutoff_date: "2027-05-01" }, "2027-05-02").level).toBe(
      "passed",
    );
    expect(
      roomBlockState({ rooms_held: 10, rooms_booked: 10, cutoff_date: "2027-05-01" }, "2027-04-25")
        .level,
    ).toBe("ok");
    expect(roomBlockState({ ...block, cutoff_date: null }, "2027-04-25").level).toBe("none");
  });
});

describe("affiliate links", () => {
  it("bookingSearch appends aid when affiliate ID is given", () => {
    const url = bookingSearch("Hotel Sintra", "12345");
    expect(url).toContain("&aid=12345");
    expect(url).toContain("ss=Hotel%20Sintra");
  });

  it("bookingSearch omits aid when no affiliate ID", () => {
    const url = bookingSearch("Hotel Sintra");
    expect(url).not.toContain("&aid=");
  });

  it("bookingSearch reads NEXT_PUBLIC_BOOKING_AFFILIATE_ID from env", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_AFFILIATE_ID", "99999");
    const url = bookingSearch("Test");
    expect(url).toContain("&aid=99999");
    vi.unstubAllEnvs();
  });

  it("hasAnyAffiliate returns false with no env vars", () => {
    expect(hasAnyAffiliate()).toBe(false);
  });

  it("hasAnyAffiliate returns true when any env var is set", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_AFFILIATE_ID", "abc");
    expect(hasAnyAffiliate()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("flightSearchLinks wraps Skyscanner URL with affiliate prefix", () => {
    vi.stubEnv("NEXT_PUBLIC_SKYSCANNER_AFFILIATE_URL_PREFIX", "https://goto.skyscanner.com/?url=");
    const l = flightSearchLinks({ from: "LHR", to: "LIS", depart: "2027-06-10" });
    expect(l.skyscanner).toContain("https://goto.skyscanner.com/?url=");
    expect(l.skyscanner).toContain(encodeURIComponent("https://www.skyscanner.net/"));
    vi.unstubAllEnvs();
  });

  it("flightSearchLinks builds Aviasales link with marker", () => {
    vi.stubEnv("NEXT_PUBLIC_TRAVELPAYOUTS_MARKER", "my_marker");
    const l = flightSearchLinks({ from: "LHR", to: "LIS", depart: "2027-06-10" });
    expect(l.aviasales).toContain("marker=my_marker");
    expect(l.aviasales).toContain("aviasales.com/search/LHR");
    vi.unstubAllEnvs();
  });

  it("flightSearchLinks omits Aviasales without marker", () => {
    const l = flightSearchLinks({ from: "LHR", to: "LIS", depart: "2027-06-10" });
    expect(l.aviasales).toBeNull();
  });
});

describe("shuttle planner", () => {
  const gt = (
    id: string,
    householdId: string,
    householdName: string,
    arrival_date: string | null,
    arrival_time: string | null,
    arrival_airport: string | null,
    needs_transfer: boolean,
  ): GuestTravelRow & { householdName: string } => ({
    id,
    wedding_id: "w",
    household_id: householdId,
    householdName,
    arrival_date,
    arrival_time,
    arrival_airport,
    arrival_flight: null,
    departure_date: null,
    departure_time: null,
    departure_airport: null,
    departure_flight: null,
    staying_at: null,
    hotel_id: null,
    needs_transfer,
    transport_notes: null,
    created_at: "",
    updated_at: "",
  });

  it("groups by date and airport within a time window", () => {
    const travel = [
      gt("1", "h1", "Smith", "2027-06-10", "08:00", "LIS", true),
      gt("2", "h2", "Jones", "2027-06-10", "08:30", "LIS", true),
      gt("3", "h3", "Brown", "2027-06-10", "12:00", "LIS", true),
      gt("4", "h4", "Davis", "2027-06-10", "09:00", "OPO", true),
    ];
    const days = planShuttleRuns(travel, [], { windowMinutes: 90 });
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2027-06-10");
    expect(days[0].runs).toHaveLength(3);
    const lisRuns = days[0].runs.filter((r) => r.airport === "LIS");
    expect(lisRuns).toHaveLength(2);
    expect(lisRuns[0].passengers).toHaveLength(2);
    expect(lisRuns[1].passengers).toHaveLength(1);
  });

  it("ignores guests who don't need transfer", () => {
    const travel = [gt("1", "h1", "Smith", "2027-06-10", "08:00", "LIS", false)];
    expect(planShuttleRuns(travel)).toEqual([]);
  });

  it("handles multiple days", () => {
    const travel = [
      gt("1", "h1", "Smith", "2027-06-10", "08:00", "LIS", true),
      gt("2", "h2", "Jones", "2027-06-11", "10:00", "LIS", true),
    ];
    const days = planShuttleRuns(travel);
    expect(days).toHaveLength(2);
  });
});
