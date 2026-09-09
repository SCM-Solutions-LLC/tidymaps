---
name: TidyMap
description: A shelf-by-shelf organization plan, set like a home-economics manual: off-black ink on white stock, warm-grey fields, one terracotta accent.
colors:
  stock: "#ffffff"
  ink: "oklch(0.24 0.006 50)"
  spot: "oklch(0.56 0.125 40)"
  spot-deep: "oklch(0.48 0.12 40)"
  spot-ink: "oklch(0.49 0.12 40)"
  tint: "oklch(0.955 0.004 60)"
  tint-2: "oklch(0.935 0.028 45)"
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
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.09em"
    fontVariation: "wdth 80"
  button:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
    fontVariation: "wdth 90"
rounded:
  none: "0"
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
    rounded: "{rounded.none}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.spot-deep}"
  button-primary-active:
    backgroundColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 22px"
  button-ghost-hover:
    backgroundColor: "{colors.tint}"
  button-ghost-active:
    backgroundColor: "{colors.tint-2}"
  button-sm:
    padding: "11px 14px"
  chip:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "9px 16px"
  chip-hover:
    backgroundColor: "{colors.tint}"
  chip-selected:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
  input:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 14px"
  card:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "clamp(18px, 4vw, 26px)"
  option-selected:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
  figure-number:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.label}"
    padding: "3px 7px 2px"
  flag:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
    padding: "2px 7px"
  signup-panel:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    padding: "clamp(22px, 3.5vw, 32px) clamp(20px, 3.5vw, 36px)"
  note-panel:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    padding: "12px 14px"
---

# Design System: TidyMap

## Overview

**Creative North Star: "The Home-Economics Manual"**

TidyMap is printed the way a mid-century home-economics textbook was: white stock, one warm off-black ink for text, rules, and figure strokes, a warm-grey field for anything that holds content, and one terracotta accent that does the pointing. A plan is a lesson. The landing page opens as a split spread: the chapter title and its lede on the left, Figure 1 on the right, an inked pantry elevation whose jumbled items slide into labeled zones with a legend beneath. The three parts of a plan follow as zig-zag product rows drawn in the app's own language; the method is a numbered list; the reply card at the foot is the signup. Wizard steps are lessons with a step counter in the running head; the results screen is the Plan chapter with a contents column, figure tables, and printed stage marks; the products page is the appendix; legal pages are back-matter.

Density is that of a printed page rather than a dashboard: a section rhythm of 64 to 104px between chapters, a 760px reading measure for lessons and 1100px for spreads, 1px ink rules doing the work that borders, shadows, and cards would do elsewhere. The accent is spent carefully: buttons, selected states, the progress rail, the step counter, the label stroke on every drawn item, the numerals in the method list. Depth is refused: no shadows, no gradient surfaces, no rounded corners.

Confirmed visual rejections: neutral grey type (secondary text is the accent printed dark); hue as the only carrier of state; the photo-left, headline-right, three-feature-card arrangement; kickers above headings; drop shadows and lifted cards; a second typeface.

**Key Characteristics:**
- One ink, two papers, one accent: off-black is text, rule, and figure stroke; stock and warm grey are the only fields; terracotta is the button, the selected state, and the mark inside a figure.
- Archivo alone, on its width axis: titles at 700 in moderate sizes, labels narrowed to 80% in letterspaced caps, buttons at 90%, reading text at normal width.
- Figures are inked cupboard elevations: ink strokes, white-filled items, flat grey zones, the eye-level zone in the accent tint, and one terracotta label stroke per item.
- Rules, not boxes: 1px and 2px ink rules separate, frame, and underline; corners are square.
- State is a printed mark (empty square, half-filled square, filled square) or a word, never a colour alone.
- Motion is one stroke: exponential ease-out, 120 to 340ms for UI, one long 1.15s sort for Figure 1.

## Colors

A one-ink job on two papers with a terracotta accent: warm off-black on white stock, warm grey for content fields, terracotta for every button and mark, and a correction-pencil red reserved for failure.

