---
name: TidyMap
description: A shelf-by-shelf organization plan marked up like a professional organizer would: real photographs on warm paper, Literata for reading, an organizer's pen notes, ink buttons with soft corners, and olive as the one accent ink.
colors:
  paper: "oklch(0.951 0.013 82)"
  stock: "oklch(0.983 0.006 85)"
  ink: "oklch(0.245 0.009 75)"
  ink-3: "oklch(0.48 0.02 76)"
  draw: "oklch(0.40 0.015 75)"
  spot: "oklch(0.245 0.009 75)"
  spot-deep: "oklch(0.16 0.008 75)"
  spot-ink: "oklch(0.39 0.052 124)"
  tint: "oklch(0.925 0.016 80)"
  tint-2: "oklch(0.925 0.03 118)"
  sel-bg: "oklch(0.955 0.018 110)"
  line: "oklch(0.858 0.023 81)"
  line-2: "oklch(0.79 0.026 78)"
  field-line: "oklch(0.60 0.025 75)"
  sage-f: "oklch(0.93 0.026 140)"
  sage-l: "oklch(0.79 0.05 140)"
  sage-d: "oklch(0.37 0.06 140)"
  butter-f: "oklch(0.945 0.04 90)"
  butter-l: "oklch(0.83 0.07 86)"
  butter-d: "oklch(0.40 0.07 70)"
  sky-f: "oklch(0.93 0.018 240)"
  sky-l: "oklch(0.79 0.04 240)"
  sky-d: "oklch(0.38 0.07 250)"
  pen: "oklch(0.372 0.081 266)"
  danger: "oklch(0.52 0.19 28)"
  danger-ink: "oklch(0.45 0.18 28)"
  danger-bg: "oklch(0.96 0.025 28)"
typography:
  display:
    fontFamily: "Literata, Georgia, Times New Roman, serif"
    fontSize: "clamp(40px, 5vw, 62px)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Literata, Georgia, Times New Roman, serif"
    fontSize: "clamp(26px, 3.4vw, 34px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Literata, Georgia, Times New Roman, serif"
    fontSize: "clamp(17px, 3vw, 19px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Literata, Georgia, Times New Roman, serif"
    fontSize: "clamp(16px, 2vw, 18px)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Literata, Georgia, Times New Roman, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  hand:
    fontFamily: "Architects Daughter, Segoe Print, Bradley Hand, cursive"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0.01em"
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.005em"
  button:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "6px"
  btn: "10px"
  lg: "10px"
  pill: "999px"
shadow:
  sm: "0 1px 2px oklch(0.35 0.03 50 / .07)"
  md: "0 1px 3px oklch(0.35 0.03 50 / .06), 0 8px 24px -10px oklch(0.35 0.03 50 / .16)"
  lg: "0 4px 10px oklch(0.35 0.03 50 / .08), 0 22px 44px -16px oklch(0.35 0.03 50 / .26)"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "40px"
  section: "clamp(64px, 10vh, 104px)"
components:
  button-primary:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.spot-deep}"
  button-ghost:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    borderColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.btn}"
    padding: "14px 22px"
  button-ghost-hover:
    backgroundColor: "{colors.tint}"
  button-sm:
    padding: "11px 16px"
  chip:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line-2}"
    rounded: "{rounded.pill}"
    padding: "9px 16px"
  chip-selected:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
  input:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    borderColor: "{colors.field-line}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
    shadow: "{shadow.sm}"
    padding: "clamp(18px, 4vw, 26px)"
  card-selected:
    backgroundColor: "{colors.sel-bg}"
    borderColor: "{colors.spot}"
  figure-number:
    backgroundColor: "{colors.tint-2}"
    textColor: "{colors.spot-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  flag:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  signup-panel:
    backgroundColor: "{colors.tint-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "clamp(22px, 3.5vw, 32px) clamp(20px, 3.5vw, 36px)"
  note-panel:
    backgroundColor: "{colors.butter-f}"
    borderColor: "{colors.butter-l}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Design System: TidyMap

