---
name: TidyMap
description: A shelf-by-shelf organization plan, set like a home-economics manual in two inks on white stock.
colors:
  stock: "#ffffff"
  ink: "oklch(0.20 0.01 200)"
  spot: "oklch(0.535 0.100 195)"
  spot-deep: "oklch(0.47 0.095 195)"
  spot-ink: "oklch(0.44 0.095 195)"
  tint: "oklch(0.945 0.028 195)"
  tint-2: "oklch(0.905 0.045 195)"
  danger: "oklch(0.52 0.19 28)"
  danger-ink: "oklch(0.45 0.18 28)"
  danger-bg: "oklch(0.96 0.025 28)"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(38px, 7vw, 64px)"
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: "-0.028em"
    fontVariation: "wdth 118"
  chapter-number:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(120px, 22vw, 300px)"
    fontWeight: 900
    lineHeight: 0.78
    letterSpacing: "-0.06em"
    fontVariation: "wdth 125"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(26px, 4.4vw, 38px)"
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: "-0.022em"
    fontVariation: "wdth 108"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(18px, 3vw, 21px)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  lede:
    fontFamily: "Source Serif 4, Georgia, Times New Roman, serif"
    fontSize: "clamp(17px, 2.4vw, 20px)"
    fontWeight: 400
    lineHeight: 1.5
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
  chapter-opener:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.stock}"
    padding: "clamp(28px, 6vh, 64px) 18px clamp(28px, 5vh, 52px)"
  exercise-box:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    padding: "clamp(20px, 3.5vw, 34px) clamp(20px, 3.5vw, 36px)"
---

# Design System: TidyMap

## Overview

**Creative North Star: "The Home-Economics Manual"**

TidyMap is set the way a mid-century home-economics textbook was printed: white stock, one turquoise spot plate, black ink, and a single halftone screen of the plate. A plan is a lesson. The landing page opens as Chapter 1 with the chapter number at display scale on a full-bleed turquoise band; Figure 1 is an inked pantry elevation whose jumbled items slide into labeled zones; the call to action is an exercise box, a ruled frame with "Exercise" printed down its spine. Wizard steps read as lessons with a step counter in the running head; the results screen is the Plan chapter with a contents column, figure tables, and printed stage marks; the products page is the appendix; legal pages are back-matter.

Density is that of a printed page rather than a dashboard: generous section rhythm (64 to 104px between chapters), a 760px reading measure for lessons and 1100px for figures and spreads, 1px black rules doing the work that borders, shadows, and cards would do elsewhere. Everything that is not the plate or the ink is a rule, a tint, or white space. Depth is refused: no shadows, no gradients as surfaces, no rounded corners.

Confirmed visual rejections: grey as a colour (secondary text is the plate printed dark, never a neutral grey); hue as the only carrier of state; the photo-left, headline-right, three-feature-card arrangement; kickers above headings; drop shadows and lifted cards.

**Key Characteristics:**
- Two inks and one screen: white, turquoise plate, ink black, 18% tint. Nothing else except a correction-pencil red for failure.
- Titles in Archivo pushed wide and black; labels in Archivo narrowed, capped, and letterspaced; reading text in Source Serif 4.
- Figures are inked cupboard elevations, numbered "Fig. n", with 2.5px ink strokes and tint-filled zones.
- Rules, not boxes: 1px and 2px black rules separate, frame, and underline; corners are square.
- State is a printed mark (empty square, half-filled square, filled square) or a word, never a colour alone.
- Motion is one stroke: exponential ease-out, 120 to 340ms for UI, one long 1.15s sort for Figure 1.

## Colors

A two-colour offset job: white stock, one turquoise plate at three densities, black ink, and a single red reserved for errors.

### Primary
- **Turquoise Plate** (`spot`): the spot ink laid as a field. Chapter-opener band, primary buttons, selected chips and segments, the progress rail, filled stage marks, the brand square, focus ring, caret, and selection. White type sits on it at 4.6:1.
- **Plate, Pressed** (`spot-deep`): the same plate on hover of a primary button. Not used anywhere else.
- **Plate at Full Density** (`spot-ink`): small turquoise type on white (clears 6:1). Secondary text, step counters, muted notes, placeholder text, the "Eye level" note heading in figures, link hover, dashboard metadata. This is the only "secondary text" colour in the system; grey does not exist.