### Primary
- **Terracotta** (`spot`): the accent, held under 80% saturation so white type on it clears 4.6:1. Primary buttons, the brand square, selected chips, segments, unit toggles and the current legal-nav item, the progress rail and progress bars, the "Kid safe" flag and chapter badges, the numerals in the method list, the label stroke on every inked item (`.f-lbl`, `.art-el .lbl`), the border and inset ring on a selected card, the range-slider thumb, the caret, the selection highlight, and the global focus ring. `--brass`, `--primary`, `--sage`, `--success`, `--info`, and `--focus` all alias to it.
- **Terracotta, Pressed** (`spot-deep`): the accent deepened for a primary button's hover. Not used anywhere else.
- **Terracotta, Printed Dark** (`spot-ink`): the accent dark enough for small text on white (clears 5:1). The only secondary-text colour: step counters, dashboard metadata, muted notes, placeholder text, link hover, the "Eye level" note heading in figures, the current chapter in the contents column, done-task text, the latch stroke in Figure 1.

### Neutral
- **Off-Black Ink** (`ink`): text, headings, every rule and border, figure strokes, the figure-number tab, the dashboard type badge, the modal frame, the pressed state of a primary button. `--line`, `--line-2`, `--ink-2`, and `--warn` resolve here.
- **White Stock** (`stock`): page, cards, buttons at rest, inputs, and the fill of every inked item in a figure.
- **Warm Grey** (`tint`): every field that carries content. Hover fill on ghost buttons, chips, cards and options; selected options; the ordinary zones in a figure; the card-art stage; the step-art band; the signup, rail note, helper, safety note, product filters, plan-rate and legal callout panels; the rail track behind the progress bar.
- **Accent Tint** (`tint-2`): the accent screened to a field. The eye-level zone in every figure (the one place a field is not grey), the highlighted zone in the "What you get" figure, the active press on ghost buttons and segments, the deeper of the two fills in card elevations.

### Semantic
- **Correction Pencil** (`danger`, `danger-ink`, `danger-bg`): the one exception, used for nothing but a failure (invalid email, unplaceable organizer). Success and info are the accent; warning is ink on warm grey.

### Named Rules
**The One-Accent Rule.** Terracotta is the only colour that is not ink, stock, or grey. A button, a selected thing, a progress mark, and a figure label all share it; a new colour is a new plate and does not get one.
**The Accent-Is-Small Rule.** Terracotta appears as a button, a stroke, a numeral, a small tab, or a dark word. The only field it may tint is the eye-level zone in a figure, at `tint-2`.
**The No-Grey-Type Rule.** Secondary text is `spot-ink`, borders are `ink`, disabled state is opacity 0.45 on the full-colour element. The one grey in the system is a field (`tint`), never a letterform or a rule.
**The Correction-Pencil Rule.** Red appears only on a failure, never on a call to action, badge, or highlight, so it can never be mistaken for one.
**The Marked-State Rule.** Never encode state by hue alone. Pair every state with a printed mark (empty, half, filled square), a strikethrough, or a word.

## Typography

**Display Font:** Archivo variable, width axis 62 to 125% (with -apple-system, Helvetica Neue, Arial)
**Body Font:** Archivo (same face; `--serif` aliases to it)
**Label/Mono Font:** Archivo narrowed to 80% width for labels and 90% for buttons; system monospace is declared but unused in shipped surfaces

**Character:** One grotesque, played across its width axis. Titles are firm (700) but held to moderate sizes, so hierarchy comes from weight, rules, and space rather than scale; labels are narrowed and letterspaced like a shelf label; reading text is Archivo at rest.

