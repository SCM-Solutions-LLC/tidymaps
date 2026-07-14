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
