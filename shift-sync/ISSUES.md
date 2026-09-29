# Known issues and drift hazards

An audit of the codebase as it stands, ranked by how likely it is to cost you time.
Every item cites where it lives. Nothing here is a blocker — the app builds, typechecks and
passes 153 tests — these are the places where the code, the docs and the stated rules have
drifted apart, or where a safe change today becomes a nasty one later.

## Tier 1 — fix before they bite

### 1. (fixed) `core/core.d.ts` was hand-maintained and 13 exports behind
Every export is declared now, and `scripts/sync-core.mjs` compares the declarations with `core.js`'s exports and exits
non-zero on any difference, so `dev`, `build`, `typecheck` and `test` all stop on drift. Generating the declarations from
JSDoc would make it one file instead of two; not needed while the check holds.

### 2. (fixed) Two `inRange` functions, one name, different behaviour
There is one date filter now, `trends.inDates`; the Dashboard's private copy (which also dropped pending shifts, which
`summarize` does anyway) is gone.

### 3. (fixed) `importBundle` asked for a sync only when it added shifts, people or wages
It now counts income and crew too. In practice this never bit: `planImport` only adds income and
crew under shifts it adds in the same import. The Settings toast now counts income lines as well.

## Tier 2 — real, but only bites when you touch the area

### 4. (fixed) `DESIGN.md` pointed at `features/shift/ShiftDetails.tsx`
It now names `src/parts/ShiftDetails.tsx`.

