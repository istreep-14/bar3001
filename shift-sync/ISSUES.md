# Known issues and drift hazards

An audit of the codebase as it stands, ranked by how likely it is to cost you time.
Every item cites where it lives. Nothing here is a blocker — the app builds, typechecks and
passes 155 tests — these are the places where the code, the docs and the stated rules have
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

### 7. (fixed) The "ui/ is props-driven" rule overstated the boundary
`ui/` may navigate, and it may read or write the shared period (`data/scope.ts`) and remembered view choices
(`data/persisted.ts`): the period control, a table's page size, toasts and the viewport. It still may not import the store
or the sync client. `DESIGN.md`, the README and `tests/layers.test.ts` now say that, so the next `ui/` component cannot
quietly start reading the store and still pass.

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

### 11. (fixed) Magic runaway-loop guards
`lib/periods.ts` (`guard < 2000`, about 38 years of weeks) and `lib/trends.ts` (`guard < 1200`, about 23 years) now say
what the cap bounds: a bad date range stops instead of hanging the tab.

### 12. (fixed) `DEFAULT_SCOPE` aliases a preset object
It is a copy of the 30-day preset now (`copyScope`), and `tests/scope.test.ts` fails if the two become the same object.

### 13. (fixed) `shiftStatus` tests `other` for truthiness
An `other` of `0` is no money on purpose (`== null || === 0`), the same as a blank, and a test says so. A non-zero amount
still counts the shift done.

### 14. (fixed) `settings.ts` hand-rolls what `persisted.ts` provides
Connection settings go through `persistedObject`, the same helper as every other remembered choice: defaults merged under
a saved object, a non-object ignored, writes best-effort.

### 15. (fixed) `data/scope.ts` had the repo's only `any`
The scope validator now narrows `unknown`. JSON still isn't trusted; it just isn't typed as `any` to get there.

### 16. `sync.ts` rewrites every store on every sync
`db.saveSynced` reads each store and writes the whole merged set back in one transaction. It no
longer clears the stores blind (it keeps another tab's unsynced rows), but it is still O(total rows)
of writes on each sync. Fine to a few thousand rows; worth knowing before the data grows.

### 17. `vite.config.ts:13` is a Vite 8 workaround
`injectRegister: 'script'`, with a comment that the `virtual:pwa-register` import does not
resolve under Vite 8 yet. Revisit on the next Vite bump.

### 18. (fixed) CI pins a floating Node
`.github/workflows/ci.yml` pins `node-version: '22.18'`, the floor `package.json` asks for, so a later 22.x cannot change
type stripping under CI.

### 19. (fixed) Font sizes are on the type scale
`tests/tokens.test.ts` rejects a `font-size` that is not `var(--fs-*)`, `inherit`, or a relative `em`. Chart labels, the
22/30 tiles and the day chip's month band are their own tokens (`--fs-axis`, `--fs-tile`, `--fs-stat`, `--fs-chip`) and
do not densify with a mouse. The Log's `--fs-fig` and `--fs-tips` stay fixed too.

## Repo state
The review's work is on `main` (merged from `review-fixes`). `shift-sync/dist/` is build output on disk, git-ignored. The
`log-redesign`, `cursor/canvas-table-retool-3ba9` and `rail/single-sidebar` branches predate it; the last two are
superseded and safe to delete.

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
