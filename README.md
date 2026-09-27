# shift-sync

Local-first shift log. The phone app stores shifts in IndexedDB and works offline;
a Google Sheet is the synced copy you can also edit by hand. Conflicts resolve
last-write-wins per row on `updated_at`.

```
app/            PWA: index.html, core.js, sw.js, manifest.json, icon.svg  -> host this folder
apps-script/    Code.gs  -> paste into the Sheet's Apps Script project
tests/          node tests (core logic + Code.gs against a fake Sheet)
```

`app/core.js` is the single source of the sync rules. It runs in the browser, in
Node tests, and in Apps Script. Copy it into Apps Script as `core.gs` whenever it changes.

## Setup

1. **Sheet.** New Google Sheet, then Extensions > Apps Script.
2. Create two script files: `Code.gs` (from `apps-script/Code.gs`) and `core.gs`
   (contents of `app/core.js`, unchanged).
3. Run `setup` once from the editor and approve permissions. It creates the
   `Shifts` tab and prints your token under View > Logs. It never deletes data.
4. **Deploy** > New deployment > Web app. Execute as: *Me*. Who has access: *Anyone*.
   Copy the `/exec` URL. (The token is what protects it.)
5. **Host `app/`** on any HTTPS host (e.g. GitHub Pages: push the repo, Settings > Pages,
   serve from `/app` or copy it to `/docs`). For local testing:
   `cd app && python3 -m http.server` then open `http://localhost:8000`.
6. Open the app, paste the URL and token, then add it to your home screen.

Existing Sheet? Re-paste `Code.gs`/`core.gs`, run `setup` again (it adds the `other`/`shift_type` headers and the `Income` tab), then deploy a new version.

After editing `Code.gs`/`core.gs`: Deploy > Manage deployments > edit > **New version**,
or the URL keeps serving old code.

## Editing in the Sheet

- Type dates as `YYYY-MM-DD` and times as `HH:MM` (24h). Past midnight is fine: `18:00`-`02:00` = 8h.
- New rows typed by hand get an `id` and `updated_at` automatically.
- **Income tab** = child rows of Shifts, zero to many per shift, linked by `shift_id` (copy the shift's `id`).
  `category` is one of Chump, Cash, Venmo, Consideration, Overtime (dropdown; typing `cash` also works).
  Delete by `deleted` = TRUE or deleting the row. Deleting a shift in the app also deletes its income.
- The old single `other` column on Shifts is kept and still counted, but the app no longer edits it.
- Tips/hr and totals are derived in the app, not stored.
- Leave `id` and `updated_at` alone.
- Delete by setting `deleted` to TRUE, or delete the row. Both propagate.
- A row with a typo is skipped and shown as an error in the app until fixed;
  it isn't lost or duplicated.

## Tests

`npm test` (Node 18+, no dependencies).

## Known limits

- Last-write-wins uses device clocks for app edits and Google's clock for Sheet
  edits. Normal clock drift (seconds) only matters if the same row is edited on
  both sides within seconds.
- Each sync sends only unsynced rows but receives the full set: fine to
  several thousand rows.
- Pasting over a range fires the edit stamp; edits made by other scripts or the
  Sheets API don't (they won't win conflicts unless they set `updated_at`).