### Neutral
- **White Stock** (`stock`): page, cards, buttons at rest, inputs, and the fill of every inked item in a figure.
- **Ink** (`ink`): near-black with the plate's cast. Body text, headings, every rule and border, figure strokes, the figure-number tab, the exercise spine, the dashboard cover tag.
- **Halftone Tint** (`tint`): the plate screened to 18%. Hover fill on ghost buttons, chips, cards and options; selected options; figure zones; the signup and rate panels; notes and callouts; the step-art band; the progress-rail track.
- **Halftone Tint, 30%** (`tint-2`): the rare second screen. Active press on ghost buttons, the "eye level" zone in figures, the wizard zone preview background. Use it only where the tint already exists and one row must read as the emphasized one.

### Semantic
- **Correction Pencil** (`danger`, `danger-ink`, `danger-bg`): the one exception to two colours, used for nothing but a failure (invalid email, unplaceable organizer). Success, info, and warning are not separate hues: success and info are the plate; warning is ink on the tint.

### Named Rules
**The Two-Ink Rule.** Every surface resolves to stock, ink, the plate, or a screen of the plate. A new colour is a new plate and needs a press run; do not add one.
**The No-Grey Rule.** Secondary text is `spot-ink`, borders are `ink`, disabled state is opacity 0.45 on the full-colour element. There is no neutral grey token and none may be introduced.
**The Correction-Pencil Rule.** Red appears only on a failure, never on a call to action, badge, or highlight, so it can never be mistaken for one.
**The Marked-State Rule.** Never encode state by hue alone. Pair every state with a printed mark (empty, half, filled square), a strikethrough, or a word.

## Typography

**Display Font:** Archivo variable, width axis 62 to 125% (with -apple-system, Helvetica Neue, Arial)
**Body Font:** Source Serif 4 variable with optical sizing (with Georgia, Times New Roman)
**Label/Mono Font:** Archivo narrowed to 80% width for labels; system monospace is declared but unused in shipped surfaces

**Character:** The grotesque sets the chapter openers and labels; the book face runs the lessons. Titles are Archivo at its widest and heaviest (118 to 125% width, weight 900, tight negative tracking); labels are the same face narrowed to 80%, capped, and letterspaced like a shelf label. Everything the reader reads for meaning is Source Serif 4 at 17px.

### Hierarchy
- **Chapter Number** (900, `clamp(120px, 22vw, 300px)`, 0.78, width 125%, -0.06em): the numeral in the chapter-opener band and, at 40px, the numerals in the "How it works" list. Lining figures.
- **Display** (900, `clamp(38px, 7vw, 64px)`, 0.98, width 118%, -0.028em): h1 only. White on the plate in the chapter opener; ink on stock elsewhere. Balanced wrapping, max 14ch in the opener.
- **Headline** (900, `clamp(26px, 4.4vw, 38px)`, 1.02, width 108%, -0.022em): h2 section heads. On the landing page each sits on a 4px double rule with 14px of padding above.
- **Title** (800, `clamp(18px, 3vw, 21px)`, 1.1, -0.012em): h3. Card names, figure titles, list items. h4 is 16px / 700.
- **Lede** (Source Serif 4, `clamp(17px, 2.4vw, 20px)`, 1.5): the paragraph under a chapter or section title, max 46 to 58ch.
- **Body** (Source Serif 4, 17px, 1.6): reading text. Small is 14px / 1.5. Table and figure captions are 15px serif.
- **Label** (Archivo 700 to 800, 12px, 0.09em, uppercase, width 80%): figure numbers, column heads, nav items, step counters, the exercise spine, the contents heading, the 3D control labels.
- **Button** (Archivo 800, 14px, 0.06em, uppercase, width 90%): every button label; small buttons drop to 12.5px.

### Named Rules
**The Two-Width Rule.** Archivo is used at two ends of its width axis and nowhere in between: wide (108 to 125%) for titles and numerals, narrow (80 to 90%) for labels and buttons. Regular width Archivo appears only in card names and metadata at 700 to 800.
**The Serif Reads Rule.** Anything a reader reads as a sentence is Source Serif 4. Archivo is for things that are looked up, not read: titles, labels, numbers, buttons.
**The Figure-Number Rule.** A figure is captioned "Fig. n" in a white-on-ink label tab; the number is the only kicker-shaped element the system has, and it sits inside the caption or the h3, never above a heading.

## Layout

Two measures: lessons and legal text read at 760px (`--maxw`; legal at 680px); the landing page, report, and dashboard spread to 1100px. Page gutter is 18px, rising to 24px at 560px. The running head (sticky, 1px rule beneath, thickening to 2px on scroll) and the flow footer (fixed, 2px rule above) are the page furniture; the progress rail is a 3px tint track with the plate advancing along it.

