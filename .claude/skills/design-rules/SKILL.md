---
name: design-rules
description: Vow Anywhere design system (type scale, 8px spacing grid, colour tokens, button/card/form patterns, mobile-first, 25-language texts with household-size "you" forms). Use whenever you add or change a page, component, style, or any text people see.
---

# Vow design rules

Vow is a wedding planner for families spread across countries. Its look is a
calm boutique: warm nude colours, a serif for headings, thin lines, small
corners, a lot of empty space. These rules are taken from the code that is
already there. Follow them so a new screen looks like it was always part of
the app.

Source of truth: `app/theme.css` (every colour, font, corner, shadow) and
`app/globals.css` (turns them into Tailwind classes and adds `eyebrow`,
`caps`, `soft-photo`). If a rule here and those files disagree, the files win.
Fix this skill.

## 1. Typography scale

Three fonts, loaded in `app/layout.tsx`:

- `font-sans` (default): **Jost**, all body and UI text.
- `font-serif`: **EB Garamond**, headings h1 to h3 (applied automatically).
- `font-script`: **Buongiorno Rastellino**, falling back to Great Vibes. Use it
  for one or two decorative words ("&", the couple's names), never for a
  sentence.

Use only these steps. Each one has a role. Don't pick a size because it
"looks about right", and don't use `text-[13px]` style values.

| Role                       | Classes                                           | Size (px)  |
| -------------------------- | ------------------------------------------------- | ---------- |
| Display (couple's names)   | `font-script text-5xl sm:text-6xl` (up to `7xl`)  | 48 → 72    |
| Page title (h1)            | `font-serif font-light text-4xl sm:text-5xl`      | 36 → 48    |
| Section title (h2)         | `font-serif text-2xl sm:text-3xl`                 | 24 → 30    |
| Card / dialog title (h3)   | `font-serif text-xl font-medium` (`text-2xl` big) | 20 (24)    |
| Lead paragraph             | `text-lg text-muted-foreground`                   | 18         |
| Body                       | `text-base` (guest pages), `text-sm` (app UI)     | 16 / 14    |
| Meta, hints, table cells   | `text-xs` or `text-sm text-muted-foreground`      | 12 / 14    |
| Eyebrow (above a heading)  | `eyebrow`                                         | 11, caps   |
| Button / nav label         | `caps` (built into `Button`)                      | 11.5, caps |

Rules:

- Heading weight is light: 300 for page titles, 400 for h2, 500 for h3. Never
  `font-bold` or `font-semibold` on a serif heading. Body emphasis is
  `font-medium`, not bold.
- Line height: headings `leading-tight` (1.1 is the default for h1–h3), body
  keeps the default; long reading text can use `leading-relaxed`.
- Inputs are `text-base` on phones and `md:text-sm`, so iPhone Safari doesn't
  zoom in when someone taps a field. Keep that.
- Garamond numbers are set to lining figures in `globals.css`, so dates and
  prices line up. Don't override it.
- Use EB Garamond, not Cormorant: Cormorant's accents (š, č, ê) drift off
  their letters in Chrome and Edge. Any new font must cover Latin Extended,
  Cyrillic and Greek.
- The wedding website templates (`components/website/site.tsx`,
  `lib/website/templates.ts`) are the couple's own design and have their own
  fonts and sizes. These rules are for the app, guest pages and emails.

## 2. Spacing system (8px grid)

Tailwind counts in 4px steps (`2` = 8px). Vow uses an **8px base grid with a
4px half step** for small gaps inside a component.

| Token | Tailwind | px  | Use                                                    |
| ----- | -------- | --- | ------------------------------------------------------ |
| half  | `1`      | 4   | icon to text, badge padding, inside tight controls     |
| 1     | `2`      | 8   | between buttons in a row, label to input               |
| 1.5   | `3`      | 12  | list rows, small cards, input side padding             |
| 2     | `4`      | 16  | phone page gutter, card grids, form fields in a group  |
| 3     | `6`      | 24  | card padding, desktop gutter, dialog padding           |
| 4     | `8`      | 32  | between groups inside a section                        |
| 5     | `10`     | 40  | between page sections, under the page header           |
| 6+    | `12` `16` `20` | 48, 64, 80 | landing page sections                    |

Rules:

- Layout spacing (page gutters, card padding, gaps between cards and
  sections) is always a multiple of 8: `2, 4, 6, 8, 10, 12, 16, 20`.
- `1` and `3` (4px, 12px) are only for spacing inside a component.
- Don't use `0.5, 1.5, 2.5, 3.5, 5, 7, 9` or bracket values like `p-[18px]`
  in new code. Some older screens have them; when you touch one, move it
  onto the grid.
- Heights follow the grid too: controls are `h-8` (small), `h-10` (default),
  `h-12` (large); icons `size-4`, `size-5`, `size-6`.
- Prefer `gap-*` on flex and grid over margins on children. Use `space-y-*`
  for stacked form fields.

## 3. Colour tokens

Never write a hex code, `rgb()`, or a Tailwind palette colour (`bg-pink-200`,
`text-gray-500`, `text-white` on a light surface) in a component. Use these
tokens. Each one has a light and a dark value in `theme.css`, so dark mode
works for free.

**Primary** (dusty rose, or sage when the couple picks it in Settings; the
app sets `data-accent`):

| Token                     | Use                                                  |
| ------------------------- | ---------------------------------------------------- |
| `bg-primary`              | Filled main button, active switch, progress fill     |
| `hover:bg-primary-hover`  | Its hover                                            |
| `text-primary-foreground` | Text on `bg-primary` (dark taupe, not white: contrast) |
| `bg-primary-soft`         | Soft highlight: selected row, icon circle, hover     |
| `text-primary-ink`        | Accent text, links, small icons on light surfaces    |
| `ring-ring`               | Focus ring                                           |

`text-primary` is too light for text. Use `text-primary-ink`.

**Neutral** (warm taupes and creams, most of the screen):

| Token                                | Use                                       |
| ------------------------------------ | ----------------------------------------- |
| `bg-background`                      | Page                                      |
| `bg-card`, `bg-popover`              | Cards, menus, inputs                      |
| `bg-muted`                           | Quiet fills: table heads, tracks, hovers  |
| `bg-sand`, `bg-blush`                | Section bands, secondary button           |
| `text-foreground`                    | Main text                                 |
| `text-muted-foreground`              | Secondary text, hints                     |
| `text-taupe-soft`                    | Decoration only (fails contrast as text)  |
| `border-border`, `border-input`      | 1px lines, field borders                  |
| `bg-overlay`                         | Backdrop behind dialogs                   |

**Accent** (for telling things apart, never for main actions):

- Status badges and category tags use a tint pair, background plus its own
  text: `bg-tint-blush text-tint-blush-fg`, and the same for `sand`, `sage`,
  `mist`, `mauve`, `clay`. Don't mix a tint background with another tint's
  text.
- Charts use `--chart-1` to `--chart-7` in that order, then `--chart-other`.
  The order is checked for colour-blind separation.
- Seating chart seats use `--seat-side-a/b/both` and `--seat-1` to `--seat-8`.

**States:** `text-destructive`, `text-success`, `text-warning` (and
`bg-*/10` for a soft box behind them). They are muted on purpose.

Adding a token: put it in `:root` **and** `.dark` in `theme.css`, then map it
in `@theme inline` in `globals.css`. Check text contrast is at least 4.5:1.

## 4. Shape, lines, shadows, icons

- Corners are small (6px): `rounded-md`. Bigger Tailwind radii are capped in
  `globals.css`, so `rounded-2xl` still stays 8px. `rounded-full` only for
  badges, avatars and round icon circles.
- Separate things with a 1px `border` first, space second, shadow last.
  `shadow-sm` for a card that needs lift; `shadow-lg` only for dialogs and
  popovers.
- Icons: `lucide-react` only, drawn thin (stroke 1.5, set globally).
  Decorative icons get `aria-hidden`. Left/right arrows get `rtl:rotate-180`.
- No photo yet? Use the `soft-photo` class, not a grey box.

## 5. Component patterns

Build from `components/ui/*` (shadcn/ui, Radix). If a component's look has
to change, change it in `components/ui`, not with one-off classes on a page.

### Buttons (`components/ui/button.tsx`)

Variants, with one `default` (filled) button per area:

- `default`: main action. `outline`: second action. `secondary` (sand):
  quiet action. `ghost`: toolbars and icon buttons. `link`: inline text
  action. `destructive`: only the final "Delete" inside a confirm dialog.
- Sizes: `sm` (h-8), `default` (h-10), `lg` (h-12), `icon` / `icon-sm`.

Every button has these states, already built in. Don't remove them:

| State    | Look                                                          |
| -------- | ------------------------------------------------------------- |
| Rest     | Variant colours, `caps` label                                 |
| Hover    | `bg-primary-hover` (filled), `bg-primary-soft/60` (outline)   |
| Focus    | 3px `ring-ring/50` ring on keyboard focus (`focus-visible`)   |
| Disabled | `opacity-50`, no pointer events                               |
| Loading  | `disabled` plus `<Loader2 className="animate-spin" aria-hidden />` before the label; keep the label |
| Invalid  | `aria-invalid` turns the border and ring `destructive`        |

Icon-only buttons need an `aria-label`. Labels are verbs ("Add song", "Save").

### Cards (`components/ui/card.tsx`)

```tsx
<Card>                       {/* bg-card, 1px border, rounded, py-6, gap-6 */}
  <CardHeader>               {/* px-6 */}
    <CardTitle className="font-serif text-xl">…</CardTitle>
    <CardDescription>…</CardDescription>   {/* text-sm muted */}
    <CardAction>…</CardAction>             {/* optional, top right */}
  </CardHeader>
  <CardContent>…</CardContent>             {/* px-6 */}
  <CardFooter className="border-t">…</CardFooter>
</Card>
```

- Small list items or stat boxes: `bg-card rounded-lg border p-4`.
- Card grids: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.
- Empty state: a dashed card, centred, `px-6 py-12`, a round `size-12
  bg-primary-soft text-primary-ink` icon circle, one muted sentence
  (`max-w-md`) and one button. Copy `components/playlist/playlist-page.tsx`.

### Forms

- Each field is `FormField` from `components/form-field.tsx`: label, input,
  then a hint or a red error, stacked with `space-y-2` and wired for screen
  readers. Errors come from `lib/errors.ts` / `validation` texts, so they are
  translated.
- Fields stack in one column on phones; pair short fields with
  `grid gap-4 sm:grid-cols-2`. Forms stay `max-w-xl` or narrower.
- Groups of fields: `space-y-4`; between groups `space-y-8` or a heading.
- Inputs are `h-10`, `bg-card`, `border-input`, `rounded-md`.
- Actions go last, aligned to the end: `flex flex-col-reverse gap-2
  sm:flex-row sm:justify-end` (`DialogFooter` does this), main button last.
- Validation: React Hook Form + Zod. Server Actions return `ActionResult`
  (`lib/action-result.ts`); show it with `toast.success(...)` or
  `toast.error(r.error)` from `sonner`.
- Every delete asks first with `AlertDialog` / `components/confirm-dialog.tsx`.

### Other building blocks

`Dialog` (forms, `p-6`, `sm:max-w-lg`), `Sheet` (side panels on phones),
`Select`, `Tabs`, `Table` (small caps headers, wrap in `overflow-x-auto` on
phones), `Badge` (with tint pairs), `Tooltip`, `Skeleton` (loading), `Switch`,
`Checkbox`, `RadioGroup`, `components/flag.tsx`, `language-select.tsx`.
Excel export: `lib/xlsx/build.ts` (real .xlsx; comma CSVs open in one column
in Slovenian Excel).

## 6. Layout and mobile-first

- Write the phone layout first, then add `sm:`, `md:`, `lg:`. Everything works
  at **375px wide** (the Playwright test uses 375×812). No sideways scrolling
  of the page.
- The app shell (`components/app/app-shell.tsx`) already sets page width and
  padding (`max-w-6xl px-4 py-6 sm:px-6 md:py-10`), a sidebar from `md:` and a
  bottom tab bar on phones. Don't add another outer container.
- Every app page starts with `PageHeader` (`components/app/page-header.tsx`).
- Tap targets at least 40px (`h-10`).
- Arabic is right-to-left. Use logical classes: `ps-`/`pe-`, `ms-`/`me-`,
  `start-`/`end-`, `text-start`/`text-end`, `border-s`/`border-e`, never
  `pl-`, `ml-`, `left-`, `text-left`.
- Leave room for long words. German and Slovenian run 30–40% longer than
  English, so don't give buttons or labels a fixed width.

## 7. Texts and the 25 languages

No text people see is typed into a component. Every text lives in
`messages/<language>/<area>.json` and is read with `useTranslations` (client)
or `getTranslations` (server).

- The 25 languages are in `i18n/locales.ts`. When you add or change a text,
  **change it in all 25 folders**, not only `en`. A new area needs its JSON
  file in every language and an entry in `i18n/messages.ts`.
- **Household size decides "you".** 1 person: singular, informal (sl *ti*,
  es *tú*, de *du*). 2 people: dual where the language has one (Slovenian
  *vidva*, Arabic). 3 or more: plural. Write it inside the message as
  `{you, select, one {…} two {…} other {…}}`; `i18n/you.ts` picks the branch.
  Where the household isn't known (website, the app), `other` is used.
  Example from `messages/sl/guest.json`:
  `"Spodaj lahko {you, select, one {spremeniš} two {spremenita} other {spremenite}} svoje odgovore."`
- **The couple speaks in the dual** in Slovenian: "poročila se bova",
  "veseliva se", never "poročili se bomo". `lib/i18n/slovenian-dual.ts` fixes
  texts the couple types; texts we write must already be dual.
- Dates, times and money only through `lib/i18n/format.ts` (`fmtDate`,
  `fmtDateRange`, `fmtTime`, `fmtMoney`, `relative`) or `lib/budget/money.ts`.
- Use the language's own quotes and apostrophes (’ “ ” „ «).

## 8. Avoid the generic AI look

These make a screen look machine-made and unlike Vow. Don't use them:

- Purple, blue or rainbow gradients, gradient text, glowing borders, glass
  blur cards (the only blur is the sticky phone header and tab bar).
- Bright saturated colours, neon greens or reds for status.
- Big rounded "bubble" cards, heavy drop shadows, cards inside cards inside
  cards.
- A row of three identical feature cards with an emoji or icon on top as the
  default answer to every page.
- Emoji in the interface, sparkles everywhere, "✨ AI-powered" badges.
- Bold sans-serif headings, everything centred, all-caps headings (caps are
  only for small labels via `eyebrow` / `caps`).
- Filler copy: "Seamlessly", "Effortlessly", "Unlock", "Elevate your
  experience", "Oops!", stacked exclamation marks.
- Stock icons used as decoration with no meaning; placeholder grey boxes.

Do this instead: one clear main action, a serif title, quiet neutral
surfaces, thin borders, real content (names, dates, countries) and plenty of
space. Copy is warm and short, like a calm friend who plans weddings, and it
should make planning across borders feel easy.

## 9. Before you finish

1. Sizes come from the type scale; spacing is on the 8px grid.
2. No raw hex or palette colours; only the tokens above.
3. Buttons keep hover, focus, disabled and loading states; forms use
   `FormField`; deletes ask first.
4. Looks right at 375px, in light and dark mode, and in Arabic (RTL).
5. Every new text is in all 25 `messages/` folders, with
   `{you, select, …}` where a guest is addressed.
6. `npm run lint`, `npm run typecheck` and `npm run test` pass;
   `npm run test:e2e` checks accessibility (axe) at phone size.
