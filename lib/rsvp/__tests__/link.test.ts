import { describe, expect, it } from "vitest";
import { guestRsvpLink, rsvpPageLink } from "../link";

const site = "https://vowanywhere.com";

describe("RSVP links", () => {
  it("open the couple's website when it is live", () => {
    const home = { slug: "mina-and-jose", website: true };
    expect(guestRsvpLink(site, "K7P2QX", home, "sl")).toBe(
      "https://vowanywhere.com/w/mina-and-jose?code=K7P2QX&lang=sl#rsvp",
    );
    expect(guestRsvpLink(site, "K7P2QX", home)).toBe(
      "https://vowanywhere.com/w/mina-and-jose?code=K7P2QX#rsvp",
    );
    expect(rsvpPageLink(site, home)).toBe("https://vowanywhere.com/w/mina-and-jose#rsvp");
  });

  it("fall back to the RSVP page without a live website", () => {
    const home = { slug: "mina-and-jose", website: false };
    expect(guestRsvpLink(site, "K7P2QX", home, "sl")).toBe(
      "https://vowanywhere.com/r/K7P2QX?lang=sl",
    );
    expect(rsvpPageLink(site, home)).toBe("https://vowanywhere.com/rsvp/mina-and-jose");
  });
});