## Overview

**Creative North Star: "The Marked-up Shelf"**

TidyMap looks like a professional organizer's plan for your own shelves: a real photograph of the space, laid on warm paper like a print, with short notes in the organizer's pen pointing at the shelves they describe. Reading text and headings are Literata, a book serif, at a calm weight; controls and labels are Archivo in sentence case; the pen (Architects Daughter) is used only for short margin notes. Buttons are the ink with gently rounded corners. Olive is the one accent, and it is an ink, never a fill.

It is for adults running a household, so it should read as a serious tool with a human hand in it, not as an app template and not as a children's scrapbook. The owner rejected the handmade mock that preceded this one as "a little too childlike" (tilted polaroids, emoji, highlighter, a chunky display serif): warmth comes from photographs, paper and the pen, never from decoration.

This replaced "The Warm Shelf" on 2026-11-24 (cream paper, terracotta buttons, pastel sage, butter and sky cards, Archivo for everything), which the owner found read as AI-generated: cream with a terracotta accent and rounded pastel cards is the widely recognised generated look. The Warm Shelf had itself replaced the "Home-Economics Manual" (2026-09-07: white, off-black, square corners, caps labels), which read as clinical. So this direction keeps the manual's restraint and the Warm Shelf's soft edges: no caps labels, no square buttons, and no pills on buttons either.

**Key Characteristics:**
- Warm paper with a faint fibre (`--paper-grain`), near-white sheets with a low warm shadow, hairline rules between rows. Sections are separated by space and hairlines, not boxes.
- Real photographs of real spaces carry the page. A photo is a print: a paper mat, a strip of tape, a low shadow.
- The pen: blue-black handwriting on small paper slips pinned to a photo, or as the margin note under a plan zone. Short notes only, never a sentence the reader must parse.
- Ink buttons (white label, 10px corners); ghost buttons are an ink outline on the sheet. Chips, tabs and tags take soft corners too (10px, 6px on a small tag); only the toast, progress tracks and round marks stay round.
- Olive (`spot-ink`) for links, a phrase in a heading, check marks and numerals. Never a field larger than the faint `tint-2` / `sel-bg`.
- Sage, butter and sky survive only as small marks that carry a word: a safety tag, a warning icon. Zones, callouts and notes are the plain sheet with a hairline.

## Colors

### Paper and ink
- **Paper** (`paper`): the page. Warm, a step darker than white, so sheets and prints read as laid on it.
- **Stock** (`stock`): sheets, inputs, photo mats, the running head.
- **Ink** (`ink`): text, headings and every primary button. A warm near-black.
- **Secondary ink** (`ink-3`): subtitles, captions, metadata, helper text. About 6:1 on paper.
- **Drawing line** (`draw`): the stroke of the cupboard drawings in the wizard and report.
- **Line** (`line`), **Line 2** (`line-2`), **Field line** (`field-line`): hairlines and dividers, firmer frames, and form-control edges (3:1 on the sheet).

### Accent
- **Ink as the button** (`spot`, `spot-deep`): primary buttons, selected chips and segments, the progress rail and bars, the focus ring, the caret and the selection.
- **Olive** (`spot-ink`): links, the italic phrase in the hero, check marks in the trust line, method numerals, the current chapter in the report contents.
- **Olive screened** (`tint-2`, `sel-bg`): the faintest fills, for a selected card and the eye-level zone.
- **Pen** (`pen`): handwritten notes only.

### Supporting fields
Each family is a field (`-f`), an edge (`-l`) and a deep text colour (`-d`), desaturated to sit on warm paper. Sage is success and safety, butter is warnings, sky is information. They colour a small tag or an icon beside a word, never a card, a callout or a zone, and never a button.

