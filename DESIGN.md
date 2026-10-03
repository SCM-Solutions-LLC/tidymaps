---
name: TidyMap
description: A shelf-by-shelf organization plan on warm cream paper: white cards with soft corners and low shadows, one terracotta accent for every button, and sage, butter and sky as supporting fields.
colors:
  paper: "oklch(0.977 0.014 82)"
  stock: "oklch(0.999 0.004 82)"
  ink: "oklch(0.27 0.02 40)"
  ink-3: "oklch(0.45 0.035 45)"
  draw: "oklch(0.46 0.03 42)"
  spot: "oklch(0.56 0.13 36)"
  spot-deep: "oklch(0.48 0.125 36)"
  spot-ink: "oklch(0.49 0.125 36)"
  tint: "oklch(0.952 0.02 80)"
  tint-2: "oklch(0.925 0.05 48)"
  sel-bg: "oklch(0.968 0.026 50)"
  line: "oklch(0.885 0.02 72)"
  line-2: "oklch(0.82 0.025 68)"
  field-line: "oklch(0.62 0.035 58)"
  sage-f: "oklch(0.94 0.038 150)"
  sage-l: "oklch(0.80 0.07 150)"
  sage-d: "oklch(0.37 0.075 150)"
  butter-f: "oklch(0.955 0.06 92)"
  butter-l: "oklch(0.84 0.10 88)"
  butter-d: "oklch(0.40 0.08 70)"
  sky-f: "oklch(0.94 0.028 235)"
  sky-l: "oklch(0.80 0.06 232)"
  sky-d: "oklch(0.38 0.08 245)"
  danger: "oklch(0.52 0.19 28)"
  danger-ink: "oklch(0.45 0.18 28)"
  danger-bg: "oklch(0.96 0.025 28)"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(32px, 4.2vw, 46px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.022em"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 34px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(17px, 3vw, 19px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
  lede:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(16px, 1.6vw, 18px)"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
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
  sm: "10px"
  md: "16px"
  lg: "24px"
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
    rounded: "{rounded.pill}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.spot-deep}"
  button-ghost:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    borderColor: "{colors.line-2}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
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

**Creative North Star: "The Warm Shelf"**

TidyMap looks like a well-kept pantry feels: warm, tidy, and easy to be in. The page is cream paper; everything that holds content sits on it as a white card with soft corners and a low, warm shadow. One terracotta carries every button, selected state and progress mark. Three quiet supporting colours, sage, butter and sky, colour the zones in a figure, the tips, the callouts and the space cards, so a page has variety without noise. Archivo sets everything, in sentence case: no letterspaced caps, no second face.

This replaced the "Home-Economics Manual" direction of 2026-09-07 (white stock, off-black ink, square corners, 1px ink rules, one accent, no shadows). The owner reviewed the shipped site on 2026-10-03 and found it clinical: "too structured and black/white, too many sharp corners and harsh lines." The mechanism that made the manual work, inked cupboard elevations with one terracotta label stroke per item, stays; the chrome around it softened.

Density is a comfortable reading page rather than a dashboard: a section rhythm of 64 to 104px, a 760px measure for lessons and 1100px for spreads. Separation is done by cards and space, not rules: a list of things is a stack of rounded cards with 10 to 14px between them, and a section head stands alone with air above it.

**Key Characteristics:**
- Cream paper, white cards, soft brown-black ink. Borders are a light warm line, so a card is outlined, never boxed in.
- Terracotta is the button, the selected state, the progress mark and the label stroke inside every drawing. It is never a field, except screened to peach for the eye-level zone and the signup card.
- Sage, butter and sky are fields with a deep ink of their own for text. They colour zones, tips, callouts and the space cards. They never carry a button.
- Archivo alone, in sentence case. Titles 700 at moderate sizes; labels 700 at 13px with almost no tracking; buttons 700 at 15px.
- Corners: 10px on controls, 16px on cards, 24px on the large frames (the figure, the 3D stage, the modal), pills on buttons and chips.
- Shadows are low and warm, one tier per surface: cards at rest take the small one, a lifted card or the toast the medium, the modal the large.
- Figures are inked cupboard elevations with a rounded case: items white-filled with round-capped strokes, one terracotta label stroke each, zones as soft colour fields.
- Motion is one stroke: exponential ease-out, 120 to 340ms for UI, one long 1.15s sort for Figure 1, played once.

## Colors

### Paper and ink
- **Paper** (`paper`): the page. Warm cream, a shade off white.
- **Stock** (`stock`): cards, inputs, buttons at rest, and the fill of every inked item in a figure. Near white, so a card reads as lifted off the cream.
- **Ink** (`ink`): text and headings. A soft warm brown-black, never pure black.
- **Secondary ink** (`ink-3`): subtitles, metadata, helper text, placeholders. Warm brown, about 7:1 on cream.
- **Drawing line** (`draw`): the stroke of every cupboard drawing, softer than type ink.
- **Line** (`line`) and **Line 2** (`line-2`): card borders and dividers (`line`), chips, ghost buttons and dashed frames (`line-2`). Both are light and warm.
- **Field line** (`field-line`): the edge of a form control (inputs, checkboxes, radios, the empty step dot). Clears 3:1 on white so a control is identifiable.

### Accent
- **Terracotta** (`spot`): primary buttons, the brand mark, selected chips and segments, the progress rail and bars, the "Kid safe" flag and chapter badges, the numerals in the method list, the label stroke on every inked item, the border and inset ring on a selected card, the range thumb, the caret, the selection highlight and the focus ring.
- **Terracotta, pressed** (`spot-deep`): hover on a primary button.
- **Terracotta, printed dark** (`spot-ink`): links, the step counter in the running head, dashboard counts, the eye-level heading in Figure 1's legend.
- **Peach** (`tint-2`): the accent screened to a field. The eye-level zone in every figure, the signup card, the first space card's stage, the active press on ghost buttons.
- **Selected** (`sel-bg`): the faintest peach, the fill of a selected card behind its terracotta border.
- **Sand** (`tint`): the ordinary content field: hover fill on ghost buttons, chips and options, the step-art band, the product filters panel, the clip band behind step animations.

### Supporting fields
Each family is a field (`-f`), an edge (`-l`) and a deep text colour (`-d`).
- **Sage**: success, safety notes, the "Reach-in" and second space cards, Figure 1's floor zone, the "How it works" second numeral.
- **Butter**: warnings and notes (the rail note, the plan-rate panel, legal callouts, fit notes), the third space cards, Figure 1's lower shelf.
- **Sky**: information callouts, the fourth space cards, Figure 1's top shelf, the "How it works" third numeral.

### Semantic
- **Success** is sage, **info** is sky, **warning** is butter with a deep amber ink.
- **Correction pencil** (`danger`, `danger-ink`, `danger-bg`): the one red, used for nothing but a failure (invalid email, unplaceable organizer), so it can never be mistaken for a call to action.

### Named Rules
**The One-Button Rule.** Terracotta is the only colour a button, a selected thing or a progress mark may take. Sage, butter and sky are fields and text, never controls.
**The Accent-Is-Small Rule.** Terracotta appears as a button, a stroke, a numeral, a pill or a dark word. The only fields it may tint are peach: eye level in a figure, the signup card, a selected card.
**The Field-Has-Its-Own-Ink Rule.** Text on a sage, butter or sky field uses that family's deep ink, never the accent or grey.
**The Correction-Pencil Rule.** Red appears only on a failure.
**The Marked-State Rule.** Never encode state by hue alone. Pair every state with a mark (filled, half-filled or empty dot), a strikethrough, an icon or a word.

## Typography

**Display Font:** Archivo variable (with -apple-system, Helvetica Neue, Arial)
**Body Font:** Archivo (same face; `--serif` aliases to it)
**Label Font:** Archivo at its normal width, sentence case

**Character:** One grotesque at rest. Titles are firm (700) but held to moderate sizes, so hierarchy comes from weight, cards and space rather than scale. Labels are small, bold and in sentence case. Nothing on the site is set in caps.

### Hierarchy
- **Display** (Archivo 700, `clamp(32px, 4.2vw, 46px)`, 1.08, -0.022em): h1 only. The landing hero at 22ch max; the legal h1 at `clamp(30px, 5vw, 42px)`. The report and plan-hero h2 step up to `clamp(30px, 4vw, 44px)` because they open a chapter.
- **Headline** (Archivo 700, `clamp(26px, 3.4vw, 34px)`, 1.12, -0.018em): h2 section heads. The room heading in the spaces gallery is the same voice at `clamp(22px, 2.4vw, 26px)`, centred.
- **Title** (Archivo 700, `clamp(17px, 3vw, 19px)`, 1.15, -0.012em): h3 card names, method-step titles, list items. Card names run 800 at 18 to 19px; product-shot titles 22px; h4 is 16px / 700.
- **Lede** (Archivo 400, `clamp(16px, 1.6vw, 18px)`, 1.6): the paragraph under the hero title, 44ch max. Section subtitles run 17px.
- **Body** (Archivo 400, 16px, 1.6): reading text. Small is 14px / 1.5; figure captions and table cells 14 to 15.5px; legal prose 16.5px / 1.7.
- **Label** (Archivo 700, 13px, 0.005em, sentence case): figure numbers, column heads, nav items, step counters, the contents heading, legend headings. Zone names inside a figure are Archivo 700 at 18px.
- **Button** (Archivo 700, 15px, 0.01em, sentence case): every button label; small buttons drop to 13.5px; the hero primary sits at 16px with 16px 28px padding.

### Named Rules
**The One-Family Rule.** Archivo sets everything. A heading that needs more presence gets a card, a numeral or more space, never a second face.
**The Sentence-Case Rule.** No `text-transform: uppercase` anywhere. A label is small and bold, not loud.
**The Firm-Moderate Rule.** Titles are weight 700 at moderate sizes (46px ceiling on the h1). Scale is not the lever; weight and space are.
**The Figure-Number Rule.** A figure is captioned "Fig. n" in a small peach pill; the number sits inside the caption or the h3, never above a heading.

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
- **Small:** 11px 16px padding at 13.5px. Disabled is opacity 0.45.
- **Text buttons** (nav, back, home links): label style in ink, hover to `spot-ink`; nav items draw a 2px terracotta underline on hover; home links are Archivo 600 with a 1px terracotta underline, hover to ink.

### Chips
- **Style:** white pill, 1.5px `line-2` border, 9px 16px, Archivo 600 at 14px.
- **State:** hover to sand; selected fills terracotta with white text. Segmented yes/no controls and the unit toggle are a pill track with 3px padding and the selected segment as a terracotta pill inside it. The legal-page sibling nav is a chip row with the current page terracotta.
- **Tags** (small, non-interactive): sand pill, `line` border, 13.5px; semantic variants use sage, butter and sky, and the correction pencil only for danger.

### Cards / Containers
- **Corner Style:** 16px; 24px for space cards, the review card, the signup card, the 3D stage and the modal.
- **Background:** white; sand for the product filters and the step-art band; butter for notes and asks (rail note, plan-rate, legal note, fit note); sage for safety notes and detected-items panels; sky for information callouts; peach for the signup card.
- **Shadow Strategy:** small at rest, medium on hover (see Elevation). Selection is a terracotta border plus 1px inset ring plus `sel-bg`.
- **Border:** 1px `line`; 1.5px `line-2` on selectable cards.
- **Internal Padding:** `clamp(18px, 4vw, 26px)`; option rows 15px 16px; card labels 12px 16px 14px.
- **Space cards:** a coloured art stage at 4/3 (3/2 on the landing gallery) that cycles peach, sage, butter and sky by position, name in Archivo 800 at 18px; hover lifts 3px with the terracotta ring and medium shadow and nudges the drawing 5% upward; selected shows a 28px terracotta check disc in the corner.

### Inputs / Fields
- **Style:** white, 1.5px `field-line` border, 10px corners, 12px 14px, Archivo at 15px; labels in Archivo 600 at 14px above. Placeholder text is `ink-3`. The signup input is a pill with its button beside it. Range sliders carry a 20px terracotta disc thumb with a white border and the small shadow on a 6px `line-2` track.
- **Focus:** 2px terracotta outline, no offset. Free-text areas take the inset terracotta ring instead.
- **Error:** correction-pencil border and outline with a 320ms shake (none under reduced motion).

### Navigation
- **Running head:** sticky white bar with a soft line beneath, small shadow once scrolled; brand as a 32px terracotta rounded square with a white pin plus the wordmark in Archivo 800 at 19px; nav items in label style with a terracotta underline drawn on hover; a step counter ("Step 1 of 11") in `spot-ink` on wizard screens; below 860px the nav folds into a white dropdown with 24px bottom corners and the medium shadow, 48px rows separated by soft lines.
- **Report contents:** a sticky 190px column with a soft-lined heading and soft-lined rows (Archivo 600 at 13.5px), current chapter in `spot-ink`; below 960px it becomes a scrolling bar under the running head with a terracotta underline on the current chapter.
- **Flow footer:** fixed, white, soft line above with a faint upward shadow, back link in label style at left, primary pill at right, 44px minimum targets.

### Figures (signature)
An inked cupboard elevation: a 2.6px case with 18px corners, 1.8px shelves, items drawn white-filled with 1.9px round-capped strokes and a 2.2px terracotta label stroke on each, zones as soft colour fields clipped to the rounded case (sky, peach for eye level, butter, sage), and a legend beneath as four colour-matched cards, each heading in that family's deep ink over 14px notes. Figure 1 on the landing page is the interactive version: items begin displaced and rotated and travel to their zone over 1.15s on the exponential ease-out, staggered 55ms per item; zones screen in after 1.1s. It plays once. There is no replay: the sort always ends on the same plan, so a button would only repeat it. Under reduced motion the finished figure is shown.

The same vocabulary scales down to the card elevations (`EL_ART`, `SETUP_ART`, `productArt`): a 96 by 72 viewBox, 0.9px items, 1.3px case, 1.1px accent label stroke, fills re-inked from the stylesheet to stock and the card's own tint and peach, so the four card tones colour the drawing's zones along with its stage. Each card carries one ambient storage motion (a drawer pulling, a door opening, a bin sliding, a shirt swaying, a jar lifting) looping at 4.1 to 5.4s, quickening on hover. The plan report's hero (`planElevationSvg`) draws one shelf per zone from the same glyphs in a rounded case, the eye-level shelf in peach and the others cycling sky, butter, sage and sand, reading its colours from the tokens at render time. The report's "Where things go" rows still carry a peach label field on the eye-level row; the per-wall report replaces that with an icon and the word.

### Stage marks (signature)
Progress is a mark, never a colour alone: an 18px `field-line` circle that is empty (to do), half-filled with the accent (in progress), or filled with the accent (done), with done rows struck through and their text in `spot-ink`. Task checks in the report are 44px circles carrying the step number until done, when the number gives way to a white check on terracotta. Progress bars are a 10px pill track with the accent advancing.

### Motion
One stroke. `--ease` (0.2,0.7,0.2,1) for state changes, `--ease-out` (0.16,0.84,0.28,1) for arrivals, `--ease-physical` (0.34,1.32,0.48,1) for things that stand for objects. Durations 120ms (transform), 180ms (colour), 340ms (slow), 400ms for a screen rising 10px into place, 450ms for the rail, 540ms for a card arriving with a 55ms stagger. Every animation is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** put content on a white card with soft corners and the small shadow, on cream paper; separate with space and cards, not rules.
- **Do** keep terracotta for buttons, selected states, progress marks and the label stroke in drawings; use sage, butter and sky as fields with their own deep ink for text.
- **Do** set every label in sentence case: Archivo 700 at 13px, almost no tracking.
- **Do** caption every drawing "Fig. n" in the peach pill and draw it in the elevation voice: white-filled items, round-capped strokes, one terracotta label stroke per item, soft colour zones with eye level in peach.
- **Do** mark state with a dot (empty, half, full), a strikethrough, an icon or a word, and pair any hue with one of those.
- **Do** keep focus rings 2px terracotta outlines and touch targets at 44px minimum.

### Don't:
- **Don't** set any text in caps, or add tracking to a label.
- **Don't** draw a hard ink border or a 1px ink rule; borders are `line`, `line-2` or `field-line`.
- **Don't** colour a button, a selected state or a progress mark with anything but terracotta.
- **Don't** fill a panel with terracotta; peach is the only accent field, and only for eye level, the signup card and a selected card.
- **Don't** use red, terracotta or any hue as the sole carrier of a state.
- **Don't** add a gradient surface, a blur or a second typeface, and keep the h1 at or under 46px.
- **Don't** put a kicker or eyebrow above a heading.
