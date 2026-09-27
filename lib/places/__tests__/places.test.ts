import { describe, expect, it } from "vitest";
import {
  flightSearchLinks,
  groupByDay,
  iata,
  roomBlockState,
  timeOf,
  type BoardFlight,
} from "../travel";

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