### The step clips' palette
The checklist clips are baked video (`remotion/`), coloured from `remotion/src/tokens.ts`, a test-held copy of these tokens: the band is `tint`, items are `stock`, structure is `draw`, the accent is olive (`spot-ink` over `tint-2`), and a label is a paper tag with a drawn edge. `.step-art` points the inline stand-in scenes at the same tokens. A change to any of them is a `--force` re-render.

### Named Rules
**The Ink-Button Rule.** A button, a selected thing or a progress mark is the ink. Olive is never a control fill.
**The Accent-Is-Ink Rule.** Olive appears as text, a check or a numeral. Its only fills are the faint `tint-2` and `sel-bg`.
**The Field-Has-Its-Own-Ink Rule.** Text on a sage, butter or sky field uses that family's deep ink.
**The Correction-Pencil Rule.** Red appears only on a failure.
**The Marked-State Rule.** Never encode state by hue alone. Pair every state with a mark, a strikethrough, an icon or a word.

## Typography

**Reading and headings:** Literata (self-hosted, opsz 12-72, wght 400-600; one static italic at 400)
**Controls and labels:** Archivo variable, sentence case
**The pen:** Architects Daughter, for short notes only

**Character:** A book page with an organizer's notes on it. Headings are Literata at a book weight (400), so hierarchy comes from size and space, not bold; h3 and h4 take 600 to hold up at reading size. Archivo sets buttons, inputs, nav, labels, captions and data, where a serif would read as prose. Nothing is set in caps.

### Scale
Every font-size is a token from `css/tokens.css`; `tests/type-scale.test.mjs` rejects any other. Eight set sizes: `--fs-2xs` 11px (the floor), `--fs-xs` 12, `--fs-sm` 13, `--fs-md` 14, `--fs-ui` 15, `--fs-body` 16, `--fs-lg` 18, `--fs-xl` 22. Six fluid ones for headings: `--fs-title`, `--fs-lede`, `--fs-chapter` `clamp(20px, 3vw, 24px)`, `--fs-section`, `--fs-page` `clamp(30px, 4.6vw, 44px)`, `--fs-display` `clamp(40px, 5vw, 62px)`.

### Hierarchy
- **Display** (Literata 400, `--fs-display`, 1.06, -0.022em): the landing hero's h1 only, 14ch max, with one italic phrase in olive.
- **Headline** (Literata 400, `--fs-section`, 1.12): h2 section heads.
- **Title** (Literata 600, `--fs-title`): h3. Landing space names and product-shot titles are Literata 400 at `--fs-xl`.
- **Lede and body** (Literata 400, 1.6 to 1.65).
- **Label, caption, button** (Archivo 500 to 600, `--fs-sm` to `--fs-ui`, sentence case).
- **Pen** (Architects Daughter 400, `--fs-ui`; `--fs-sm` on a phone).

### Named Rules
**The Three-Voice Rule.** Literata reads, Archivo operates, the pen annotates. A heading that needs more presence gets space or a photograph, never a fourth face or bold.
**The Sentence-Case Rule.** No `text-transform: uppercase` anywhere.
**The Short-Note Rule.** Pen notes are a few words. Anything a reader must understand to use the product is set in Literata or Archivo.

## Migration status

Stage 1 (2026-11-24) restyled the tokens, fonts and buttons sitewide and rebuilt the landing page. Stage 2 (2026-11-24) restyled the wizard: the art stages on space, setup and product cards are ink on the plain sheet (no per-card tint), chips and segmented controls take the button's 10px corner, and the wizard's sage and butter boxes are plain sheets with a `line` border. Stage 3 (2026-11-24) restyled the plan report: the elevation plate's shelves are the plain sheet with only the eye-level shelf in `tint-2`; tags, time chips, task buttons, wall and after tabs take soft corners; the safety note, feedback ask, step tip, callouts and reuse card are plain sheets; and the step clips were re-rendered in the new palette, which retired the `--clip-*` tokens. The Layout, Elevation, Shapes and Components sections below were written for the Warm Shelf and still say "terracotta" and "pill" in places: read terracotta as the ink, and the Overview and this section win where they disagree. Not yet made: the Dymo-label wordmark from the mock.