### Hierarchy
- **Display** (Archivo 700, `clamp(32px, 4.2vw, 46px)`, 1.08, -0.022em): h1 only. The landing hero at 20ch max; the legal h1 at `clamp(30px, 5vw, 42px)`. The report and plan-hero h2 step up to `clamp(30px, 4vw, 44px)` because they open a chapter.
- **Headline** (Archivo 700, `clamp(26px, 3.4vw, 34px)`, 1.12, -0.018em): h2 section heads, sitting on a 1px rule with 18px above. The room heading in the spaces gallery is the same voice at `clamp(22px, 2.4vw, 26px)`, centred on a rule.
- **Title** (Archivo 700, `clamp(17px, 3vw, 19px)`, 1.15, -0.012em): h3 card names, method-step titles, list items. Card names and dashboard names run 800 at 18 to 19px; product-shot titles 22px; h4 is 16px / 700.
- **Lede** (Archivo 400, `clamp(16px, 1.6vw, 18px)`, 1.6): the paragraph under the hero title, 44ch max. Section subtitles run 17px; the legal lede 19px / 1.55.
- **Body** (Archivo 400, 16px, 1.6): reading text. Small is 14px / 1.5; figure captions and table cells 14 to 15.5px; legal prose 16.5px / 1.7.
- **Label** (Archivo 700 to 800, 12px, 0.09em, uppercase, width 80%): figure numbers, column heads, nav items, step counters, the contents heading, legend headings, the "Sort it again" control. Zone names inside a figure are Archivo 800 at 16px with 0.08em.
- **Button** (Archivo 800, 14px, 0.06em, uppercase, width 90%): every button label; small buttons drop to 12.5px; the hero primary sits at 15px 24px padding.

### Named Rules
**The One-Family Rule.** Archivo sets everything. There is no display serif; a heading that needs more presence gets a rule, a figure number, or more space, never a second face.
**The Firm-Moderate Rule.** Titles are weight 700 at moderate sizes (46px ceiling on the h1). Scale is not the lever; weight and rules are.
**The Narrow-Label Rule.** A caps label is Archivo at 80% width with 0.09em tracking; buttons are the same voice at 90%. Regular-width Archivo is for reading and for card names, never for a label.
**The Figure-Number Rule.** A figure is captioned "Fig. n" in a white-on-ink label tab; the number sits inside the caption or the h3, never above a heading.

## Layout

Two measures: lessons read at 760px (`--maxw`; legal text at 680px); the landing page, report, and dashboard spread to 1100px. Page gutter is 18px, rising to 24px at 560px. The running head (sticky, 1px rule beneath, thickening to 2px on scroll) and the flow footer (fixed, 2px rule above) are the page furniture; the progress rail under the running head is a 3px warm-grey track with the accent advancing along it.

The hero is a split spread from 960px: copy and Figure 1 in equal halves, 56px between, so the headline holds two lines at its own size; below that it stacks with the figure beneath the copy. Figure 1 carries its legend as a two-column ruled list (one column below 520px) and its caption last.

Section rhythm on the landing page is `clamp(64px, 10vh, 104px)` above each h2. Inside a section: 30 to 34px to the first block, 12 to 16px between cards, 10 to 12px inside lists. Rules do the separating: lists and tables are stacks of rows with a 1px rule beneath each and a 1px or 2px rule on top of the whole.

Grids: space cards run two across on a phone, centred flex rows of up to three at 240px from 560px; the product-shot rows alternate figure and caption (5fr / 7fr, caption on the right for odd rows, left for even) from 760px; the method list is 52px numeral, 280px title, fluid text from 720px; the promise list is two columns from 720px; the credibility spread is 5fr / 4fr from 880px; the report is a 190px sticky contents column plus fluid from 960px, and a horizontally scrolling caps bar beneath the running head below that; the wizard is question plus sticky rail from 900px.

Breakpoints in use: 420, 480, 520, 560, 640, 700, 720, 760, 780, 860, 880, 900, 960, 980px. The nav collapses to a hamburger at 859px (measured: the row needs 777px); the wordmark yields to the brand square below 430px.

## Elevation & Depth

Print casts no shadow. Every shadow token is `none`, corners are 0, and there are no gradient surfaces. Depth is conveyed by ink weight and paper: a 1px rule for a card or row, a 2px rule for a panel that matters (modal, signup, plan-rate, chapter head), a 1px rule with 18px of air above a section title. The order of surfaces is stock, then warm grey, then accent tint: a hovered card goes to grey, a pressed one to accent tint, and a selected one gets an accent border plus a 1px inset accent ring.

The modal backdrop is a 60% dark scrim over the page, not a blur. The only lifts are 1px down on button press and 2 to 3px up on card hover, both transforms without shadow.

