# shift-sync

Local-first shift log. The phone app stores shifts in IndexedDB and works offline;
a Google Sheet is the synced copy you can also edit by hand. Conflicts resolve
last-write-wins per row on `updated_at`.

The UI contract (structure, tokens, components, table rules): [DESIGN.md](DESIGN.md). Known
problems and drift hazards: [ISSUES.md](ISSUES.md). The look follows Bar2.000's dashboard.

Stack: Vite 8 + Preact 10 + `@preact/signals` + TypeScript, installable PWA
(vite-plugin-pwa). No backend beyond Apps Script. ~6,600 lines of `.ts`/`.tsx`/`.css` in
`src/`, 146 tests, no test framework dependency (`node --test` only).

One more runtime dependency, loaded only when a person's photo is picked: `@mediapipe/tasks-vision`
(Apache-2.0) takes the background out of the photo on the device (`features/people/cutout.ts`, with the
selfie-segmenter model in `src/assets/`). Its ~12 MB runtime isn't installed with the app; the service worker
keeps it after first use, so the first cut-out needs a connection.

```
core/                 core.js + core.d.ts: the sync rules. Plain ES5 so Apps Script can run it. Edit here only.
apps-script/          Code.gs (hand-written) + core.gs (generated): the Sheet side
scripts/              sync-core.mjs (the generator) + the migration converters and their CLI wrappers
public/               icons, copied verbatim into the build
index.html            the Vite entry HTML
vite.config.ts        base './' and hash routing, so the build hosts anywhere
tsconfig.json         strict + noUncheckedIndexedAccess + noUnusedLocals/Parameters
src/
  main.tsx            mounts <App/>, then boot().then(startSync)
  app.tsx             the shell: rail, top bar, page dispatch, and the drawer/form overlays
  router.ts           hash routes and query params, as signals
  data/               state, persistence and network (the only layer that touches a device)
  lib/                pure helpers: every derived number in the app is computed here, never stored
  features/           one folder per page
  parts/              domain parts more than one page uses; may read the store
  ui/                 generic parts, props-driven; may navigate, never read or write data
  styles/             tokens.css, base.css, ui.css, layout.css, charts.css
tests/                node:test, run with Node's own type stripping
```

## Develop

```
npm install
npm run dev        # sync:core then vite -> http://localhost:5173
npm test           # 146 tests
npm run typecheck  # sync:core then tsc --noEmit
npm run build      # sync:core, typecheck, then vite build into dist/
```

`dev`, `build`, `typecheck` and `test` all run `sync:core` first, so you never have to
remember to. Node 22.18+ (the tests execute `.ts` files directly, using Node's type
stripping — no ts-node, no transpile step). `tsconfig.json` sets `erasableSyntaxOnly` to
keep that possible.

## How the code is wired

Nothing imports upward. Read the list below as "may import":

```
app.tsx                 -> features/, parts/, ui/, router.ts
features/<page>/        -> parts/, ui/, data/, lib/, router.ts   (never another features/ folder)
parts/                  -> ui/, data/store.ts, data/sync.ts, lib/, router.ts   (never features/)
ui/                     -> lib/, router.ts, data/scope.ts, data/persisted.ts
                                                    (never data/store.ts or data/sync.ts)
data/                   -> lib/, core.generated.js
lib/                    -> other lib/, core.generated.js
                                              (never data/, never preact, never the DOM)
core.generated.js       -> nothing at all
```

The two lines that carry the most weight:

- **`lib/` is pure.** Nothing in it imports `data/`, `preact` or the store, and every helper
  takes its data as an argument. That is why 19 of the 20 files are directly unit-tested with
  no mocking, and it is worth protecting — it is the reason the interesting logic is testable
  at all. The two deliberate exceptions are `dates.today()` (reads the clock — see item 10 in
  [ISSUES.md](ISSUES.md)) and `id.uid()`'s `crypto.randomUUID` fallback.