Full-bleed fields break out of the gutter with a negative margin and a 100vmax box-shadow in the field's own colour, clipped to the band; this is the only box-shadow in the system and it is a paint trick, not depth.

Section rhythm on the landing page is `clamp(64px, 10vh, 104px)` above each h2. Inside a section: 34 to 40px to the first block, 12 to 16px between cards, 10 to 12px inside lists. Rules do the separating: lists and tables are stacks of rows with a 1px rule beneath each and a 2px rule on top of the whole.

Grids: space cards run two across on a phone, four across from 780px, centred so an odd third card sits mid-row; the story spread is 320px photo plus fluid column from 700px; the report is a 190px sticky contents column plus fluid from 960px, and a horizontally scrolling contents bar beneath the running head below that; the wizard is 7fr question plus 4fr sticky rail from 900px. The chapter opener collapses from numeral-beside-title to numeral-above-title at 719px, and Figure 1 crops to the cupboard alone with its notes set as a list beneath.

Breakpoints in use: 420, 480, 520, 560, 720, 760, 780, 860, 880, 900, 960px. The nav collapses to a hamburger at 859px (measured: the row needs 777px).

## Elevation & Depth

Print casts no shadow. Every shadow token is `none`, corners are 0, and there are no gradient surfaces. Depth is conveyed by ink weight and tone: a 1px rule for a card or row, a 2px rule for a panel that matters (exercise box, modal, signup, rate panel, chapter head), a 4px double rule under a section title. Hierarchy of surfaces is stock, then tint, then tint-2: a hovered card goes to tint, a pressed one to tint-2, and a selected one gets the plate as its border plus a 1px inset ring of the plate.

The modal backdrop is the ink at 60% over the page, not a blur. The only lifts are 1px down on button press and 3px up on space-card hover, both transforms without shadow.

### Named Rules
**The Rule-Not-Shadow Rule.** To separate or frame, add a rule (1px ink, 2px ink, or 4px double). Never a shadow, never a gradient, never a radius.
**The Inset-Ring Rule.** A selected or hovered card marks itself with `inset 0 0 0 1px` of the plate inside its ink border, so the mark stays within the box and the layout does not shift.

## Shapes

Every corner is square (radius 0, including focus rings). Borders are 1px solid ink at rest; 2px for load-bearing frames; dashed 1px ink for empty or provisional containers (the helper note, the "new space" card, a skipped task). Figures are drawn with round line joins and caps at 2.5px strokes (4px for the case outline, 2.2 to 2.6px for items and their spot-ink labels), zones are flat tint rectangles inside the case. The exercise box carries a vertical ink spine with its label rotated; the figure number is an ink tab; the brand mark is a 30px turquoise square. Stage marks are 16px squares with a 2px ink border: empty, half-filled with a hard-edged plate fill, or fully filled with the plate. Checkbox-style completion marks are 44px squares of the same construction.

## Components

### Buttons
A button is a ruled box with a caps label: the primary one is printed in the plate, the ghost is the same box left unprinted.
- **Shape:** square corners (0), 1px ink border on both variants.
- **Primary:** plate fill, white label, ink border; 14px 22px padding; 16px 28px / 15px in the exercise box.
- **Hover / Focus:** hover deepens the plate; active goes to ink and drops 1px; focus-visible is a 2px plate outline offset 2px. Transitions 180ms on colour, 120ms on transform.
- **Ghost:** white fill, ink label; hover goes to tint, active to tint-2.
- **Small:** 11px 14px padding at 12.5px. Disabled is opacity 0.45.
- **Text buttons** (nav, back, replay, home links): label style in ink, hover to spot-ink, underline drawn in the plate on hover.

### Chips
- **Style:** white, 1px ink border, 9px 16px, Archivo 600 at 14px.
- **State:** hover to tint; selected inverts to plate fill with white text (plate border on wizard chips, ink border on 3D-viewer chips). Segmented yes/no controls are the same construction sharing one border with the selected segment plate-filled.
- **Tags** (small, non-interactive): tint fill, ink border, 12.5px; semantic variants use the plate or the correction pencil.

### Cards / Containers
- **Corner Style:** square.
- **Background:** white; tint for panels that are notes, callouts, or asks (signup, rate, helper, rail note, safety note).
- **Shadow Strategy:** none (see Elevation). Selection is a plate border plus 1px inset plate ring; dashboard cards take a 1px inset ink ring on hover.
- **Border:** 1px ink; 2px ink for the modal, exercise box, signup, and rate panel.
- **Internal Padding:** `clamp(18px, 4vw, 26px)`; option rows 15px 16px; card labels 12px 16px 14px.
- **Space cards:** image area on tint at 4/3 (3/2 on the landing gallery), 1px rule beneath, name in Archivo 800 at 18px; hover lifts 3px with the inset ring; selected shows a 28px plate check square in the corner.

