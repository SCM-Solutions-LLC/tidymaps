# CLAUDE.md

Orientation for an agent session in this repo. Everything here is a pointer or
a rule that has cost someone real time. The substance lives in
**[`docs/HANDOFF.md`](docs/HANDOFF.md)** — read it before changing anything.

## Read first, in this order

1. `docs/HANDOFF.md` — what shipped, what is deployed, what is open, and the
   reasoning behind decisions that look arbitrary from the code. Its **Open
   items** section at the bottom is the live work list; its **Production
   health** section is what is actually true of the running system.
2. `git log --oneline -20` — the doc is refreshed per session, not per merge,
   so it can trail `main`. When the two disagree, git wins.

Notes about this project also exist in an Obsidian vault and in Notion. They
are **snapshots, not state**: at the last check every one of them predated this
repo's current architecture. Treat `docs/HANDOFF.md` as the only current memory
and re-derive anything the others claim.

## What this is

A static ES-module site — no build step — on GitHub Pages, with a Supabase
backend (project `jwubrtaacveavbkosgtf`): Postgres + RLS, magic-code auth,
private `space-media` storage, and Deno edge functions that hold the AI keys.
The wizard follows an 11-step contract in `js/router.js FLOW` (12 until
2026-09-03, when the room and area steps became one space picker).

## Gates

All four run in CI on every PR (`.github/workflows/test.yml`). Run `npm ci`
first — `check:types` reports hundreds of phantom errors against an empty
`node_modules`, and they read exactly like a regression from your own change.

```
npm ci
npm run lint          # ESLint 9 flat config
npm run check:types   # tsc --checkJs over a scoped jsconfig.json
npm test              # node --test
npx playwright test   # e2e
```

The Playwright browser is not installed in the web sandbox; use
`CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Rules that came from being wrong

- **Prove a new test fails without its fix.** Not by stashing the whole change:
  that only shows the test needs the file. Neuter the specific behaviour and
  confirm the test goes red. `docs/HANDOFF.md` lists real tests from this repo
  that passed against unfixed code.
- **Never make the validator stricter than its own prompt.** A rule in
  `checkInvariants` that `analyze-space` was not told costs the user an
  80-second analysis and returns a demo plan. Three production failures came
  from exactly this; the enforced-limits block exists to keep the two in step,
  and tests assert it is interpolated from the validator's constants rather
  than retyped.
- **Browser-test every user-facing change.** Sessions have repeatedly found
  bugs here that no unit test would catch: a slider showing each half under the
  opposite label, a share view claiming two adults, a feedback screen asking a
  question already answered.
- **"Nobody is using it" is a conclusion, not an observation.** Rule out "it is
  broken" and "the data is lying" first. An expired API key once read as low
  demand for two weeks, and the unit suite was writing to the production
  funnel.
- **An entry nothing references is usually a decision, not a backlog item.**
  Check `git log` before rebuilding it.

## Conventions

- Develop on the session's own `claude/*` branch, reset from `origin/main`
  after each merge — never stack on merged history. Open draft PRs.
- Adding a telemetry event means editing `_shared/telemetryEvents.js` **and**
  redeploying `track-events`; the server copy is the boundary and an unknown
  name is dropped silently.
- Migrations in `supabase/migrations/` are applied by hand. Edge functions and
  the site both deploy on merge to `main`.
- No em dash in user-facing copy — the prompt forbids it and the design uses a
  period, comma, or colon instead.