### Named Rules
**The Rule-Not-Shadow Rule.** To separate or frame, add a rule (1px ink or 2px ink). Never a shadow, never a gradient, never a radius.
**The Inset-Ring Rule.** A selected or hovered card marks itself with `inset 0 0 0 1px` (accent on selectables, ink on dashboard cards) inside its border, so the mark stays within the box and the layout does not shift.

## Shapes

Every corner is square (radius 0, including focus rings and the range thumb). Borders are 1px solid ink at rest; 2px for load-bearing frames; dashed 1px ink for provisional containers (the helper note, the "new space" card, a skipped task). Figures are drawn with round line joins and caps: 4px for the case outline, 2.5px for shelves, 2.4px for items, 2.6px accent for the label stroke on each item; card-scale elevations (`.art-el`) drop to 1px for items, 1.6px for the case, and 1.2px accent for the label. Zones are flat rectangles inside the case: warm grey, or accent tint for eye level. The figure number is an ink tab; the brand mark is a 30px accent square carrying a white pin. Stage marks are 16px squares with a 2px ink border: empty, half-filled with a hard-edged fill, or fully filled. Task checks in the report are 44px squares of the same construction, filling with the accent when done.

## Components

### Buttons
A button is a ruled box with a caps label: the primary one is printed in the accent, the ghost is the same box left unprinted.
- **Shape:** square corners (0), 1px border on both variants (accent on primary, ink on ghost).
- **Primary:** accent fill, white label; 14px 22px padding; 15px 24px in the hero.
- **Hover / Focus:** hover deepens to `spot-deep`; active goes to ink and drops 1px; focus-visible is a 2px accent outline offset 2px. Transitions 180ms on colour, 120ms on transform.
- **Ghost:** white fill, ink label; hover to warm grey, active to accent tint.
- **Small:** 11px 14px padding at 12.5px. Disabled is opacity 0.45.
- **Text buttons** (nav, back, replay, home links): label style in ink, hover to `spot-ink`; nav items draw a 2px accent underline on hover; home links are Archivo 600 with a 1px accent underline, hover to ink.

### Chips
- **Style:** white, 1px ink border, 9px 16px, Archivo 600 at 14px.
- **State:** hover to warm grey; selected fills with the accent and white text. Segmented yes/no controls and the unit toggle are the same construction sharing one border with the selected segment accent-filled. The legal-page sibling nav is a chip row with the current page accent-filled.
- **Tags** (small, non-interactive): warm-grey fill, ink border, 12.5px; semantic variants use the correction pencil only for danger.

### Cards / Containers
- **Corner Style:** square.
- **Background:** white; warm grey for panels that are notes, callouts, or asks (signup, rail note, helper, safety note, legal note, product filters, plan-rate).
- **Shadow Strategy:** none (see Elevation). Selection is an accent border plus 1px inset accent ring; dashboard cards take an ink ring on hover.
- **Border:** 1px ink; 2px ink for the modal, signup, and plan-rate panels.
- **Internal Padding:** `clamp(18px, 4vw, 26px)`; option rows 15px 16px; card labels 12px 16px 14px.
- **Space cards:** warm-grey art stage at 4/3 (3/2 on the landing gallery), 1px rule beneath, name in Archivo 800 at 18px; hover lifts 3px with the accent ring and nudges the drawing 5% upward; selected shows a 28px accent check square in the corner.

### Inputs / Fields
- **Style:** white, 1px ink border, 12px 14px, Archivo at 15px; labels in Archivo 600 at 14px above. Placeholder text is `spot-ink`. The signup input shares its right edge with the button. Range sliders carry an 18px square accent thumb with a 2px ink border.
- **Focus:** 2px accent outline, no offset (the ring sits on the border). Free-text areas take the inset accent ring instead.
- **Error:** correction-pencil border and outline with a 320ms shake (none under reduced motion).

