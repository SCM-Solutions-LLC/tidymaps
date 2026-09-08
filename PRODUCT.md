# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Busy homeowners, renters, and parents overwhelmed by one cluttered space
(pantry, closet, garage shelf, drawer tower, vanity, workbench) who want a
realistic plan without hiring a professional organizer. They arrive mid-week,
often on a phone, with the mess in front of them. The job: get a plan they can
start tonight using shelves and bins they already own.

## Product Purpose

TidyMap turns photos of one space into a shelf-by-shelf organization plan:
where things go and why, short timed steps, and optional sized purchases. It
exists so that organizing a real space does not require tidying first, buying
first, or a professional. Success is a visitor finishing the ~10-minute wizard
and coming back with a plan they act on.

## Positioning

Practical organization for the space you already have, starting from what you
already own. Not an interior-design or "after image" generator. The AI reads
the actual photos and applies ordinary professional rules (daily things at eye
level, heavy things low, kids' things reachable, hazards high or latched).
Every plan starts at $0; product suggestions are off unless asked and clearly
marked. Language stays honest: "recommended layout", "detected visible items",
never "guaranteed to fit".

## Operating Context

- Free during early access. Built by SCM Solutions LLC, a small team.
- Entry is the marketing homepage leading with nine spaces across four rooms;
  tapping one opens the planner there.
- The wizard is an 11-step contract (`js/router.js FLOW`): landing, space,
  setup, measure, capture (photos), household, contents, goals, style, effort,
  shopping, review, loading, results, customize, save, feedback, done.
- Around it: a product library page grouped by space, a dashboard of saved
  spaces, a 3D viewer with a builder per layout archetype, a read-only
  shared-plan view, and five legal pages (privacy, terms, security, cookies,
  accessibility) sharing `css/legal.css`.
- Accounts are optional: no account needed to try it; saving uses an 8-digit
  emailed magic code, no passwords. Without an account photos are not stored
  after the plan is built.
- Plan generation calls a Supabase edge function holding the model key; on a
  backend failure the client shows a demo plan behind an honest banner.

## Capabilities and Constraints

- Static ES-module site, no build step, deployed to GitHub Pages from `main`.
  Any redesign must stay buildless.
- Supabase backend (Postgres + RLS, magic-code auth, private storage, Deno
  edge functions). Frontend changes must not alter the edge contracts.
- CI gates on every PR: ESLint 9, `tsc --checkJs`, `node --test`, Playwright
  e2e, and an axe WCAG 2 A/AA scan of the legal pages.
  `tests/legal-pages.test.mjs` fails if a legal page grows its own `<style>`
  block or drops a sibling from its nav.
- Terminology: "space" (not room) is the unit of work; "zone" is a shelf's
  assigned purpose; "plan" has three parts: where things go, step-by-step,
  optional purchases.
- Undecided: whether the 3D viewer and AI "after" photo preview stay prominent
  on the marketing surface (both shipped; neither has usage evidence).

## Brand Commitments

Name: TidyMap (also written TidyMap AI). Favicon at `assets/favicon.svg`, OG
image at `assets/og.png`. The incumbent look (cream ground, serif display,
orange accent) is **open to replacement** per the owner on 2026-09-07; it is
evidence, not a constraint. Voice is plain, concrete, and honest; no hype, no
guarantees.

## Evidence on Hand

- One real finished plan: the family pantry sample on the homepage
  (`js/demo-scenarios.js`) and its printed form
  (`tidymapwizardprint.pdf` outside the repo).
- Product photos in `assets/photos` and `assets/product`; step media in
  `media/steps`.
- **No testimonials, customer counts, press, or benchmarks exist.** Do not
  fabricate any. Early access, free, no public users to cite.

## Product Principles

1. Start from what the user owns; $0 is always a complete plan.
2. Say only what the photos support; honest language over confident language.
3. Safety is designed in, not added: hazards up, kids' things reachable.
4. Short, timed, pausable steps beat a grand reorganization.
5. Purchases are optional, opt-in, and clearly marked as such.

## Accessibility & Inclusion

WCAG 2 A/AA is the enforced floor (axe in CI on legal pages; extend to any new
surface). Mobile-first: the primary session is a phone held in front of the
mess. Respect reduced motion.
