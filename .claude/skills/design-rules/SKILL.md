---
name: design-rules
description: Vow Anywhere design rules (colours, fonts, spacing, components, mobile-first, 25-language texts with household-size "you" forms). Use whenever you add or change a page, component, style, or any text people see.
---

# Vow design rules

Vow looks like a calm boutique: nude, minimalist, feminine. Soft warm colours,
thin lines, small corners, light shadows, lots of white space. Nothing bright,
nothing loud. Every new screen should look like it was always part of the app.

## 1. Colours

All colours live in `app/theme.css` (light, dark, and the rose/sage accent).
`app/globals.css` exposes them to Tailwind.

- **Never write a hex colour or a Tailwind palette colour** (`bg-pink-200`,
  `text-gray-500`, `#fff`) in a component. Use the theme utilities:
  `bg-background`, `bg-card`, `bg-muted`, `bg-sand`, `bg-blush`,
  `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`.
- **Accent (dusty rose, or sage when the couple picks it):**
  - `bg-primary` + `text-primary-foreground` for filled buttons.
  - `bg-primary-soft` for soft highlights (selected rows, icon circles).
  - `text-primary-ink` for small accent text, links and icons. Do not use
    `text-primary` for text; it is too light to read.
- **States:** `text-destructive`, `text-success`, `text-warning`. They are
  muted on purpose; don't brighten them.
- **Status badges:** pairs of tint colours, always background + matching text:
  `bg-tint-blush text-tint-blush-fg`, `tint-sand`, `tint-sage`, `tint-mist`,
  `tint-mauve`, `tint-clay`.
- **Charts:** `--chart-1` … `--chart-7`, then `--chart-other`, in that order.
  See `lib/budget` charts for usage.
- **Seating chart:** `--seat-side-a/b/both`, `--seat-1` … `--seat-8`.
- **Dialog backdrops:** `bg-overlay`.
- Every colour must work in **dark mode** too. If you add a new token, add it
  to both `:root` and `.dark` in `theme.css`, and to `@theme inline` in
  `globals.css`.
- Keep text contrast at WCAG AA. That is why buttons have dark text on rose,
  and why `muted-foreground` is deeper than `taupe-soft` (decoration only).

## 2. Fonts and type

Loaded in `app/layout.tsx` (next/font) and named in `theme.css`:

| Use | Utility | Font |
| --- | --- | --- |
| Body text | `font-sans` (default) | Jost |
| Headings h1–h3 | `font-serif` (automatic on h1–h3) | EB Garamond |
| Rare accent words ("&", a name) | `font-script` | Buongiorno Rastellino, then Great Vibes |

- Headings are **light** (`font-light` / weight 400; h3 is 500). Page title:
  `text-4xl font-light sm:text-5xl` (see `PageHeader`).
- Use EB Garamond, not Cormorant: Cormorant's accents (š, č, ê) float away
  from their letters in Chrome and Edge.
- Small uppercase label above a heading: the `eyebrow` utility.
- Uppercase letter-spaced text for nav and buttons: the `caps` utility
  (buttons already have it built in).
- Use `font-script` sparingly, for one or two words, never for sentences or
  anything that must be read quickly.
- Fonts must cover Latin Extended, Cyrillic and Greek. Don't add a font that
  breaks Slovenian, Czech, Polish, Russian or Greek letters.
- The wedding website templates have their own font list in
  `lib/website/templates.ts`; app screens use only the three fonts above.

## 3. Shape, lines, shadows, icons

- Corners are small (6px). Use `rounded-md` / `rounded-lg`; Tailwind's bigger
  radii are capped in `globals.css`, so `rounded-2xl` still stays small.
  `rounded-full` only for badges, avatars and round icon circles.
- Lines are thin 1px `border` in `border-border`. Prefer a border over a shadow.
- Shadows are very soft: `shadow-sm` for cards that need lift, `shadow-lg`
  only for popovers and dialogs.
- Icons: `lucide-react` only. They are drawn thin (stroke 1.5, set globally).
  Default size comes from the component; use `size-4` inline, `size-6` in
  empty states. Decorative icons get `aria-hidden`. Arrows and "panel" icons
  that point left/right get `rtl:rotate-180`.
- Where a photo is missing, use the `soft-photo` utility, not a grey box.

## 4. Spacing and layout

- **Mobile-first.** Write the phone layout first, then add `sm:`, `md:`,
  `lg:`. Everything must work at **375px wide** (the Playwright phone check
  uses 375×812). No horizontal scroll on a phone; wide tables scroll inside
  their own `overflow-x-auto` box.
- The app shell (`components/app/app-shell.tsx`) already gives pages their
  width and padding: `max-w-6xl px-4 py-6 sm:px-6 md:py-10`. Don't add another
  outer container. Sidebar on `md:` and up; bottom tab bar on phones (pages
  already get `pb-24` so the bar never covers content).
- Every app page starts with `PageHeader` (`components/app/page-header.tsx`):
  title, optional description, optional action buttons.
- Common gaps: `gap-2` inside rows of controls, `gap-3`/`gap-4` between
  cards, `space-y-2`/`space-y-3` in forms, `p-4` (phone) to `sm:p-6` inside
  cards. Sections are separated by generous space (`mt-10`, `space-y-8`)
  rather than heavy dividers.