### Inputs / Fields
- **Style:** white, 1px ink border, 12px 14px, Archivo at 15px; labels in Archivo 600 at 14px above. Placeholder text is spot-ink. Range sliders are a 4px ink track with an 18px square plate thumb bordered in ink.
- **Focus:** 2px plate outline, no offset (the ring sits on the border).
- **Error:** correction-pencil border and outline with a 320ms shake (none under reduced motion).

### Navigation
- **Running head:** sticky white bar with a 1px rule beneath; brand as a 30px plate square plus the wordmark in Archivo 900 wide caps; nav items in label style with a plate underline drawn on hover; a step counter ("Step 4 of 11") in spot-ink on wizard screens; below 860px the nav folds into a full-width stacked list of 48px rows separated by rules.
- **Report contents:** a sticky 190px column with a 2px-ruled heading and 1px-ruled rows (Archivo 600 at 13.5px), current chapter in spot-ink; below 960px it becomes a scrolling caps bar under the running head with a 3px plate underline on the current chapter.
- **Flow footer:** fixed, white, 2px rule above, back link in label style at left, primary button at right, 44px minimum targets.

### Figures (signature)
An inked cupboard elevation: a 4px ink case, 2.5px shelves, items drawn white-filled with 2.4px round-capped ink strokes and a spot-ink label stroke on each, zones as flat tint rectangles (tint-2 for the eye-level shelf), zone names in Archivo 800 caps at 16 to 19px with 0.08em tracking, and leader lines to serif notes. Figure 1 on the landing page is the interactive version: items begin displaced and rotated and travel to their zone over 1.15s on the exponential ease-out, staggered 55ms per item; zones screen in after 1.1s; leader lines draw in via dash offset; notes slide in last; a "Sort it again" replay control appears after 2.6s. Under reduced motion the finished figure is shown and the replay hidden. The plan report's hero (`planElevationSvg`) is the same drawing generated from the user's zones, one shelf per zone.

### Stage marks (signature)
Progress is printed, never coloured: a 16px ink-bordered square that is empty (to do), half plate (in progress), or full plate (done), with done rows struck through in ink and their text in spot-ink. Task checks in the report are 44px versions carrying the step number until done, when the number gives way to a white check on the plate. Progress bars are a 8 to 9px ink-bordered track with the plate advancing.

### Motion
Inked in one stroke. `--ease` (0.2,0.7,0.2,1) for state changes, `--ease-out` (0.16,0.84,0.28,1) for arrivals, `--ease-physical` (0.34,1.32,0.48,1) for things that stand for objects. Durations 120ms (transform), 180ms (colour), 340ms (slow), 400ms for a screen rising 10px into place, 450ms for the rail. Step-art scenes loop at 3 to 3.8s. Every animation is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** resolve every colour to stock, ink, the plate, or a screen of the plate; use the correction pencil only for a failure.
- **Do** separate with rules: 1px ink between rows, 2px ink to frame a panel, 4px double under a section title.
- **Do** set titles in Archivo wide (108 to 125%) and black (900), labels in Archivo narrow (80%) caps at 12px with 0.09em tracking, and reading text in Source Serif 4 at 17px / 1.6.
- **Do** caption every drawing "Fig. n" in the ink tab and draw it in the elevation voice: white-filled items, 2.2 to 2.5px round-capped ink strokes, flat tint zones.
- **Do** mark state with a printed square (empty, half, full), a strikethrough, or a word, and pair any hue with one of those.
- **Do** keep focus rings 2px plate outlines with square corners, and keep touch targets at 44px minimum.

### Don't:
- **Don't** introduce grey text, grey borders, or a neutral grey token; secondary text is spot-ink.
- **Don't** add a box-shadow, a gradient surface, or a corner radius; the only allowed shadow is the 100vmax full-bleed paint trick on a field.
- **Don't** put a kicker or eyebrow above a heading; the figure number lives inside the caption or the h3.
- **Don't** use red, the plate, or any hue as the sole carrier of a state.
- **Don't** arrange a section as photo-left, headline-right, three feature cards.
- **Don't** set Archivo at its default width for a title or a label; the width axis is the family's voice here.