### 5. (fixed) `DESIGN.md` named `Delta` where Insights uses `DeltaPill`
The doc no longer names `charts.Delta`, which is still dead code (#6).

### 6. (fixed) Dead code
`ui/Cur.tsx`, `charts.Delta` (and its `.delta` CSS), `stats.weekEnd`, `SyncPill`'s unused `compact` form and the rail's
per-page icons, which nothing drew, are gone. Exported symbols still aren't checked by `noUnusedLocals`, so the class of
rot remains possible; a `knip`-style unused-export check in CI is the cheap net.

### 7. The "ui/ is props-driven" rule is not what the code does
`DESIGN.md:134` and the `layers.test.ts` header both say `ui/` parts "may navigate, never
read or write data". In practice:

| File | What it does instead |
| --- | --- |
| `ui/ScopeControl.tsx` | Takes **zero props**; reads and writes the shared `data/scope.ts` signals (`:1`, `:10`, `:17`, `:22`, `:39`, `:44`) |
| `ui/Table.tsx:44` | A module-level `persisted` signal for page size, shared by every `Table` on the page |
| `ui/toast.tsx` | A module-level signal plus an imperative `toast()` command |
| `ui/viewport.ts:5` | A module-level `matchMedia` signal |
| `ui/DrawerFrame.tsx:25-26` | Assigns the router's `drawerAsk.close` global on every render |

`Table`'s shared page size is deliberate — the comment at `:43` says so — so this is not a
bug. But the doc and the test both overstate the boundary, and that gap is what would let the
next `ui/` component quietly start reading the store.

### 8. (fixed) The layering test was two regexes over raw text
`tests/layers.test.ts` now finds every import in `src/` (either quote, `import`, `export ... from`, `import()`), resolves
it to the file it names, and checks it against each layer's list from the README, features-to-features included. A
planted `ui/` import of the store and a `parts/` import of a page, in double quotes, both fail it.

### 9. `tsconfig.json` does not cover `scripts/` or `core/`
`include` is `["src", "tests", "vite.config.ts"]`. The migration scripts are covered
indirectly — they carry hand-written `.d.mts` files and `tests/migrate.test.ts` imports them,
so a wrong declaration fails the build. `core/core.js` has **no** such safety net, which is
exactly why #1 has gone unnoticed.

## Tier 3 — know it, no action needed today

### 10. (fixed) `lib/dates.ts` is UTC except `today()`
The file's comment now says `today()` is the one local read, and `today()` builds the date from its parts instead of
relying on the `en-CA` locale format.

### 11. Magic runaway-loop guards
`lib/periods.ts:37` (`guard < 2000`) and `lib/trends.ts:46` (`guard < 1200`). They stop a
bad date range from hanging the tab. The numbers are unexplained; a comment saying what they
bound and why would help.

### 12. `DEFAULT_SCOPE` aliases a preset object
`lib/scope.ts:24` is `export const DEFAULT_SCOPE: Scope = PRESETS[1]!.scope` — a reference,
not a copy, and `persisted()` hands it straight to `signal()` when localStorage is empty. Safe
today because `setScope` always replaces the object wholesale. A `{ ...PRESETS[1]!.scope }`
would remove the question.

### 13. `shiftStatus` tests `other` for truthiness
`lib/groups.ts:22` uses `!v.shift.other`, so an `other` of `0` reads as "no money logged"
and the shift stays `worked`/pending. Almost certainly what you want, but `== null` would say
it on purpose instead of by accident.

### 14. `settings.ts` hand-rolls what `persisted.ts` provides
`data/settings.ts:12-15` does its own `try`/`catch` around `localStorage`, with a plain
object instead of a validator — because `Settings` is not a single value the way `Scope` is.
Fine as is; just be aware there are now two localStorage idioms in `data/`.

### 15. `data/scope.ts:10` has the repo's only `any`
`const valid = (s: any): s is Scope` — a type guard over untyped JSON, which needs it. Listed
so a future `noExplicitAny` lint knows the exception is deliberate.

### 16. `sync.ts` rewrites every store on every sync
`db.saveSynced` reads each store and writes the whole merged set back in one transaction. It no
longer clears the stores blind (it keeps another tab's unsynced rows), but it is still O(total rows)
of writes on each sync. Fine to a few thousand rows; worth knowing before the data grows.

### 17. `vite.config.ts:13` is a Vite 8 workaround
`injectRegister: 'script'`, with a comment that the `virtual:pwa-register` import does not
resolve under Vite 8 yet. Revisit on the next Vite bump.

### 18. CI pins a floating Node
`.github/workflows/ci.yml` uses `node-version: '22.x'`, which tracks the latest 22. Fine, and
the comment explains the `>=22.18` floor from `package.json` — but it means CI can change
under you. `22.18` exactly would make a type-stripping regression reproducible.

## Repo state (not code, but it will confuse a first pass)

- **Uncommitted work in 15 files** — a log redesign touching `LogScreen`, `ShiftCard`,
  `ShiftLog`, `PersonEditor`, five `lib/` files, `tokens.css` and three tests. Commit it or
  stash it.
- **`log-redesign`** is live WIP: 8 commits ahead, 29 behind `main`. Its diff deletes 8 test
  files (`weeks`, `time12`, `tokens`, `ruler`, `persisted`, `shiftForm`, `layers`, `groups`,
  `dashboard`) and touches `tsconfig.json`. It will need a rebase, and the test deletions are
  worth deciding on deliberately — several of them (`layers`, `tokens`, `weeks`) enforce
  architecture rather than behaviour.
- **`cursor/canvas-table-retool-3ba9`** is fully merged (0 ahead, 27 behind). Safe to delete.
- **`rail/single-sidebar`** is 1 commit ahead and *not* in `main` (`git cherry` reports `+`),
  yet `main` already has the grouped sidebar it introduces. It is a parallel implementation
  of a change that landed another way — superseded, safe to delete.
- **`shift-sync/dist/`** is build output on disk. Git-ignored, but delete it if you want the
  tree to look clean.

## Already handled well

Worth knowing so you do not "fix" it:

- **`src/core/` is generated and git-ignored**, and `sync:core` runs before every
  `dev`/`build`/`typecheck`/`test`, so fresh clones and CI work. That was a real bug once
  (commit `9820f68`).
- **One week everywhere.** `WEEK_START` is a single constant and `tests/weeks.test.ts`
  asserts the Log, Totals, the Dashboard and the calendar all agree for 21 consecutive days,
  naming the page and the date on failure.
- **The two dark palettes** in `tokens.css` are hand-written twice because CSS cannot share a
  block between a media query and a selector. `tests/tokens.test.ts` compares them
  declaration-by-declaration, with a sanity gate so it cannot pass vacuously.
- **`lib/` is genuinely pure.** Nothing in it imports `data/`, `preact` or the store, which
  is why 16 of 17 files are directly unit-tested with no mocking.
- **The fake Sheet in `tests/apps-script.test.js`** runs the real `apps-script/core.gs` and
  `Code.gs` in a `node:vm` sandbox, so the Sheet side is tested against a real deployable
  rather than a mock.
- **Deleting the old root app was safe.** Shift data is in the browser's IndexedDB
  (`shifts`/`rows`, unchanged since v1) and the connection is in `localStorage` under
  `conf`. Both carry over untouched; nothing was in the repo.