## Layout

Two measures: lessons read at 760px (`--maxw`; legal text at 680px); the landing page, report and dashboard spread to 1100px. Page gutter is 18px, rising to 24px at 560px. The running head is sticky and white with a soft line beneath, taking the small shadow once the page scrolls; the flow footer is fixed and white with a soft line above and a faint upward shadow. The progress rail under the running head is a 3px sand track with the accent advancing along it, its leading edge rounded.

The hero is a split spread from 960px: copy and Figure 1 in equal halves, 56px between; below that it stacks with the figure beneath the copy. Figure 1 sits in a white card with 24px corners and the medium shadow; its legend is four colour-matched cards in a two-column grid (one column below 520px), and its caption last.

Section rhythm on the landing page is `clamp(64px, 10vh, 104px)` above each h2. Inside a section: 30 to 34px to the first block, 12 to 16px between cards, 10 to 12px inside lists. Lists are stacks of rounded cards, not ruled rows.

Grids: space cards run two across on a phone, centred flex rows of up to three at 240px from 560px; the product-shot rows alternate figure and caption (5fr / 7fr) from 760px; the method list is three cards with a 48px numeral disc, 280px title and fluid text from 720px; the promise list is four coloured cards in two columns from 720px; the credibility spread is 5fr / 4fr from 880px; the report is a 190px sticky contents column plus fluid from 960px, and a horizontally scrolling bar beneath the running head below that; the wizard is question plus sticky rail from 900px.

Breakpoints in use: 420, 480, 520, 560, 640, 700, 720, 760, 780, 860, 880, 900, 960, 980px. The nav collapses to a hamburger at 859px; the wordmark yields to the brand mark below 430px.

## Elevation & Depth

Depth is paper, card and shadow. The page is cream; a card is white with a `line` border and the small shadow, so it lifts a hair off the paper. A hovered card rises 2 to 3px and takes the medium shadow; a selected card keeps its shadow and adds a terracotta border, a 1px inset terracotta ring and the faint `sel-bg` fill. The modal takes the large shadow over a 50% ink scrim. The toast is an ink pill with the medium shadow. No surface uses a gradient or a blur.

### Named Rules
**The One-Tier Rule.** Each surface takes one shadow tier: small at rest, medium when lifted or floating, large for the modal. Nothing stacks shadows.
**The Inset-Ring Rule.** A selected card marks itself with `inset 0 0 0 1px` terracotta inside its border, so the mark stays within the box and the layout does not shift.
**The Warm-Shadow Rule.** Every shadow is the warm ink at low alpha, never neutral grey.

## Shapes

