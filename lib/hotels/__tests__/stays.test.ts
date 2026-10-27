import { describe, expect, it } from "vitest";
import { bookedStay, guestStays, guestsForHotel, mainHotelId, type StayGuest } from "../stays";

const guest = (over: Partial<StayGuest>): StayGuest => ({
  id: "g",
  name: "G",
  householdId: "h",
  householdName: "H",
  rsvp: "attending",
  wantsRoom: null,
  stayFrom: null,
  stayTo: null,
  hotelId: null,
  ...over,
});

describe("guestsForHotel", () => {
  const list = [
    guest({ id: "yes" }),
    guest({ id: "pending", rsvp: "not_replied" }),
    guest({ id: "declined", rsvp: "declined" }),
    guest({ id: "elsewhere", wantsRoom: "elsewhere" }),
    guest({ id: "other-hotel", hotelId: "h2" }),
    guest({ id: "here", hotelId: "h1" }),
  ];
  const ids = (f: { notReplied: boolean; noRoom: boolean }) =>
    guestsForHotel(list, "h1", f).map((g) => g.id);

  it("counts attending guests who need a room, here or nowhere yet", () => {
    expect(ids({ notReplied: false, noRoom: false })).toEqual(["yes", "here"]);
  });
  it("toggles add not-replied and no-room guests, never declined", () => {
    expect(ids({ notReplied: true, noRoom: true })).toEqual([
      "yes",
      "pending",
      "elsewhere",
      "here",
    ]);
  });
});

describe("hotel booking", () => {
  const hotels = [
    { id: "a", name: "A", booked_from: null, booked_to: null, people_per_room: null },
    { id: "b", name: "B", booked_from: "2027-03-05", booked_to: "2027-03-09", people_per_room: 5 },
  ];
  it("picks the first hotel with dates", () => {
    expect(mainHotelId(hotels)).toBe("b");
    expect(mainHotelId([])).toBeNull();
  });
  it("gives each guest their real stay", () => {
    const booked = bookedStay(hotels[1]);
    expect(bookedStay(hotels[0])).toBeNull();
    expect(guestStays([guest({ stayTo: "2027-03-11" })], booked)[0].stay).toEqual({
      from: "2027-03-05",
      to: "2027-03-11",
    });
  });
});
