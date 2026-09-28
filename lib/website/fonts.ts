import {
  Fraunces,
  Great_Vibes,
  Inter,
  Josefin_Sans,
  Lora,
  Nunito_Sans,
  Playfair_Display,
} from "next/font/google";

// Extra fonts for the wedding website (Garamond is loaded in the root layout;
// Great Vibes is shared with it). The browser only downloads the ones a site uses.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});
const josefin = Josefin_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-josefin",
  display: "swap",
});
export const greatVibes = Great_Vibes({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});
const lora = Lora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-lora",
  display: "swap",
  style: ["normal", "italic"],
});
const nunito = Nunito_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito",
  display: "swap",
});

/** Put on the site's root element so the font variables exist. */
export const siteFontVariables = [inter, playfair, fraunces, josefin, lora, nunito]
  .map((f) => f.variable)
  .join(" ");