### Navigation
- **Running head:** sticky white bar with a 1px rule beneath; brand as a 30px accent square with a white pin plus the wordmark in Archivo 800 at 19px; nav items in label style with an accent underline drawn on hover; a step counter ("Step 1 of 11") in `spot-ink` on wizard screens; below 860px the nav folds into a full-width stacked list of 48px rows separated by rules.
- **Report contents:** a sticky 190px column with a 2px-ruled heading and 1px-ruled rows (Archivo 600 at 13.5px), current chapter in `spot-ink`; below 960px it becomes a scrolling caps bar under the running head with an accent underline on the current chapter.
- **Flow footer:** fixed, white, 2px rule above, back link in label style at left, primary button at right, 44px minimum targets.

### Figures (signature)
An inked cupboard elevation: a 4px ink case, 2.5px shelves, items drawn white-filled with 2.4px round-capped ink strokes and a 2.6px accent label stroke on each, zones as flat warm-grey rectangles with the eye-level shelf in accent tint, and a legend beneath in label-style headings (the eye-level heading in `spot-ink`) over 14px notes. Figure 1 on the landing page is the interactive version: items begin displaced and rotated and travel to their zone over 1.15s on the exponential ease-out, staggered 55ms per item; zones screen in after 1.1s; a "Sort it again" control appears after 2.6s. Under reduced motion the finished figure is shown and the replay hidden.

The same vocabulary scales down to the card elevations (`EL_ART`, `SETUP_ART`, `productArt`): a 96 by 72 viewBox, 1px ink items, 1.6px case, 1.2px accent label stroke, fills re-inked from the stylesheet to stock, warm grey, and accent tint. Each card carries one ambient storage motion (a drawer pulling, a door opening, a bin sliding, a shirt swaying, a jar lifting) looping at 4.1 to 5.4s, quickening on hover. The plan report's hero (`planElevationSvg`) draws one shelf per zone from the same glyphs, reading `--ink`, `--spot`, `--tint`, and `--tint-2` from the tokens at render time.

### Stage marks (signature)
Progress is printed, never coloured alone: a 16px ink-bordered square that is empty (to do), half-filled (in progress), or full (done), with done rows struck through in ink and their text in `spot-ink`. Task checks in the report are 44px versions carrying the step number until done, when the number gives way to a white check on the accent. Progress bars are an 8 to 9px ink-bordered track with the accent advancing.

### Motion
Inked in one stroke. `--ease` (0.2,0.7,0.2,1) for state changes, `--ease-out` (0.16,0.84,0.28,1) for arrivals, `--ease-physical` (0.34,1.32,0.48,1) for things that stand for objects. Durations 120ms (transform), 180ms (colour), 340ms (slow), 400ms for a screen rising 10px into place, 450ms for the rail, 540ms for a card arriving with a 55ms stagger. Every animation is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** resolve every colour to stock, warm grey, or the off-black ink; terracotta is a button, a stroke, a numeral, a tab, or a dark word; the correction pencil is for a failure only.
- **Do** separate with rules: 1px ink between rows, 2px ink to frame a panel, 1px ink with 18px of air above a section title.
- **Do** set titles in Archivo 700 at moderate sizes, labels in Archivo narrow (80%) caps at 12px with 0.09em tracking, buttons at 90% width, and reading text in Archivo at 16px / 1.6.
- **Do** caption every drawing "Fig. n" in the ink tab and draw it in the elevation voice: white-filled items, round-capped ink strokes, one terracotta label stroke per item, flat grey zones, eye level in the accent tint.
- **Do** mark state with a printed square (empty, half, full), a strikethrough, or a word, and pair any hue with one of those.
- **Do** keep focus rings 2px accent outlines with square corners, and keep touch targets at 44px minimum.

### Don't:
- **Don't** set grey type or a grey rule; the one grey is the `tint` field, and secondary text is `spot-ink`.
- **Don't** add a box-shadow, a gradient surface, or a corner radius.
- **Don't** put a kicker or eyebrow above a heading; the figure number lives inside the caption or the h3.
- **Don't** fill a panel, a card, or a section with terracotta, or let the accent be the only thing that says "selected".
- **Don't** use red, terracotta, or any hue as the sole carrier of a state.
- **Don't** introduce a second typeface; the display voice is Archivo 700, and the h1 does not exceed 46px.
- **Don't** arrange a section as photo-left, headline-right, three feature cards.