- **`ui/` may not reach the store**, `parts/` may. `tests/layers.test.ts` checks this, but
  only weakly — see [ISSUES.md](ISSUES.md#8-the-layering-test-is-two-regexes-over-raw-text).

`core/` is the sync rules and the row shapes. It has no imports of its own and does no I/O,
which is what lets the *same file* run in the browser, in Node tests, and in Apps Script.
It is the one place a sync or money rule may live.

### What each layer is for

| Layer | What lives there | What it is for |
| --- | --- | --- |
| `core/` | `core.js`, `core.d.ts` | The row shapes and every sync/money rule. The only layer shared verbatim with Apps Script. |
| `lib/` | 20 files, no `data/`, no preact | Every derived number in the app. `stats.ts` is the hub — it builds `ShiftView` (a shift plus its income, its crew and every computed figure) and `Summary`. `dates.ts` is the root of the graph; `id`, `ruler`, `table`, `theme`, `time12` are leaves. |
| `data/` | `db` `store` `sync` `settings` `scope` `persisted` `roles` | The only layer that touches a device. `db.ts` is IndexedDB, `store.ts` holds the signals and is the only write path, `sync.ts` is the Apps Script client, `settings.ts` owns the API URL/token/theme, `persisted.ts` backs view choices (grouping, page size) with validated localStorage. |
| `ui/` | 26 modules | Generic parts: the one table, the one calendar, the one drawer frame, the chart set, the KPI vocabulary. |
| `parts/` | `ShiftDetails` `ShiftLog` `SyncPill` `PersonAvatar` `RoleTag` | The five domain parts more than one page uses, and the only UI that may read the store. |
| `features/` | 10 folders, one per page | A page and whatever only it uses. |

## How data flows

**Boot.** `main.tsx` renders, then `store.boot()` loads all six IndexedDB tables into
signals, then `sync.startSync()` wires the change handler and does a first sync.

**A write.** Every write is the same three steps, in `store.ts`: update the signal, persist
to IndexedDB, ask sync to run. Components read signals and change data only through the
store's actions — there is no other write path.

**A sync.** `sync.ts` POSTs only the rows flagged `_dirty` to the Apps Script endpoint,
receives the full merged set back, and reconciles it with `reconcileClient` from core. Three
rules make this safe:

- A local row that is dirty *and* newer than the server's wins, so an edit made while the
  request was in flight is not lost.
- A local row the server did not return is dropped (deleted in the Sheet) — unless it is
  dirty, or its id is in the server's `held` list.
- A held id is a Sheet row the server could not parse. It is left exactly as it is locally
  and reported in `sheetProblems`, so a typo is visible and fixable instead of silently
  duplicating or eating the row.

Deletes are soft on both sides (`deleted: true`), which is what makes undo and the
last-write-wins merge work.

**The generated core.** `core/core.js` is the source. `scripts/sync-core.mjs` derives the
other two copies so nobody pastes by hand:

```
core/core.js  --sync-core-->  apps-script/core.gs     verbatim, paste into the Sheet project
                            ->  src/core/core.generated.js  the same code plus ES exports
                            ->  src/core/core.generated.d.ts  a copy of core/core.d.ts
```

`src/core/` is generated and git-ignored, so a fresh clone and CI do not have it until the
first `sync:core`. `core/core.d.ts` is hand-maintained — see [ISSUES.md](ISSUES.md) before
adding an export to `core.js`.

## Data model

Six tables. `Shifts` is the parent; the rest hang off it by `shift_id`, or stand alone.

| Table | What it is | Notable |
| --- | --- | --- |
| **Shifts** | one row per shift | `other` is a legacy single amount, still counted, no longer edited; `party` is a flag; times are integer minutes, `end < start` means past midnight |
| **Income** | other money on a shift, 0..n per shift | `category` is one of `CATEGORIES`; hand-typed `cash` is normalised |
| **Crew** | one row per bartender on a shift, including you | a person appears at most once per shift; the Sheet's last `hours` column is derived, never read |
| **Staff** | the employee roster, identity only | `name` is the unique handle (case-insensitive); exactly one person is `is_user`; `role` is the main role and `roles` the others (never repeating it; a row with no `role` reads its first role as main); `roles` and `aliases` are one comma-separated cell each in the Sheet; `photo` is a small `data:image` URL in its cell (45,000 characters at most), `avatar_color` a `#rrggbb` or palette name, `avatar_text` up to 3 characters |
| **Wages** | your hourly rate by the date it starts | in effect until the next row's date; a shift's wage is estimated, never stored |
| **Roles** | the roles people can have | `name` is unique (case-insensitive) and is what Staff's `role`/`roles` hold, so renaming one renames it on everyone; `color` is `#rrggbb` or a palette name; `icon` an icon name the app draws; `sort` is rank, lowest first |

**Nothing derived is stored.** Hours, tips/hr, totals, crew hours and wages are all computed
from the raw rows. The one rule that catches people out: `stats.summarize` (and therefore
every total, average and chart) **drops half-logged shifts**. `lib/groups.ts` defines
"pending" as anything that is not `done`:

- `scheduled` — `end == null`. A start time alone does not mean the shift happened.
- `worked` — clocked out, no money in yet.
- `done` — money is in. Only these count toward a total.

**Two rates, deliberately different.** `tph` is tips ÷ hours and is the only ranking
metric; wage and other income never enter it. `perHour` is everything earned ÷ hours, and
is a figure, not a rank. Both are null rather than zero when they cannot be computed.

## Screens

`router.ts` defines 13 routes; `app.tsx` dispatches them. Rail groups and page anatomy are
in [DESIGN.md](DESIGN.md#rail-groups-and-pages).

| Route | Screen | File |
| --- | --- | --- |
| `#/dashboard` | Dashboard (landing) | `features/dashboard/DashboardScreen.tsx` |
| `#/overview` | Insights → Trends | `features/overview/OverviewScreen.tsx` |
| `#/summary` | Insights → Totals | `features/summary/SummaryScreen.tsx` |
| `#/log` | Log | `features/log/LogScreen.tsx` |
| `#/table` | Table | `features/table/ShiftTable.tsx` |
| `#/calendar` | Calendar | `features/calendar/CalendarScreen.tsx` |
| `#/hub/week` | Crew → Week | `features/hub/HubWeek.tsx` |
| `#/hub/crew` | Crew → Every shift | `features/hub/HubCrew.tsx` |
| `#/hub/income` | Other income | `features/hub/HubIncome.tsx` |
| `#/people` | People | `features/people/PeopleScreen.tsx` |
| `#/settings/{look,wages,sync,data}` | Settings (one page, four areas) | `features/settings/SettingsScreen.tsx` |

Overlays ride on top of any screen, as query params rather than routes: `?shift=<id>` (the
drawer), `?form=<id|new>&date=` (the form), `?person=<id|new>`. On desktop the Log and the
Calendar render an open shift inline instead, so the floating drawer stays shut there.

Six retired routes (`earnings`, `rate`, `settings`, `hub`, `log/multi`, `journal`) are
mapped to their replacements in `router.ts`, so old links still land somewhere sensible.

**The shift form** is split three ways: `features/shift/form/model.ts` is the page list, the
form object and validation — pure, and the only part with tests. `form/pages.tsx` draws the
ten pages. `ShiftForm.tsx` holds the state and the derived figures. The rule is that
`model.ts` never imports the store or touches the DOM.

## Rules that keep it growable

- Sync logic lives in `core/core.js` only. Never re-implement it in the UI.
- Derived numbers are computed in `lib/`, never stored.
- Components read signals from `data/store.ts` and write only through its actions.
- `lib/` stays pure — no `data/`, no `preact`, no clock reads (except `dates.today()`, which
  is the one deliberate exception, and `id.uid()`'s fallback).
- `WEEK_START` in `lib/dates.ts` is Monday. Change it there and nowhere else; `tests/weeks.test.ts`
  fails if any page disagrees.
- No raw colour or size in a component: `styles/tokens.css` only.
- Where a part lives says what it may touch — enforced by `tests/layers.test.ts`.
- One of each: table, calendar, drawer, form, empty state, toast.

## Setup

1. **Sheet.** New Google Sheet, then Extensions > Apps Script.
2. Create two script files: `Code.gs` (from `apps-script/Code.gs`) and `core.gs`
   (from `apps-script/core.gs`, generated by `npm run sync:core`).
3. Run `setup` once from the editor and approve permissions. It creates the
   `Shifts` tab and prints your token under View > Logs. It never deletes data.
4. **Deploy** > New deployment > Web app. Execute as: *Me*. Who has access: *Anyone*.
   Copy the `/exec` URL. (The token is what protects it.)
5. **Host `dist/`** (from `npm run build`) on any HTTPS host: GitHub Pages, Netlify, Cloudflare Pages.
   The build uses relative paths and hash routing, so a subpath works with no config.
6. Open the app, paste the URL and token, then add it to your home screen.

Existing Sheet? Re-paste `Code.gs`/`core.gs` (run `npm run sync:core` first), run `setup` again (it adds the `party` column,  the `other`/`shift_type` headers and the `Income`, `Staff`, `Crew` and `Wages` tabs, the Crew `hours` column, the Staff `aliases`, `photo`, `avatar_color`, `avatar_text` and `role` columns, and the `Roles` tab), then deploy a new version. A Staff tab from before those columns still syncs; they read as empty until `setup` names them. Until the script is updated, the app keeps aliases, photos, avatar colours, main roles and Roles on the device only: an older script doesn't know them, so the app holds on to its own copy, leaves those people unsynced, and shows a banner on the Log until a script that knows them syncs.

After editing `Code.gs`/`core.gs`: Deploy > Manage deployments > edit > **New version**,
or the URL keeps serving old code.

## Editing in the Sheet

- Type dates as `YYYY-MM-DD` and times as `HH:MM` (24h). Past midnight is fine: `18:00`-`02:00` = 8h.
- New rows typed by hand get an `id` and `updated_at` automatically.
- **Wages tab** = your hourly wage by start date (`date` = the day it starts applying). Edited from Settings > Hourly wage; the app estimates each shift's wage from it.
- **Staff tab** = the roster. `aliases` is one cell, comma-separated (`Abs, AC`); `avatar_color` is `#rrggbb` or one of teal, orange, green, cyan, violet, pink, blue, rose, indigo; `avatar_text` is up to 3 characters; `role` is the main role (keep it out of `roles`). Leave `photo` to the app.
- **Roles tab** = one row per role: `name`, `color` (`#rrggbb` or teal, orange, green, cyan, violet, pink, blue, rose, indigo, gold), `icon` (cocktail, beer, bell, box, door, key, music, chef, bolt, heart, flame, sparkle, star, shield, crown, users) and `sort` (rank, lowest first). Rename a role in the app, not here: the app renames it on everyone who has it.
- **Crew tab** = child rows of Shifts too, the hub between Shifts and Staff (its last column, `hours`, is derived): one per bartender on the shift (`staff_id` is the person's id from the Staff tab; `name` is just a readable copy). Managed from the app's shift drawer.
- **Income tab** = child rows of Shifts, zero to many per shift, linked by `shift_id` (copy the shift's `id`).
  `category` is one of Chump, Cash, Venmo, Consideration, Overtime (dropdown; typing `cash` also works).
  Delete by `deleted` = TRUE or deleting the row. Deleting a shift in the app also deletes its income.
- The old single `other` column on Shifts is kept and still counted, but the app no longer edits it.
- Tips/hr and totals are derived in the app, not stored.
- Leave `id` and `updated_at` alone.
- Delete by setting `deleted` to TRUE, or delete the row. Both propagate.
- A row with a typo is skipped and shown as an error in the app until fixed;
  it isn't lost or duplicated.

## Known limits

- Last-write-wins uses device clocks for app edits and Google's clock for Sheet
  edits. Normal clock drift (seconds) only matters if the same row is edited on
  both sides within seconds.
- Each sync sends only unsynced rows but receives the full set: fine to
  several thousand rows.
- Pasting over a range fires the edit stamp; edits made by other scripts or the
  Sheets API don't (they won't win conflicts unless they set `updated_at`).
- No component or store tests. Everything under `src/ui/`, `src/parts/`,
  `src/features/` and five of seven `src/data/` files is exercised by hand only; the
  suite covers `core/`, `lib/` and `persisted.ts`. See [ISSUES.md](ISSUES.md).

## Importing from brv2000

`node scripts/migrate-brv2000.mjs <brv2000 data dir>...` (`--skip YYYY-MM-DD` leaves a date out) reads `config.json` (the roster) and `shifts/*.json`, and writes `migration/brv2000.json` (git-ignored; it has names and employee IDs). In the app, **Settings > Import shifts (JSON)** loads it. It only adds what isn't here (matching people by name, shifts by a stable `b2k-<date>` id), so running it twice, or after you've edited an imported shift, changes nothing. Mapping and what goes into notes are documented at the top of `scripts/brv2000.mjs`.

`node scripts/migrate-brvflat.mjs <brv-flat data dir> --except migration/brv2000.json` does the same for brv-flat's CSVs (`migration/brv-flat.json`). A Double becomes two shifts (day up to the switchover, night from it) when both halves were logged. Everything is imported by default, including dates both projects have (they become two shifts on that date) and the income lines that had no shift (each becomes a shift with no times). `--except` and `--skip` leave dates out. Choose both files together in Settings > Import.

`node scripts/merge-bundles.mjs migration/all.json migration/brv2000.json migration/brv-flat.json` makes one file with everything, so a single pick in Settings > Import loads it all (the toast reports how many shifts came in).

## The scripts

| File | What it does |
| --- | --- |
| `sync-core.mjs` | derives `apps-script/core.gs` and `src/core/core.generated.*`. Runs before every script in `package.json`. |
| `brv2000.mjs` + `.d.mts` | converts a brv2000 export to a bundle (pure `convert`, tested) |
| `migrate-brv2000.mjs` | the CLI around it: reads dirs, writes `migration/brv2000.json` |
| `brvflat.mjs` + `.d.mts` | converts brv-flat's CSVs, including the `Double` shiftover split |
| `migrate-brvflat.mjs` | the CLI around it |
| `shiftsexport.mjs` + `.d.mts` | converts a `shifts-YYYY-MM-DD.json` export |
| `migrate-export.mjs` | the CLI around it |
| `merge-bundles.mjs` | merges bundle files into one, so a single import pick loads everything |

The `.mjs` files carry hand-written `.d.mts` declarations so the `.ts` tests can import
them; `tests/migrate.test.ts` is what keeps those declarations honest.
