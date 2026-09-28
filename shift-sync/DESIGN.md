# UI contract

The look and structure of shift-sync. Every visual decision is either here or in `src/styles/tokens.css`. To change how
something looks, change this file and the token or component it names, in the same edit. Look and structure come from
Bar2.000's dashboard (its `styles.css`, `viz.js`, `calendar.js`, `stepper.js`), rebuilt as Preact components.

## Structure
- **Shell:** the rail sits on the grey canvas (no painted bar), then the page. It lists three groups with their pages: *Shifts*
  (Dashboard, Log, Calendar, Insights, Other income), *Crew* (Crew, People) and *Settings*; below them New shift, the sync state and the
  light/dark switch (see *Rail, groups and pages*). On a phone the groups are a bottom tab bar, the group's pages a pill strip,
  and a top bar carries the sync state and New shift.
- **Every page is one panel:** a head (title left, its controls right) and a body. A page with two views has a tab row on the
  canvas above its panel. Nothing inside a panel is boxed again except what you act on (an opened row, the Calendar's day card).
  The Log's grouping and period controls live in the panel head, not in a toolbar row above the list.
- **Two levels:** you browse pages; you enter or edit a shift in a **dialog** (the form). A shift's read-only look is
  `ShiftDetails`: an opened row on the Log, the side card on the Calendar, and elsewhere the **drawer** (a floating card *over*
  the page's right edge on desktop, never resizing it; a sheet on phone). Clicking outside the drawer, its close button, or the
  open row again closes it; another row swaps it. The pencil or Edit opens the form.
- **Routes** (`router.ts`): `#/dashboard` (the landing page) `#/overview #/summary #/log #/calendar #/hub/{income,week,crew} #/people #/settings/{wages,sync,look,data}`,
  plus `?shift=<id>` (open shift), `?form=<id|new>&date=` (form), `?person=<id|new>`. Retired routes (`#/earnings`, `#/rate`,
  `#/journal`, `#/log/multi`, `#/settings`, `#/hub`) land on their replacement.

## Tokens (`tokens.css`)
- **Surfaces:** page `--bg` < panel `--surface` (1px `--line`, soft shadow) < raised (dialog, drawer, tooltip: `--shadow`).
  `--surface-2` is an input's or tile's fill, `--surface-3` a hover. Dark mode is written twice; keep the two blocks identical.
- **Type:** Poppins, self-hosted. Title 16, body 14, small 12, labels 12 semibold (sentence case), tiles 22/30. A mouse gets a denser scale.
- **Times:** always 12-hour. Reading form `6:00 PM` (`clockPlain`) in rows, cards, lists and labels; the compact `6:00p` (`clockShort`)
  only inside dense cells (calendar days, the crew grid); every editable time is a `TimeField`.
- **Spacing:** 4px scale (`--s-1..7`). **Radii:** 8, 12, 16, pill. **Accent:** teal.
- **Marks:** day amber, night indigo, party rose, income sources one token each. A mark is never colour alone (letter, word or label).

## Components
- `ui/charts.tsx`: `Tiles`, `Facts`, `ColumnChart`, `ComboChart`, `Histogram`, `HBars`, `Ribbon`, `TableView`. Charts are HTML in percentages (no
  library). Every chart has a legend where colour carries identity, a tooltip on hover and focus, and *View as table*.
- `ui/MonthCalendar.tsx`: one calendar, two sizes (`browse` on the Calendar page, `pick` on the form's Date page). Weeks run Mon–Sun.
  In `browse` the day cell *is* the card: one full-cell button per shift (total large; rate and hours; start–end; a single sun/moon icon
  badge for the type, a star for a party; shade = earnings, never a type fill) or one
  "log a shift" button. The month and its nav are the panel head; more than one shift in a day stacks compact cards.
- `ui/Table.tsx`: the one grid (sort, bands, paging, group headers). `ui/PanelHead.tsx`, `ui/DrawerFrame.tsx`, `ui/toast.tsx`.
- `features/shift/ShiftForm.tsx`: opens on **Overview** (the calendar that already shows your shifts, start and end, tips, and what the
  shift adds up to with the mix bar), then pages in three groups (Info: Date, Time, Type · Income: Tips, Wage, Other · Details: Crew,
  Party, Notes), each with a live summary and a problem dot. The pages are components in `form/pages.tsx`; the page list, the form
  object and validation (`check`) are in `form/model.ts`, pure and tested. No time presets: the Time page draws your last few same-weekday shifts
  under this one. Close confirms in place ("Discard changes?"); Delete acts at once with Undo.
- `ui/TimeField.tsx`: every editable time is hour · minute · AM/PM (`lib/time12.ts` converts), so no device shows a 24-hour clock.
- `features/shift/ShiftDetails.tsx`: the one read-only shift block (mix bar + Time / Crew / Money stacked lists), used by the drawer and
  the Log's opened row. `ui/MixBar.tsx`: the income stacked bar, coloured from the `--cat-*` tokens, always named in the list beside it.

## Settings
One page of areas (Hourly wage, Google Sheet, Appearance, Your data), each a grey panel with its title. The rail's links still land on
their area. Hourly wage shows what the wage comes to this month as a share of the total, with the mix bar.

## Rail, groups and pages
Rail one is three groups: **Shifts** (Dashboard, Log, Calendar, Insights, Other income), **Crew** (Crew, People) and **Settings** (one page). A page
with two views has a tab row on the canvas above its panel, each view its own route: Insights is *Trends* (`#/overview`) and *Totals*
(`#/summary`); Crew is *Week* (`#/hub/week`) and *Every shift* (`#/hub/crew`). Settings is one page whose areas are still linked
(`#/settings/wages` and so on). Retired pages land somewhere sensible: `#/journal` and `#/log/multi` open the Log. Below the groups:
New shift, the sync state, and a one-tap light/dark switch. On a phone the groups are the bottom bar and the group's pages a pill strip
under the top bar.

## Colour (`lib/theme.ts`, applied by `data/settings.ts`)
No white-on-black extremes. The page, the panel, the tints and the lines are steps of one ramp built from the background tint (Soft grey, the
default, then Mint, Slate, Stone, Neutral). The canvas is a light grey, panels sit a step or two above it, and only what you act on (the table,
a field, an opened row) reaches the near-white top step;
text is four steps (ink, ink-2, ink-3, ink-4) *solved* to keep 5.3:1 / 4.5:1 or better on every surface at every contrast setting (tests enforce it).
The primary colour (presets or any custom colour) is deepened or lightened until it reads as text. `--accent-wash` is the faint primary tint used for
grouped rows, hovers and filled cells. tokens.css holds only the static defaults and the status colours; never hard-code a neutral.

## Calendar, Totals, Crew, Other income
- **Calendar:** on desktop the opened shift shows in the side column beside the month (`ShiftDetails`, so the floating drawer stays shut),
  with the month's numbers under it. `Month` (big cards) or `3 months` (three stacked months beside a KPI line, a month table, tips-and-rate by week, best and slowest by rate).
  A day is shaded by its tips per hour against the median of the shifts in view: above leans on the primary colour, below on amber, deeper = further out.
- **Totals** (Overview's second view, `#/summary`): the shifts in the period folded into a table: by week, month, year, weekday, type or party, every column summed, change pills for time groups.
- **Crew** (*Week* and *Every shift* views) and **Other income:** *Week* as a **Timeline** (days down, one 12-hour ruler across from `lib/ruler.ts`, a bar per bartender, yours in the
  accent; hours only) or a **Grid** (bartenders as rows, Mon–Sun across); click a bar or a cell to set start and end; *Every shift* (every crew line, times edit in place with compact `TimeField`s);
  *Other income* (every income line, edit in place). All write through `data/store.ts` (`saveCrewLine`, `saveIncomeLine`) and sync like any edit.

## KPI parts (`ui/kpi.tsx`)
One small vocabulary, used wherever a number needs context instead of a bigger box: `Spark` (a few points, no axes), `DeltaPill` (▲/▼ + %,
never colour alone; hours are neutral), `MiniStat` (label, value,
delta, spark on one line). Used by the Overview tiles, the Calendar's month line and the side columns.
Add a KPI by composing these, not by adding a card.


## Dashboard
The landing page (`#/dashboard`, and anything unknown): one week at a glance and a door to every other page. The week is this week once it
has a shift with money in, else last week, and a switch picks either. Across the top, six figures (tips, tips/hr, hours, shifts, other,
total) against the week before (weeks run Monday to Sunday everywhere, `WEEK_START` in `lib/dates.ts`); a running week is compared with the same days of last week (`lib/dashboard.ts`, tested). Under them, that
week and the one before as the Log's own grouped list (rows open the drawer here). Beside them: day capsules (height = hours, outlined = no
shift, accent outline = waiting on tips), best nights by tips/hr over 12 weeks, shifts waiting on tips with Fill in tips, and the crew with
hours only. Each card is the part its full page uses and ends in a link to that page.

## Insights (was Overview)
Recent first, and trends over noise. Its own two controls (not the Log's period): the span (this week, 2 weeks, this month) and the trend
length (12, 26, 52 weeks, all). Top to bottom: **tiles** for the span against the equal span before it (total income, tips per hour,
total per hour, hours) each with a `Delta` (arrow + %, never colour alone; hours is neutral); one **insight** line (newest shift vs your last 4
of the same weekday and type); **tips and rate by week** (bars on the left axis, the rate as dots plus a smoothed 4-week line on its own
right axis: the one chart allowed two measures); **hours per week** against a 40-hour line (hours are always a 7-day span; spans of two weeks
or more are averaged per week); **how rates are spread** (histogram, median and mean marked); **tips per hour by weekday**; then the month
in small (`MiniCalendar`) beside the 8 latest shifts (the same `Table`). All of it is `lib/trends.ts`, pure and tested.

## Money and rates
- **Tips per hour** is tips ÷ hours and nothing else. It is the only ranking metric. Wage and other income never enter it.
- **Wage** is estimated (hours × the hourly wage in effect that day, from Settings), never stored, and counts toward **Total**.
- **$/HR** in the Log is everything earned per hour; it is a figure, not a ranking.

## The Log
- **Grouped, not banded:** `lib/groups.ts` groups the period's shifts by month or week (or Flat), chosen in the panel head and
  remembered per device. A group's **band** is its own grey block (`--surface-2`, hero type) that names the month or week once,
  with a count chip ("12 shifts · 1 waiting on tips") and one figure, the group total, lined up in the Total column. No per-column
  sums. Rows under a band are indented with a guide line and only say the day ("Thu 24"); Flat drops the indent and shows the full date.
- **Columns:** Day · Time · Hours · Tips · Tips / hr · Total · Crew. Times read "6:00 PM – 2:30 AM" (`clockPlain`), never 24-hour.
  Wage, other income and crew times are not columns: they are in the opened card.
- **Opening a row** turns it into a card in place (`?shift=<id>`, so it is a link and Back closes it; the floating drawer stays shut
  on this page). The card is `ShiftDetails`: the income **mix bar** over three stacked lists (Time, Crew, Money), the same block the
  drawer shows, then Edit and Delete. Delete acts at once; the toast's Undo is the safety net.
- **Waiting on tips:** a shift with no tips and no other income (`isPending`) is one line with a "Waiting on tips" chip and a
  "Fill in tips" button, not a row of dashes. It counts in the band's chip, not its total.
- The mix bar lives only where a shift is opened (card, drawer, form Overview), never in a row or band.
- Chips (`.chip`) are words in small solid blocks, sentence case: count, Party, Waiting on tips. No mono caps.
- **Table heads are a band:** every column head (`.tbl thead th`, the Log's head row, the crew timeline's ruler row) sits on `--th-bg`
  (a step darker than the content) with `--th-ink` semibold text and a `--th-line` rule under it. Row heads down the side stay plain cells.
- No small caps anywhere: labels, table heads, weekday headers and pills are sentence case in semibold, never spaced uppercase.

## People
An identity-only roster (no shift counts, so it can't read as a leaderboard). A person's card lists the shifts they were on
("Worked together"), the month said once, with their times and nothing else: no counts, hours or money. Name is the unique handle, one person is "me", roles
are free text. It syncs to the Staff tab.

## Rules that keep it from drifting
- No raw colour or size in a component: tokens only.
- One of each: table, calendar, drawer, form, empty state, toast.
- A new page is a folder in `features/`, an entry in `router.ts` and in `app.tsx`'s groups, and a panel.
- Nothing decorative that encodes nothing: no icons where a word will do, no colour without a label.
