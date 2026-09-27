# UI contract

The look and structure of shift-sync. Every visual decision is either here or in `src/styles/tokens.css`. To change how
something looks, change this file and the token or component it names, in the same edit. Look and structure come from
Bar2.000's dashboard (its `styles.css`, `viz.js`, `calendar.js`, `stepper.js`), rebuilt as Preact components.

## Structure
- **Shell:** a dark two-tier rail, then the page. Tier one (80px) picks a group: *Shift*, *People*, *Settings*. Tier two (212px)
  lists the group's pages: Shift has *Overview*, *Calendar*, *Log*. A group with one page has no tier two. A sticky top bar
  holds the sync status and **New shift**. On a phone the five pages are a bottom tab bar.
- **Every page is one panel:** a head (title left, its controls right) and a body. Nothing else sits on the page background,
  and nothing inside is boxed again: a table runs edge to edge (`panel-body flush`), charts are a heading and a plot. On desktop
  there is no top bar: the rail carries New shift and the sync state (the top bar is phone only). The Log is a table on desktop
  and cards on a phone; its grouping and period controls live in the panel head, not in a toolbar row above the table.
- **Two levels:** you browse pages; you enter or edit a shift in a **dialog** (the form). A shift's read-only look is the
  **drawer** (a floating card *over* the page's right edge on desktop, never resizing it; a sheet on phone). Clicking anywhere
  outside it, the close button, or the open row again closes it; another row swaps it. The pencil opens the form.
- **Routes** (`router.ts`): `#/overview #/calendar #/log #/people #/settings`, plus `?shift=<id>` (drawer), `?form=<id|new>&date=`
  (form), `?person=<id|new>`. `#/earnings` and `#/rate` land on Overview.

## Tokens (`tokens.css`)
- **Surfaces:** page `--bg` < panel `--surface` (1px `--line`, soft shadow) < raised (dialog, drawer, tooltip: `--shadow`).
  `--surface-2` is an input's or tile's fill, `--surface-3` a hover. Dark mode is written twice; keep the two blocks identical.
- **Type:** Poppins, self-hosted. Title 16, body 14, small 12, eyebrow 11 caps, tiles 22/30. A mouse gets a denser scale.
- **Spacing:** 4px scale (`--s-1..7`). **Radii:** 8, 12, 16, pill. **Accent:** teal.
- **Marks:** day amber, night indigo, party rose, income sources one token each. A mark is never colour alone (letter, word or label).

## Components
- `ui/charts.tsx`: `Tiles`, `Facts`, `ColumnChart`, `DotLine`, `HBars`, `Ribbon`, `TableView`. Charts are HTML in percentages (no
  library). Every chart has a legend where colour carries identity, a tooltip on hover and focus, and *View as table*.
- `ui/MonthCalendar.tsx`: one calendar, two sizes (`browse` on the Calendar page, `pick` on the form's Date page). Weeks run Mon–Sun.
  In `browse` the day cell *is* the card: one full-cell button per shift (total large; rate and hours; start–end; a single sun/moon icon
  badge for the type, a star for a party; shade = earnings, never a type fill) or one
  "log a shift" button. The month and its nav are the panel head; more than one shift in a day stacks compact cards.
- `ui/Table.tsx`: the one grid (sort, bands, paging, group headers). `ui/PanelHead.tsx`, `ui/DrawerFrame.tsx`, `ui/toast.tsx`.
- `features/shift/ShiftForm.tsx`: pages in three groups (Info: Date, Time, Type · Income: Tips, Wage, Other · Details: Crew, Party,
  Notes), each with a live summary and a problem dot. Close and Delete confirm in place ("Discard changes?", "Delete?").

## Rail, groups and pages
Rail one is four groups: **Shift** (Overview, Calendar, Journal, Log, Summary), **Hub** (Crew week, Crew log, Other income), **People**, **Settings**
(Appearance, Hourly wage, Google Sheet, Your data). Rail two lists the group's pages, so a settings area or a hub table is a page you navigate to, never
a toggle inside another page. Below the groups: New shift, the sync state, and a one-tap light/dark switch. On a phone the groups are the bottom bar and the
group's pages a pill strip under the top bar. Routes: `#/hub/week`, `#/settings/look`, and so on; old `#/settings` lands on Google Sheet.

## Colour (`lib/theme.ts`, applied by `data/settings.ts`)
No white-on-black extremes. The page, the panel, the tints and the lines are steps of one ramp built from the background tint (Mint, Slate, Stone, Neutral);
text is four steps (ink, ink-2, ink-3, ink-4) *solved* to keep 5.3:1 / 4.5:1 or better on every surface at every contrast setting (tests enforce it).
The primary colour (presets or any custom colour) is deepened or lightened until it reads as text. `--accent-wash` is the faint primary tint used for
grouped rows, hovers and filled cells. tokens.css holds only the static defaults and the status colours; never hard-code a neutral.

## Calendar, Summary, Hub
- **Calendar:** `Month` (big cards) or `3 months` (three stacked months beside a KPI line, a month table, tips-and-rate by week, best and slowest by rate).
  A day is shaded by its tips per hour against the median of the shifts in view: above leans on the primary colour, below on amber, deeper = further out.
- **Summary:** the Log's grouped-row totals as a table: by week, month, year, weekday, type or party, every column summed, change pills for time groups.
- **Hub:** *Crew week* (bartenders as rows, Mon–Sun across; click a cell to set start and end), *Crew log* (every crew line, times edit in place),
  *Other income* (every income line, edit in place). All write through `data/store.ts` (`saveCrewLine`, `saveIncomeLine`) and sync like any edit.

## KPI parts (`ui/kpi.tsx`)
One small vocabulary, used wherever a number needs context instead of a bigger box: `Spark` (a few points, no axes), `DeltaPill` (▲/▼ + %,
never colour alone; hours are neutral), `Meter` (a figure against its ceiling: rate vs your best, hours vs 40), `MiniStat` (label, value,
delta, spark on one line). Used by the Overview tiles, the Journal's rows and week heads, the Calendar's month line and the Log's footer.
Add a KPI by composing these, not by adding a card.

## Journal
The relaxed twin of the Log: same shifts, same period control, same drawer, one roomy multi-line row each (date; when, who was on, note;
total with its rate and a delta against your average), grouped by Mon–Sun week with the week's own KPIs. The Log stays the dense grid.

## Overview
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

## The Log table
- Every column sits in a group (Shift · Time · Tips · Income · Staff · Details); the group band is the top header tier, the heads
  under it the second. Heads are 2 to 5 characters; the full name is the tooltip. A repeated head (HR) means what its group says.
- Cells are bare numbers, centred: no `$`, no `/hr`. Tips and income whole; hours and rates one decimal. Dates are `Sep 9`.
- Bar2.000's table: a quiet head, one hairline between rows, no vertical rules, no fills or tints. Two type levels only:
  **bold** (Date, HR, Tips, Total) and **muted** (Day, Start, End, both RATEs, Staff, Notes); Wage and Other are plain ink.
  Pairs read as one figure, so the pair's inner padding is tight (`pl`/`pr`: Day+Date; `pl0`/`pr0`: Start–End, touching; `pl2`/`pr2`: Tips+RATE, Total+RATE, a little air). Day and Date are left-aligned; in Start–End, Tips+RATE and Total+RATE the left
  half is right-aligned and the right half left-aligned so they meet in the middle (Start carries the small "–"); a column with a known
  widest value (Day, CT) has a fixed width (`narrow`).
  Never size, tint or highlight a column. A faint hairline opens each column group (body and both header tiers); the head is quiet (muted, light). Tips and Total and their
  RATEs are centred with little padding (`tight`). Date is the row's title: wider, larger face. A group's first column just gets a little extra room. Notes is the only left-aligned, muted column.
- Type (Day/Night) and Party are **pills** (`.badge`, soft fill, word only in the table). Nothing else in a row is decorated.
- The year shows only where nothing nearby says it and only when it isn't this year (`isPastYear`, `DateCell`).
- Bands (year > month > week) are collapsible and carry their own totals; they show while sorted by date.

## People
An identity-only roster (no shift counts, so it can't read as a leaderboard). Name is the unique handle, one person is "me", roles
are free text. It syncs to the Staff tab.

## Rules that keep it from drifting
- No raw colour or size in a component: tokens only.
- One of each: table, calendar, drawer, form, empty state, toast.
- A new page is a folder in `features/`, an entry in `router.ts` and in `app.tsx`'s groups, and a panel.
- Nothing decorative that encodes nothing: no icons where a word will do, no colour without a label.