Corners: 10px on controls (inputs, selects, the clip band, the icon tiles on feature cards), 16px on cards and panels, 24px on the large frames (Figure 1's card, the 3D stage, the modal, space cards, the review card, the signup card), pills on buttons, chips, tags, flags, segmented controls and the toast, and circles on the step dots, the task check, the stepper buttons, the range thumbs and the floating check on a selected card. Borders are 1px `line` on cards, 1.5px `line-2` on selectable cards and chips, 1.5px `field-line` on form controls, dashed `line-2` for provisional containers (the helper note, the "new space" card, the add-photo tile, a skipped task).

Figures are drawn with round line joins and caps: a 2.6px case outline with 18px corners, 1.8px shelves, 1.9px items, 2.2px accent for the label stroke; card-scale elevations (`.art-el`) drop to 0.9px for items, 1.3px for the case, 1.1px accent for the label. Zones are flat colour fields inside the case: sky, peach (eye level), butter, sage. The figure number is a peach pill; the brand mark is a 32px terracotta square with 11px corners carrying a white pin. Step marks are 18px circles with a `field-line` border: empty, half-filled with the accent, or filled with the accent, paired with a strikethrough when done. Task checks in the report are 44px circles of the same construction, filling with the accent when done.

## Components

### Buttons
A pill with a sentence-case label. The primary one is terracotta; the ghost is the same pill on white.
- **Shape:** pill, 1px border on both variants (terracotta on primary, `line-2` on ghost).
- **Primary:** terracotta fill, white label, a 1px warm shadow; 14px 22px padding; 16px 28px in the hero.
- **Hover / Focus:** hover deepens to `spot-deep`; active deepens further and drops 1px; focus-visible is a 2px terracotta outline offset 2px. Transitions 180ms on colour, 120ms on transform.
- **Ghost:** white fill, ink label; hover to sand, active to peach.
- **Small:** 11px 16px padding at 13px. Disabled is opacity 0.45.
- **Text buttons** (nav, back, home links): label style in ink, hover to `spot-ink`; nav items draw a 2px terracotta underline on hover; home links are Archivo 600 with a 1px terracotta underline, hover to ink.

### Chips
- **Style:** stock sheet, 1px `line-2` border, 10px corners, 9px 16px, Archivo 600 at 14px.
- **State:** hover to `tint`; selected takes the option cards' mark: ink border, 1px inset ink ring, `sel-bg`, and a drawn olive tick before the label (the chip widens by the tick). Segmented yes/no controls and the unit toggle are a 10px track with 3px padding and the selected segment as a 7px ink block inside it. The legal-page sibling nav is a chip row with the current page terracotta.
- **Tags** (small, non-interactive): sand pill, `line` border, 13px; semantic variants use sage, butter and sky, and the correction pencil only for danger.

### Cards / Containers
- **Corner Style:** 16px; 24px for space cards, the review card, the signup card, the 3D stage and the modal.
- **Background:** white; sand for the product filters and the step-art band; butter for notes and asks in the report and legal pages (plan-rate, legal note, fit note); sage for safety notes; the wizard's rail note, detected-items panel and pre-filled note are plain stock sheets with a `line` border; sky for information callouts; peach for the signup card.
- **Shadow Strategy:** small at rest, medium on hover (see Elevation). Selection is a terracotta border plus 1px inset ring plus `sel-bg`.
- **Border:** 1px `line`; 1.5px `line-2` on selectable cards.
- **Internal Padding:** `clamp(18px, 4vw, 26px)`; option rows 15px 16px; card labels 12px 16px 14px.
- **Space cards:** an art stage at 4/3 (3/2 on the landing gallery): the ink drawing on the stock sheet, ruled off from the label by a `line` hairline (setup cards inset theirs with a full `line` frame), name in Archivo 800 at 18px; hover lifts 3px with the terracotta ring and medium shadow and nudges the drawing 5% upward; selected shows a 28px terracotta check disc in the corner.

### Inputs / Fields
- **Style:** white, 1.5px `field-line` border, 10px corners, 12px 14px, Archivo at 15px; labels in Archivo 600 at 14px above. Placeholder text is `ink-3`. The signup input is a pill with its button beside it. Range sliders carry a 20px terracotta disc thumb with a white border and the small shadow on a 6px `line-2` track.
- **Focus:** 2px terracotta outline, no offset. Free-text areas take the inset terracotta ring instead.
- **Error:** correction-pencil border and outline with a 320ms shake (none under reduced motion).

### Navigation
- **Running head:** sticky white bar with a soft line beneath, small shadow once scrolled; brand as a 32px terracotta rounded square with a white pin plus the wordmark in Archivo 800 at 18px; nav items in label style with a terracotta underline drawn on hover; a step counter ("Step 1 of 11") in `spot-ink` on wizard screens; below 860px the nav folds into a white dropdown with 24px bottom corners and the medium shadow, 48px rows separated by soft lines.
- **Report contents:** a sticky 190px column with a soft-lined heading and soft-lined rows (Archivo 600 at 13px), current chapter in `spot-ink`; below 960px it becomes a scrolling bar under the running head with a terracotta underline on the current chapter.
- **Flow footer:** fixed, white, soft line above with a faint upward shadow, back link in label style at left, primary pill at right, 44px minimum targets.

### Figures (signature)
An inked cupboard elevation: a 2.6px case with 18px corners, 1.8px shelves, items drawn white-filled with 1.9px round-capped strokes and a 2.2px terracotta label stroke on each, zones as soft colour fields clipped to the rounded case (sky, peach for eye level, butter, sage), and a legend beneath as four colour-matched cards, each heading in that family's deep ink over 14px notes. Figure 1 on the landing page is the interactive version: items begin displaced and rotated and travel to their zone over 1.15s on the exponential ease-out, staggered 55ms per item; zones screen in after 1.1s. It plays once. There is no replay: the sort always ends on the same plan, so a button would only repeat it. Under reduced motion the finished figure is shown.

The same vocabulary scales down to the card elevations (`EL_ART`, `SETUP_ART`, `productArt`): a 96 by 72 viewBox, 0.9px items, 1.3px case, 1.1px accent label stroke, fills re-inked from the stylesheet to stock and paper, so the drawing's zones are the sheet itself. Each card carries one ambient storage motion (a drawer pulling, a door opening, a bin sliding, a shirt swaying, a jar lifting) looping at 4.1 to 5.4s, quickening on hover. The plan report's hero (`planElevationSvg`) draws one shelf per zone from the same glyphs in a rounded case on the plain sheet, only the eye-level shelf screened in `tint-2`, reading its colours from the tokens at render time. The report's "Where things go" rows still carry a peach label field on the eye-level row; the per-wall report replaces that with an icon and the word.

### Stage marks (signature)
Progress is a mark, never a colour alone: an 18px `field-line` circle that is empty (to do), half-filled with the accent (in progress), or filled with the accent (done), with done rows struck through and their text in `spot-ink`. Task checks in the report are 44px circles carrying the step number until done, when the number gives way to a white check on terracotta. Progress bars are a 10px pill track with the accent advancing.

### Motion
One stroke. `--ease` (0.2,0.7,0.2,1) for state changes, `--ease-out` (0.16,0.84,0.28,1) for arrivals, `--ease-physical` (0.34,1.32,0.48,1) for things that stand for objects. Durations 120ms (transform), 180ms (colour), 340ms (slow), 400ms for a screen rising 10px into place, 450ms for the rail, 540ms for a card arriving with a 55ms stagger. Every animation is disabled under `prefers-reduced-motion`.

On the landing, the hero headline types in once per load, its letters arriving 45ms apart on `--ease` (a head script hides it from the first paint and shows it after 2.5s regardless), and each section rises 10px over 540ms on `--ease-out` the first time it scrolls into view. The spaces index sets its room headings and arrows in olive, with a 64px thumbnail of each space's drawing (owner, 11-25: the bare list read as monotone).

## Do's and Don'ts

### Do:
- **Do** lead with a real photograph of a real space, presented as a print on the paper.
- **Do** separate sections with space and hairlines; keep sheets for things that are objects (a plan, a photo, a form).
- **Do** use the pen for short notes that point at something: a shelf, a zone, a next action.
- **Do** keep buttons the ink with 10px corners, and labels in sentence case.
- **Do** mark state with a mark, a strikethrough, an icon or a word, and pair any hue with one of those.
- **Do** keep focus rings 2px ink outlines and touch targets at 44px minimum.

### Don't:
- **Don't** bring back cream with a terracotta accent, pastel-filled cards, or a grid of identical rounded cards.
- **Don't** tilt more than one thing on a screen, or add emoji, highlighter marks or stickers: warmth comes from the photographs and the pen, not decoration.
- **Don't** set any text in caps, square off a button, or make a button a pill.
- **Don't** use the pen for a paragraph, a control label or anything a reader must parse.
- **Don't** add a gradient surface, a blur, or a fourth typeface.
- **Don't** put a kicker or eyebrow above a heading.
