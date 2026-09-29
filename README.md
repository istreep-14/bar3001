# bar3001

One repo, one app: **[`shift-sync/`](shift-sync/)** — a local-first shift log. The phone app
stores shifts in IndexedDB and works offline; a Google Sheet is the synced copy you can also
edit by hand. Conflicts resolve last-write-wins per row on `updated_at`.

Everything lives in `shift-sync/`. This file is only the map. Start there:

- **[`shift-sync/README.md`](shift-sync/README.md)** — what the app is, how the folders fit
  together, how data flows, how to run and deploy it, and the rules that hold it together.
- **[`shift-sync/DESIGN.md`](shift-sync/DESIGN.md)** — the UI contract: structure, tokens,
  components, and what every screen is allowed to look like.
- **[`shift-sync/ISSUES.md`](shift-sync/ISSUES.md)** — known problems and drift hazards,
  ranked, with where each one lives.

## First five minutes

```
cd shift-sync
npm install
npm run dev      # http://localhost:5173
```

Then, in order of what you'll want next:

```
npm test         # 122 tests: core sync rules, Apps Script against a fake Sheet, every lib/ helper
npm run typecheck
npm run build    # typecheck + production build into shift-sync/dist/
```

CI (`.github/workflows/ci.yml`) runs typecheck, test and build on every push to `main` and
every pull request, with `shift-sync/` as the working directory. There is no root
`package.json` — everything runs from inside `shift-sync/`.

## Repo shape

```
shift-sync/     the entire app (see its README for the folder-by-folder map)
.github/        CI workflow
```

The repo used to also hold a single-file vanilla-JS version of the app at the root
(`index.html`, `core.js`, `sw.js`, `Code.gs`). That version is gone. It was already
unusable — it referenced a `manifest.json` and `icon.svg` that did not exist — and its copy
of the sync rules had fallen 160 diff-lines behind `shift-sync/core/core.js`.

Removing it did not touch anyone's data: shift data lives in the browser's IndexedDB
(`shifts` database, store `rows`, both unchanged since v1), not in this repo. The
connection settings and the sync token are in `localStorage` under `conf`. Both carry over
to the current app untouched.