- Grids: one column on phones, `sm:grid-cols-2`, `lg:grid-cols-3`.
- Forms and dialogs stay narrow: `max-w-md` / `max-w-xl`. Text paragraphs:
  `max-w-2xl`.
- Tap targets are at least 40px tall on phones (default `Button` is `h-10`).
- Use logical directions so Arabic (RTL) works: `ps-`/`pe-`, `ms-`/`me-`,
  `start-`/`end-`, `text-start`/`text-end`, `border-s`/`border-e`. Not
  `pl-`, `ml-`, `left-`, `text-left`.

## 5. Components

Build from `components/ui/*` (shadcn/ui, "new-york" style, Radix under the
hood) before writing anything new. Don't restyle them per page; change the
component once if the look must change.

- **Button** (`components/ui/button.tsx`): `default` (rose fill, the main
  action, one per area), `outline` (secondary), `secondary` (sand fill),
  `ghost` (toolbars, icon buttons), `link`, `destructive` (only inside a
  confirm step). Sizes `sm`, `default`, `lg`, `icon`, `icon-sm`. Icons go
  inside with `aria-hidden`; icon-only buttons need an `aria-label`.
- **Badge** for statuses, using the tint pairs above.
- **Card**, **Dialog** (forms), **AlertDialog** / `components/confirm-dialog.tsx`
  (every delete asks first), **Sheet** (side panels on phones), **Select**,
  **Tabs**, **Table** (header text is small caps), **Tooltip**, **Skeleton**
  (loading), **Switch**, **Checkbox**, **RadioGroup**.
- **Forms:** `FormField` + `FieldError` from `components/form-field.tsx`, so
  every input has a label and errors are read by screen readers and shown in
  the person's language. React Hook Form + Zod for validation.
- **Feedback:** Server Actions return `ActionResult` (`lib/action-result.ts`);
  show the result with `toast.success(...)` / `toast.error(r.error)` from
  `sonner`. Errors are built with `lib/errors.ts` so they are translated.
- **Empty state:** a dashed card, centred, with a round `bg-primary-soft
  text-primary-ink` icon circle, one short muted sentence and one button.
  Copy the playlist page (`components/playlist/playlist-page.tsx`).
- **Flags:** `components/flag.tsx`. **Languages:** `language-select.tsx` /
  `language-switcher.tsx`.
- **Excel export:** reuse `lib/xlsx/build.ts` (real .xlsx). Don't export comma
  CSVs for people to open: they open in one column in Slovenian Excel.

## 6. Texts and the 25 languages

No text people see is written in a component. Every text lives in
`messages/<language>/<area>.json` and is read with `useTranslations` (client)
or `getTranslations` (server).

- The 25 languages are listed in `i18n/locales.ts` (Arabic is right-to-left).
  When you add or change a text, **add or change it in all 25 folders**, not
  only `en`. English is the fallback, but a missing text is a bug.
- New area of the app: add its JSON file in every language and list it in
  `i18n/messages.ts`.
- **Household size decides "you".** Guests are spoken to by how many people
  are in their household:
  - 1 person: singular, informal (sl *ti*, es *tú*, de *du*).
  - 2 people: dual where the language has one (Slovenian *vidva*, Arabic).
  - 3+: plural.
  Write it as `{you, select, one {…} two {…} other {…}}` inside the message.
  English usually needs none. `i18n/you.ts` picks the branch when texts load;
  where the household is unknown (website, the app itself), `other` is used.
  Example (`messages/sl/guest.json`):
  `"Spodaj lahko {you, select, one {spremeniš} two {spremenita} other {spremenite}} svoje odgovore."`
- **The couple speaks in the dual** in Slovenian: "poročila se bova",
  "veseliva se", never "poročili se bomo". Texts the couple types are fixed
  by `lib/i18n/slovenian-dual.ts`; texts we write must already be dual.
- Dates, times and money: always use `lib/i18n/format.ts` (`fmtDate`,
  `fmtDateRange`, `fmtTime`, `fmtMoney`, `relative`) or
  `lib/budget/money.ts`. Never build a date string by hand or use
  `toLocaleDateString` without the locale. Dates are calendar dates, so they
  are formatted in UTC on purpose.
- Use curly apostrophes and quotes (’ “ ”) the way the language does, and
  check that translations didn't miss texts that contain them.
- Leave room for longer words: German and Slovenian texts run 30–40% longer
  than English. Don't fix widths on buttons or labels; let them wrap.

## 7. Voice

Warm, short, plain. Talk to the couple like a calm friend who plans weddings.
One idea per sentence. No exclamation marks in a row, no jargon, no
"Oops!". Vow is about **weddings across borders**: families in different
countries, languages and currencies. Make that feel easy.

## 8. Accessibility checklist

- Every input has a label; every icon-only button has an `aria-label`.
- Keyboard works everywhere (Radix components handle focus; keep
  `focus-visible` rings).
- Colour is never the only signal (add a word or an icon).
- `npm run test:e2e` runs axe on every page at phone size; serious issues fail
  the test.

## Before you finish

1. No raw hex or Tailwind palette colours; only theme utilities.
2. Looks right at 375px, in light and dark mode, and in Arabic (RTL).
3. Every new text is in all 25 `messages/` folders, with `{you, select, …}`
   where a guest is addressed.
4. `npm run lint`, `npm run typecheck`, `npm run test` pass.
