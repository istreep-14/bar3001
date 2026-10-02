# UI contract

The look and structure of shift-sync. Every visual decision is either here or in `src/styles/tokens.css`. To change how
something looks, change this file and the token or component it names, in the same edit. Look and structure come from
Bar2.000's dashboard (its `styles.css`, `viz.js`, `calendar.js`, `stepper.js`), rebuilt as Preact components.

## Structure
- **Shell:** the rail sits on the grey canvas (no painted bar), then the page. It lists three groups with their pages: *Shifts*
  (Dashboard, Log, Calendar, Insights, Other income), *Crew* (Crew, People) and *Settings*; below them New shift, the sync state and the
  light/dark switch (see *Rail, groups and pages*). On a phone the groups are a bottom tab bar, the group's pages a pill strip,
  and a top bar carries the sync state and New shift.
- **Every page is one panel:** `ui/Page.tsx` draws the head (title left, its controls right) and the body. A page with two views has a tab row on the
  canvas above its panel. Nothing inside a panel is boxed again except what you act on (an opened row, the Calendar's day card, a dashboard tile).
  The Log's grouping and period controls live in the panel head, not in a toolbar row above the list. A selected row is `--sel-bg` with a `--sel-bar` of `--sel-bar-w` on its leading edge.
- **Two levels:** you browse pages; you enter or edit a shift in a **dialog** (the form). A shift's read-only look is
  `ShiftDetails`: an opened row on the Log, the side card on the Calendar, and elsewhere the **drawer** (a floating card *over*
  the page's right edge on desktop, never resizing it; a sheet on phone). Clicking outside the drawer, its close button, or the
  open row again closes it; another row swaps it. The pencil or Edit opens the form.
- **Routes** (`router.ts`): `#/dashboard` (the landing page) `#/overview #/summary #/log #/calendar #/hub/{income,week,crew} #/people #/settings/{wages,sync,look,data}`,
  plus `?shift=<id>` (open shift), `?form=<id|new>&date=&page=` (form; `page` opens it on one of its pages, e.g. `crew`), `?person=<id|new>`. Retired routes (`#/earnings`, `#/rate`,
  `#/journal`, `#/log/multi`, `#/settings`, `#/hub`) land on their replacement.

## Tokens (`tokens.css`)
- **Surfaces (glass):** canvas `--bg` washed with three blooms of the accent's family (`--mesh-a/b/c`, from `theme.ts`) < panel `--glass-pane`
  (a see-through step of `--surface`, blurred) < content you act on `--glass-sheet` (the denser frost: data sheets, drawer, form, menus) < raised
  (`--shadow`). Every pane has a `--glass-line` edge, a lit top lip (`--glass-hi`) and `--shadow-glass` in the accent's hue. Sticky cells and
  avatar rings inside a sheet paint `--glass-solid` so what scrolls under them stays hidden.
  `--surface-3` is the pressed or inset shade. Dark mode is written twice (a test keeps the two blocks identical).
- **Type:** Poppins, self-hosted. Title 16, body 14, small 12, labels 12 semibold (sentence case). Tiles are `--fs-tile` (22) and `--fs-stat` (30); chart labels are `--fs-axis`. Those four stay put when a mouse densifies the rest of the ladder. `--fs-lead` follows `--fs-body`.
- **Selection:** `--sel-bg`, `--sel-bar`, `--sel-bar-w`. One recipe for a selected table row, a person, and a log card.
- **Chrome:** `--inset-x` is the toolbar inset. `--measure` is the settings column. Rail text is `--rail-ink` and `--rail-ink-hi`. Dialogs share `--overlay`, `--r-lg`, `--shadow`, and head padding `--s-3` `--s-4`.
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
- `ui/Table.tsx`: the one grid (sort, bands, paging, group headers). Two options carry the Log's reading onto other lists:
  `log` gives the Log's look (single-line rows at the Log's size, never wrapping, inset from the panel's edges under a head band
  that still runs edge to edge, a hairline between rows, a rounded hover, the accent bar on the selected row); `group` makes rows
  that share a key one **block**: no rule inside it, a separator (hairline plus a little air) between blocks, and a column marked
  `once` (the day, the chevron) filled only on the block's first row — the value is said once, like the Company column of a
  lead table. Sorting by another column breaks the blocks up and every row says it all. People, Other income and Crew use both.
  **Sorting keeps your order:** clicking a column sorts by it and the columns clicked before it break its ties (`sortBy` and
  `pushSort` in `lib/table.ts`), so sorting by Role after Name keeps names in order within a role. `weight` on columns lays the
  table out to those shares with draggable edges (remembered per table on the device); `rank` sorts ahead of any column (a
  search's best matches); `tall` makes room for two-line cells.
- `ui/DayCell.tsx`: the day on one line (weekday quiet, date bold, year only when not this one, day/night mark, party), the Log's
  day column and the first column of Other income and Crew. `ui/Avatar.tsx`: a person's circle (see *People*).
- `features/shift/ShiftForm.tsx`: opens on **Overview** (the calendar that already shows your shifts, start and end, tips, and what the
  shift adds up to with the mix bar), then pages in three groups (Info: Date, Time, Type · Income: Tips, Wage, Other · Details: Crew,
  Party, Notes), each with a live summary and a problem dot. The pages are components in `form/pages.tsx`; the page list, the form
  object and validation (`check`) are in `form/model.ts`, pure and tested. No time presets: the Time page draws your last few same-weekday shifts
  under this one. The Crew page is `CrewPicker`: type a name or a nickname and the roster filters as you type (`findPeople`), with the people
  already on the shift as chips above the field. Close confirms in place ("Discard changes?"); Delete acts at once with Undo.
- `ui/TimeField.tsx`: every editable time is hour · minute · AM/PM (`lib/time12.ts` converts), so no device shows a 24-hour clock.
- `parts/ShiftDetails.tsx`: the one read-only shift block (mix bar + Time / Crew / Money stacked lists), used by the drawer and
  the Log's opened row. Each list has a quiet Edit link that opens the form on its page (Time, Crew, Other). In the drawer the
  pencil opens the form where you came from: the Crew page from Crew, the Other page from Other income, else Overview. `ui/MixBar.tsx`: the income stacked bar, coloured from the `--cat-*` tokens, always named in the list beside it.

## Settings
One page of areas (Hourly wage, Roles, Google Sheet, Appearance, Your data), each a grey panel with its title. The rail's links still land on
their area. Hourly wage shows what the wage comes to this month as a share of the total, with the mix bar.
**Roles** (`#/settings/roles`) is the list of roles, top to bottom in rank like a server's role list: each a row (its pill, how many
people have it, up/down arrows) that opens to its name, colour (`ui/ColorPicker.tsx`, the same swatches as an avatar, or None)
and icon (one of `ROLE_ICONS` in `ui/Icon.tsx`, drawn in the role's colour, or None). Renaming a role renames it on everyone who
has it; removing one leaves it on people as plain text. Roles people have that aren't listed are offered one tap to set up, and an
empty list offers the usual roles. It syncs to the Roles tab.

## Rail, groups and pages
Rail one is three groups: **Shifts** (Home, Plan week, Insights, Log, Table, Calendar, Other income), **Crew** (Crew, People) and **Settings** (one page). A page
with two views has a tab row on the canvas above its panel, each view its own route: Insights is *Trends* (`#/overview`) and *Totals*
(`#/summary`); Crew is *Week* (`#/hub/week`) and *Every shift* (`#/hub/crew`). Settings is one page whose areas are still linked
(`#/settings/wages` and so on). Retired pages land somewhere sensible: `#/journal` and `#/log/multi` open the Log. Below the groups:
New shift, the sync state, and a one-tap light/dark switch. On a phone the groups are the bottom bar and the group's pages a pill strip
under the top bar.

## Colour (`lib/theme.ts`, applied by `data/settings.ts`)
No white-on-black extremes. The page, the panel, the tints and the lines are steps of one ramp built from the background tint (Soft grey, the
default, then Mint, Slate, Stone, Neutral). The canvas is a light grey under soft accent blooms, panels are frosted glass a step or two above it, and only what you act on (the table,
a field, an opened row) reaches the near-white top step;
text is four steps (ink, ink-2, ink-3, ink-4) *solved* to keep 5.3:1 / 4.5:1 or better on every surface, on the blooms and on glass over them, at every contrast setting (tests enforce it).
The primary colour (presets or any custom colour) is deepened or lightened until it reads as text. `--accent-wash` is the faint primary tint used for
grouped rows, hovers and filled cells. tokens.css holds only the static defaults and the status colours; never hard-code a neutral.

## Calendar, Totals, Crew, Other income
Calendar has three views: Week (the week strip with its tips, income and people rows, then the week on the clock and eight weeks of
income by source), Month
(cells with no outlines: an empty day is a soft square, a booked shift leads with its start time, a shift waiting on tips is hatched, each
shift has a time bar on the 10 AM–4 AM working day) and 3 months.
- **Calendar:** on desktop the opened shift shows in the side column beside the month (`ShiftDetails`, so the floating drawer stays shut),
  with the month's numbers under it. `Month` (big cards) or `3 months` (three stacked months beside a KPI line, a month table, tips-and-rate by week, best and slowest by rate).
  A day is shaded by its tips per hour against the median of the shifts in view: above leans on the primary colour, below on amber, deeper = further out.
- **Totals** (Overview's second view, `#/summary`): the shifts in the period folded into a table: by week, month, year, weekday, type or party, every column summed, change pills for time groups.
- **Crew** (`#/crew`) and **Income** (`#/income`) are read-only sheets in the Log's look, with one header row (no group band above it).
  One row per bartender, or per money line. A shift's rows are one block: the day (`DayLine`, type and party included) is said once,
  you first then by start on Crew, tips then wage then other on Income. Your own crew line is the gold row. Hours are one decimal;
  income amounts keep cents, tips strongest, wage quieter and noted Estimated. The foot counts the lines and sums hours or amount.
  A row opens its shift; Add to a shift opens the form on Crew or Other. On Crew the columns are Shift, Station, then the clock.
  Each bar holds the face and name on the left and the start–end on the right, in that person's colour, and the hours sit just
  after the bar. A line with no end is dashed. Planning the week stays on Plan week.

## KPI parts (`ui/kpi.tsx`)
One small vocabulary, used wherever a number needs context instead of a bigger box: `Spark` (a few points, no axes), `DeltaPill` (▲/▼ + %,
never colour alone; hours are neutral), `MiniStat` (label, value,
delta, spark on one line). Used by the Overview tiles, the Calendar's month line and the side columns.
Add a KPI by composing these, not by adding a card.


## Blocks (`parts/blocks/`, numbers in `lib/blocks.ts`, tested)
Rounded cards that each hold one idea, after the HR-dashboard family the app follows: a title top left, a round ↗ to the page behind it top
right, big thin figures, pill splits, one dark (`inverse`) card per group for today or what needs you, hatching (`--hatch`) for a day off, a
day outside the month or a week still running. Pieces: `Block` (glass / inverse / bare), `WeekCards` (the week as seven squarish
cards across — a day to come leads with its start time, a day worked with its tips and rate, a day off is hatched — with optional rows
lined up under the cards, one cell per day: time, hours, tips, income by source, the crew listed down each day, or one row per bartender
with their own times; a Details switch shows or hides the rows and the page remembers it), `WeekAgenda` (kept for later: the same week as
seven rows down on a date rail —
days to come lead with their start time, days gone with what they paid, a day off is a hatched strip that adds a shift — and the week in
three figures under it), `WeekTimeline` (the week on one clock, a block per shift from start to end and a hairline per bartender on with
you), `IncomeStack` (income per week stacked by source, one pill per source), `RateDots` (weekday × week dot matrix of tips/hr),
`RunningMonth` (this month's running total against last month's), `RateTrend` (tips/hr with its 4-week average), `WeekBars`, `HoursRing`,
`PillSplit`, `BigStats`, and the compact calendars (`Compact.tsx`): `DayChips` (a run of small date tiles — two-digit day, weekday,
that day's tips or a booked start time, today lifted in the accent), `DayHeatmap` (GitHub-style, a column a week and a row a weekday,
squares shaded by quartile of tips, rate or hours) and `MiniMonth figures="tips"` (a small month with each day's tips written in its
square). Shades come from `levelScale` (quartiles of the days in view) so one big night doesn't wash out the rest. Lines are monotone curves (`ui/smooth.ts`) so a running total never dips. Every chart has a "View as table".

## Home (`#/dashboard`, numbers in `lib/home.ts`, tested)
One selected shift, shared by the week list, the month, the bars and the recent table. Selecting does not open the drawer.
Clicking the selected recent row opens it. A shift waiting on tips offers Fill in tips. The tips chart has the full width and is the
tall piece. Under it, on a wide screen, the week and the month stack beside the recent shifts. The month opens on the selected
shift, and a shift outside the usual three weeks pulls the bars with it. Tips by week runs the full width under that:
- **Last 7 days** (`Figures`): take-home (the dark lead), tips, hours, tips/h and total/h, each against the 7 days before, with a spark
  of the last 8 weeks.
- **This week** (`WeekAgenda`, compact): seven short rows. A day worked leads with its tips, a clocked-out shift with no tips says
  Tips?, a day ahead leads with its start time, a day off is one thin line. Plan week and Log shift sit on the block. Stepping the
  week is the list's own arrows.
- **Tips per shift**: one bar per shift from 21 days ago through 7 days ahead, or centered on the selected shift when that falls outside. Bars are tips (`ComboChart`). The dots are that shift's
  tips per hour and the line is the average of the last four rates. A shift with no tips yet is a gap, not a zero. View as table sits
  under it. The line under the chart names the selected shift.
- **Month** (`MiniMonth`): opens on the selected shift's month. Picking a day selects its shift (the one already selected, otherwise the first). An empty day still starts
  a shift.
- **Recent shifts**: the latest finished shifts, each against shifts like it on tips/h. "Like it" (`similarShifts`): always the same
  day or night, the same party-or-not, and the same weekday when there are 4 or more of those; with too few it drops the weekday,
  then the party.
- **Tips by week**: eight weeks, tips as bars and tips per hour as the line, with the 4-week average. This is the Insights chart, shorter.

## Plan week (`#/hub/week`)
The schedule comes Monday to Sunday all at once, so it goes in here at once: day cards across the top (a shift's start, type and party,
or Book), a row per bartender with their own times and station per day (tap to set; a dashed + adds them to that day's shift), hours
along each row and down each day. Book asks only start, day or night (guessed from the start) and party, and puts you on the crew.
An empty week offers "Book it like last week" (days, starts, crew and stations; no ends or tips), undoable.

## Insights (was Overview)
Recent first, and trends over noise. Its own two controls (not the Log's period): the span (this week, 2 weeks, this month) and the trend
length (12, 26, 52 weeks, all). Top to bottom: **tiles** for the span against the equal span before it (total income, tips per hour,
total per hour, hours) each with a `DeltaPill` (arrow + %, never colour alone; hours is neutral); one **insight** line (newest shift vs your last 4
of the same weekday and type); **tips and rate by week** (bars on the left axis, the rate as dots plus a smoothed 4-week line on its own
right axis: the one chart allowed two measures); **hours per week** against a 40-hour line (hours are always a 7-day span; spans of two weeks
or more are averaged per week); **how rates are spread** (histogram, median and mean marked); **tips per hour by weekday**; then the month
in small (`MiniCalendar`, shaded by rate the way the Calendar is, with the same key) beside the 8 latest shifts (the same `Table`). All of it is `lib/trends.ts`, pure and tested.

## Money and rates
- **Words:** a rate is **Rate** wherever a label is short (heads, stat lists, KPIs) and *tips per hour* in sentences and
  chart titles; a shift's sum is **Total**; a shift's state is Done, **Awaiting tips** or **Upcoming** (`STATUS_LABEL`).
- **Tips per hour** is tips ÷ hours and nothing else. It is the only ranking metric. Wage and other income never enter it.
- **A rate is written one way:** `perHour` in `lib/format.ts`, '$12.40/hr', two decimals like all money. Where the unit
  already sits beside it (a Rate column head, a small '/hr' span, a label that says per hour) the figure is `money` of the
  same number. `perHourWhole` ('$12/hr') only where two decimals cannot fit, a calendar day's chip; chart axes use `moneyWhole`.
- **Wage** is estimated (hours × the hourly wage in effect that day, from Settings), never stored, and counts toward **Total**.
- **$/HR** in the Log is everything earned per hour; it is a figure, not a ranking.

## The Log
- **Grouped:** `lib/groups.ts` groups the period's shifts by month, week, or flat, chosen in the panel head and remembered per
  device. A group's heading is no block, just its name, a count chip ("12 shifts · 2 awaiting tips · 1 upcoming") and the
  group's tips and total lined up in their columns, on a hairline: a quiet break, like the lists on Other income and Crew. Flat
  drops the heading; the head reads "Shift" instead of "Day".
- **The day** leads with a small calendar-page chip (the month on a band in its own colour, one hue per calendar month, over the
  day number) that anchors the row the way an avatar anchors a person; beside it the weekday and date, and under them the shift's
  times, the quietest text in the row (small, light, italic), in the tightest form (`6p → 2a`, `11a → 5:30p`: `clockTight`,
  minutes only when there are any). The two lines sit a touch low so the date is near the row's middle; rows are a little taller
  than a single line to hold them.
- **Columns:** Day · Type · Party · Hours · Tips · Rate · Wage · Other · Total · Crew. Type (sun or moon, in the day/night colour)
  and Party (the star) are narrow icon columns, blank when there's nothing to say. Every column but Day can be hidden from the
  small Columns button in the head's right corner (`ui/ColumnMenu.tsx`; remembered per device, the button turns the primary
  colour while any are hidden); the group heading's tips and total follow their columns, or go when they do.
- **Tips lead.** They're what says how a shift went: the strongest figure in the row (bold, a size up). **Rate** is tips per
  hour alone, set like Total (same size and weight) in a full-height **pill** tinted off one continuous scale from red at the
  bottom, through plain ink in the middle, to green at the top (`color-mix`, so every step shows, not a few bins). After it a
  slim **rank bar** stood on end fills from the bottom as far as the rate ranks among the shifts listed (`lib/meters.ts`
  `standing`). Hovering says it in words: the share of shifts it beat, and the dollars above or below your average (the
  listed shifts' Rate). It is `ui/RateFigure.tsx` fed by `rateContext` in `lib/stats.ts`, and the phone's Log cards use the
  same part, so a shift reads as good or slow the same way on either (a card's pill carries its '/hr'; a shift short of
  its money shows a dash for its total and rate, as the row does).
- **Hours** sit in a faint **clock ring**, set like Total, with no unit (the head says hours): the shift's stretch drawn round
  the figure as a thin, half-strength arc on an unseen 12-hour clock, in its day or night colour (6p to 2a runs from the 6
  round to the 2; twelve hours or more closes the ring), so the figure leads. Hovering gives the times. Wage and Other are
  medium weight.
- **Rate, Hours and Total stand the same height** (`--fig-h`, 2.25rem), so the row's figures read as matching blocks.
- **Total** has a **stack bar** under it, exactly its width: tips, wage and other side by side in their own colours (the mix
  bar's), each as wide as its share. Hovering names the amounts.
- These micro charts are small visuals only; full charts live elsewhere.
- **Sizes:** rows are 3.25rem with 1px of vertical padding, so the cells have the height; figures are 15px, Tips 17px, the day
  16px on a bigger calendar chip, and the crew faces nearly the row's full height (42px) so people can be told apart: two of them, then +N, and hovering the stack names everyone.
- **Inline meters and tooltips** are shared (`ui/Meters.tsx`, `.rankbar` / `.stackbar` / `.dial` / `.figure` / `.tip` in `ui.css`) for other tables:
  a meter is decoration for sighted readers, and whatever uses one says the same thing in a `data-tip` tooltip and sr-only text.
- **Wage** (a flat rate times hours) and **Other** (usually nothing, and not about how the shift went) are
  quiet columns with no rate of their own, blank when there's none. **Total** adds everything up, a step quieter than Tips.
  The Dashboard's narrower card hides Wage and Other.
- **Opening a row** turns it into a card in place (`?shift=<id>`, so it is a link and Back closes it; the floating drawer stays shut
  on this page). The card is `ShiftDetails`: the income **mix bar** over three stacked lists (Time, Crew, Money), the same block the
  drawer shows, then Edit and Delete. Delete acts at once; the toast's Undo is the safety net.
- **A shift short of its numbers** (`shiftStatus` in `lib/groups.ts`: *scheduled* has no end time yet, *worked* clocked out but
  logged no tips or other income) is the same row, not a different layout — muted text colour (scheduled also italic), dashes
  where the money isn't known yet. Only `done` shifts count toward any total anywhere in the app (`stats.ts`'s `summarize`
  filters to them first), so a shift can't skew a number before it's actually known.
- The mix bar lives only where a shift is opened (card, drawer, form Overview), never in a row or band.
- Chips (`.chip`) are words in small solid blocks, sentence case: the band's count, Party (a small icon here specifically,
  still a chip on the phone card). No mono caps.
- **Table heads are a band:** every column head (`.tbl thead th`, the Log's head row, the crew timeline's ruler row) sits on `--th-bg`
  (a step darker than the content) with `--th-ink` semibold text and a `--th-line` rule under it. Row heads down the side stay plain cells.
- No small caps anywhere: labels, table heads, weekday headers and pills are sentence case in semibold, never spaced uppercase.

## Table (`#/table`)
The Log's plain sibling: every shift in the period as one row, for looking things up and sorting rather than reading how
shifts went. People's toolbar (search notes, crew names and dates as written; Filter by type, weekday, party, status, crew; a
count) over the shared `Table` in its **data grid** variant (`grid`): small uppercase heads with a little tracking (the sorted
one dark, its arrow in the accent), hairline rows at 36px, the date held in place while the rest scroll sideways, and a
totals row pinned to the bottom. Below 70rem the grid scrolls sideways rather than crushing its columns.
- **Date:** `04 Sep 26`, one style, the year a weight lighter. Under it, side by side, the short weekday and the type, each
  led by a glyph the same size (a calendar; the sun or moon). The type's word is coloured by how the shift went,
  continuously from red through plain ink to green by where its rate stands among the done shifts listed
  (`lib/meters.ts` `standing`, `scaleColor`); a shift short of its tips stays grey. A party is a pink star after it.
- **Time & hours:** start over end beside a small rail (a hollow dot for the start, a solid one for the end), the hour
  padded so the colons line up (`clockParts`), then the hours, set like Tips. No overnight marker; the rail and the hours
  say it. Sorts by start.
- **Tips** (a weight up) and **Rate** (a short bar, a share of the best rate listed, then the figure). Wage, Other and
  Total aren't in this view.
- **Crew:** up to three faces then +N, and the hours everyone worked on the bar. Hovering or focusing it opens a card
  (`ui/HoverCard.tsx`) listing each person with their face, name (a crown for you) and own hours, and the bar's total.
- **Status:** a soft pill with a dot, outlined in its own colour: green done, amber awaiting tips, grey upcoming. **Note**
  last, cut off with an ellipsis.
- **Type:** everything is Poppins. Figures use even-width digits (`tabular-nums`), and times pad a one-digit hour with a
  figure space, so digits and colons line up down a column. (Monospaced faces were tried and set aside.)
- **Sizes:** the one-value columns read a size up from the two-line cells (Tips and Rate 16px, the hours 15px, the
  crew's faces 30px, the status pill 28px tall); rows are 36px, the two-line cells set tight to fill them, so a single figure fills its row instead of looking lost in it.
- **Totals row:** every done shift the search and filters leave, not only this page: hours, tips, rate (tips over hours
  across the shifts that have both, the same Rate as the side panels) and the bar's hours. It is the page's summary, so there's no side panel.
- A row opens the shift in the drawer; a shift short of its numbers reads greyed. On a phone: Date, Time & hours and Tips.

## People
An identity-only roster (no shift counts, so it can't read as a leaderboard), in the Log's look, read like a chat app's member
list. Rows are a touch taller than the Log's (`Table` `tall`) for two-line cells. Columns, by share of the width: Person (widest) ·
Role · ID · Status · Me · Mgr (the last two narrow); drag the edge between two heads to resize (remembered on the device;
double-click an edge to reset). Notes aren't a column (they're in the drawer, and the search still reads them).
- **Person:** the avatar, framed in their main role's colour (their own colour when the role has none; full strength round a
  photo), with a small status dot on its lower right
  edge (green active, red inactive); on top the short name they go by in bold, a gold crown if it's you, a blue shield if they
  manage, and their employee ID as a small tag; under it, small, italic and quiet, their first and last name.
- **Role:** the main role: a small square tinted in its colour holding its icon (a dot if none), then its name in that colour
  (leaning toward the ink so it reads); the other roles under it, smaller. Sorting by Role follows Settings' rank.
- **ID** is also its own column (a small grey tag, `#` and the number in monospace: `.idtag`, `--font-mono`). **Status** is a pill:
  a dot then the word. **Me** and **Mgr** repeat the marks as columns (mark and "You"/"Mgr", or "No") so the list sorts by them.
- **Row formatting stays quiet:** the role's colour lives only in the Role cell and the avatar's frame. Being you or a manager tints the row's fill (gold
  `--me-wash`, blue `--mgr-wash`; yours wins, so as a manager you get both marks but the gold row); inactive greys the row (text,
  avatar and marks). A tinted row deepens on hover and when selected.
- **Search** matches names and aliases the same way the shift form's crew picker does (`findPeople`: exact, then starts with, then a later word starts
  with, then contains), then roles, ID and notes; the best matches stay on top whatever column is sorted under them (`Table`
  `rank`). **Filter** (`ui/FilterMenu.tsx`, `lib/filters.ts`) picks any mix of role, other roles, status, manager and photo, with
  a count beside each value and a removable chip for each pick.

A person's card lists the shifts they were on
("Worked together"), the month said once, with their times and nothing else: no counts, hours or money. Name is the unique handle, one person is "me", roles
are free text. It syncs to the Staff tab. A person has one **main role** (`role`) and any number of others (`roles`); a row from
before the main role existed reads its first role as main until it is saved (`rolesOf` in `lib/people.ts`).
- **Aliases** (*Also known as*): zero or more other names a person goes by (a nickname, a short name, a common misspelling).
  `lib/people.ts`'s `findPeople` matches what's typed against the name, first, last and full name and every alias (case and
  accents ignored; a name beats an alias at the same strength) and says which alias matched. The People search and the shift
  form's crew picker both use it, and a hit by alias reads *as "Marky"*.
- **Avatar:** the circle everywhere a person shows (the Log's crew stack, Crew, People, the drawer's head). A photo if they have one
  (cropped square and shrunk to 160px on the device, so it fits a Sheet cell); else their letters (their own, up to 3, or their
  initials) on their colour: one of the palette swatches (tokens, so it follows the theme), any colour by hex (its letters lean
  toward the ink so a pale pick still reads), or Auto, picked from their id. A photo covers the letters but they are kept, so
  removing it brings them back. Their colour stays behind the photo as a **backdrop**: their hue at one lightness and a soft
  chroma for everyone (`--photo-bg-l` / `--photo-bg-c`; light in both themes, a touch less in dark), so a cut-out photo's see-through parts show a colour
  that tells people apart by hue while every backdrop keeps the same contrast with the page. **Picking a photo takes its
  background out** on the device (`features/people/cutout.ts`: MediaPipe's selfie segmenter, the model's confidence
  becoming each pixel's opacity with a soft edge), in about half a second once loaded. "Keep the background" puts the picked
  photo back as it was; a stored photo that still has its background (a JPEG) offers "Remove background". If it can't run
  (the first cut-out needs a connection to load it), the photo is kept as it is and the editor says why. A cut-out is stored
  as WebP (or PNG), stepping the size down to fit the cell; an opaque photo is a JPEG. `ui/Avatar.tsx` draws it from props; `parts/PersonAvatar.tsx` looks the person up.

## Rules that keep it from drifting
- No raw colour, weight or size in a component: tokens only (colours and weights are tested; the Log's 15px and 17px figures are `--fs-fig` and `--fs-tips`; other font sizes are still literal, ISSUES.md #19).
- One of each: table, calendar, drawer, form, empty state, toast.
- A new page is a folder in `features/`, an entry in `router.ts` and in `app.tsx`'s groups, and a panel.
- **Where a part lives says what it may touch** (`tests/layers.test.ts` checks it): `ui/` is generic. It may navigate, and it may
  read or write the shared period (`data/scope.ts`) and remembered view choices (`data/persisted.ts`) — the period control, a
  table's page size, toasts and the viewport are module state on purpose. It may not import the store or the sync client.
  `parts/` holds domain parts more than one page uses (a shift's card, the grouped list, the sync pill) and may read the store;
  `features/<page>/` is one page and what only it uses. `parts/` never imports a page.
- **Styles:** `tokens.css` values, `base.css` type roles, `ui.css` controls (buttons, fields, table, chips, time field), `layout.css`
  how a page is laid out (panel, split, side column), `charts.css` what goes in it (charts, tiles, calendars, KPI parts), and a
  `.module.css` beside any component with styles of its own. The two dark blocks in `tokens.css` are checked identical by a test.
- Nothing decorative that encodes nothing: no icons where a word will do, no colour without a label. (A role's icon and colour
  always ride with its name; the crown carries "(you)" for screen readers and the status dot the word in its column.)
