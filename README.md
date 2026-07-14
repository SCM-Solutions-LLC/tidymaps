# TidyMap

**TidyMap AI** — an AI home organization planner. Upload photos or a short video of a messy space (pantry, closet, garage shelf) and get a practical organization plan: what goes where, a move-by-move checklist with time estimates, and optional storage upgrades.

A prototype by SCM Solutions LLC.

**Live site:** https://scm-solutions-llc.github.io/tidymaps/

## Deployment

Deploys automatically to GitHub Pages from the `main` branch via GitHub Actions (`.github/workflows/pages.yml`).

## Local development

No build step — a static app using ES modules. Serve the folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Backend (Supabase)

Analysis runs server-side through Supabase Edge Functions so API keys never
reach the browser. Everything the backend needs lives in `supabase/`:

- `migrations/` — schema: profiles, spaces, media, rate-limit ledger, feedback (RLS on everything)
- `functions/analyze-space` — Claude vision analysis proxy (rate-limited, guest-friendly)
- `functions/render-after` — Gemini image-edit proxy that renders the user's space organized

Provisioning: create a Supabase project, apply the migrations in order, set the
`ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, and `IP_HASH_SALT` secrets, deploy both
functions with `verify_jwt` disabled (they check JWTs themselves so guests can call
them), then fill `js/config.js` with the project URL and publishable anon key.
With `js/config.js` empty the app runs fully in demo mode.
