import { describe, expect, it } from "vitest";
import { cleanTitle, isPublicAddress, nameFromUrl, parseHotelPage } from "../link-preview";

describe("hotel link preview", () => {
  it("reads JSON-LD hotels (name, stars, score, address, photo)", () => {
    const html = `<html><head>
      <meta property="og:title" content="Grand Hotel Union, Ljubljana &ndash; Updated 2027 Prices">
      <meta property="og:image" content="https://cf.example.com/union.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Hotel",
        "name":"Grand Hotel Union","starRating":{"ratingValue":"4"},
        "aggregateRating":{"ratingValue":8.6,"bestRating":10},
        "address":{"streetAddress":"Miklošičeva 1","addressLocality":"Ljubljana","addressCountry":"SI"}}</script>
    </head></html>`;
    const p = parseHotelPage(html, "https://www.booking.com/hotel/si/grand-union.html");
    expect(p).toEqual({
      name: "Grand Hotel Union",
      imageUrl: "https://cf.example.com/union.jpg",
      address: "Miklošičeva 1, Ljubljana, SI",
      stars: 4,
      reviewScore: 8.6,
      pricePerNight: null,
    });
  });

  it("falls back to og:title and scales 5-point ratings to 10", () => {
    const html = `<meta content="Villa Bled | Airbnb" property="og:title">
      <script type="application/ld+json">[{"@type":"VacationRental","aggregateRating":{"ratingValue":"4.9"}}]</script>`;
    const p = parseHotelPage(html, "https://www.airbnb.com/rooms/123");
    expect(p.name).toBe("Villa Bled");
    expect(p.reviewScore).toBe(9.8);
    expect(p.imageUrl).toBeNull();
  });

  it("reads a single price but not a range", () => {
    expect(
      parseHotelPage(
        `<meta property="product:price:amount" content="129.00"><title>X</title>`,
        "https://a.b",
      ).pricePerNight,
    ).toBe(129);
    expect(
      parseHotelPage(
        `<script type="application/ld+json">{"@type":"Hotel","name":"Y","priceRange":"€80 - €200"}</script>`,
        "https://a.b",
      ).pricePerNight,
    ).toBeNull();
  });

  it("only keeps https photos", () => {
    const p = parseHotelPage(
      `<meta property="og:image" content="http://x.com/a.jpg"><title>Z</title>`,
      "https://a.b",
    );
    expect(p.imageUrl).toBeNull();
  });

  it("makes a name from the link when the page can't be read", () => {
    expect(nameFromUrl("https://www.booking.com/hotel/si/vila-bled.en-gb.html")).toBe("Vila Bled");
    expect(nameFromUrl("https://www.airbnb.com/rooms/12345678")).toBe("airbnb.com");
    expect(nameFromUrl("https://hotel-toplice.si/")).toBe("hotel-toplice.si");
  });

  it("cleans site suffixes from titles", () => {
    expect(cleanTitle("Hotel Park - Updated 2027 Prices")).toBe("Hotel Park");
    expect(cleanTitle("Rikli Balance Hotel | Sava Hotels")).toBe("Rikli Balance Hotel");
  });

  it("blocks private and local addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "192.168.1.1",
      "172.20.0.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "::ffff:10.0.0.1",
    ])
      expect(isPublicAddress(ip), ip).toBe(false);
    for (const ip of ["8.8.8.8", "151.101.1.140", "2606:4700::1111"])
      expect(isPublicAddress(ip), ip).toBe(true);
  });
});
