---
name: TidyMap
description: A shelf-by-shelf organization plan, set like a home-economics manual bound in linen: charcoal ink on white stock, stone fields, one brass rule.
colors:
  stock: "#ffffff"
  ink: "oklch(0.27 0.006 60)"
  spot-deep: "oklch(0.16 0.005 60)"
  spot-ink: "oklch(0.50 0.085 78)"
  brass: "oklch(0.68 0.10 82)"
  band: "oklch(0.90 0.014 80)"
  tint: "oklch(0.955 0.008 80)"
  tint-2: "oklch(0.915 0.014 80)"
  danger: "oklch(0.52 0.19 28)"
  danger-ink: "oklch(0.45 0.18 28)"
  danger-bg: "oklch(0.96 0.025 28)"
typography:
  display:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(40px, 7vw, 68px)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(30px, 4.6vw, 44px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.005em"
  lede:
    fontFamily: "Bodoni Moda, Didot, Bodoni 72, Georgia, serif"
    fontSize: "clamp(19px, 2.2vw, 24px)"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(17px, 3vw, 19px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
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
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.spot-deep}"
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
    backgroundColor: "{colors.ink}"
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
    backgroundColor: "{colors.band}"
    textColor: "{colors.ink}"
    padding: "clamp(28px, 6vh, 64px) 18px clamp(28px, 5vh, 52px)"
  exercise-box:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    padding: "clamp(20px, 3.5vw, 34px) clamp(20px, 3.5vw, 36px)"
  note-panel:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.ink}"
    padding: "12px 14px"
---

# Design System: TidyMap

## Overview

**Creative North Star: "The Home-Economics Manual, bound in linen"**

TidyMap is printed the way a mid-century home-economics textbook was, after the plates were pulled: white stock, one warm charcoal ink that is also the plate, a stone tint for anything that holds content, and a single brass rule where a label wants a mark. A plan is a lesson. The landing page opens as a chapter on a stone band with a short brass rule over a Bodoni title; Figure 1 is an inked pantry elevation whose jumbled items slide into labeled zones; the call to action is an exercise box, a 2px-ruled frame with "Exercise" printed down its spine. Wizard steps are lessons with a step counter in the running head; the results screen is the Plan chapter with a contents column, figure tables, and printed stage marks; the products page is the appendix; legal pages are back-matter.

Density is that of a printed page rather than a dashboard: a section rhythm of 64 to 104px between chapters, a 760px reading measure for lessons and 1100px for figures and spreads, 1px charcoal rules doing the work that borders, shadows, and cards would do elsewhere. Everything that is not ink is stock, stone, or a brass rule. Depth is refused: no shadows, no gradient surfaces, no rounded corners.

Confirmed visual rejections: grey as a colour (secondary text is brass printed dark, never a neutral grey); hue as the only carrier of state; the photo-left, headline-right, three-feature-card arrangement; kickers above headings; drop shadows and lifted cards; a chapter numeral set as a glyph (Bodoni's figure is a bare stem at display size, so the band opens on a brass rule instead).

**Key Characteristics:**
- One ink and two papers: charcoal is text, rule, button, and selected state alike; stock and stone are the only fields; brass is a rule or a small word, never a field.
- Titles in Bodoni Moda at book weight, quiet and large; the lede in Bodoni italic; everything looked up (labels, buttons, numbers, reading text) in Archivo.
- Figures are inked cupboard elevations captioned "Fig. n": charcoal strokes, white-filled items, flat stone zones, and one brass label stroke per item.
- Rules, not boxes: 1px and 2px charcoal rules separate, frame, and underline; corners are square.
- State is a printed mark (empty square, half-filled square, filled square) or a word, never a colour alone.
- Motion is one stroke: exponential ease-out, 120 to 340ms for UI, one long 1.15s sort for Figure 1.

## Colors

A one-ink job on two papers with a brass rule: warm charcoal on white stock, stone for content fields, brass for the smallest marks, and a correction-pencil red reserved for failure.

### Primary
- **Charcoal Ink** (`ink`): the ink and the plate at once. Body text, headings, every rule and border, figure strokes, primary buttons, selected chips and segments, filled stage marks, the brand square, the figure-number tab, the exercise spine, the modal frame. White type on it is ink-on-white inverted (12:1). The legacy `--spot`, `--primary`, `--sage`, `--success`, and `--info` names all resolve here.
- **Charcoal, Pressed** (`spot-deep`): the ink deepened for a primary button's hover. Not used anywhere else.

### Secondary
- **Brass Rule** (`brass`): the one accent, and it is never a field. The 56px by 3px rule above the chapter title, the progress rail's advancing bar, the label stroke on every inked item (`.f-lbl`, `.art-el .lbl`), the numerals in the "How it works" list, a 1px border on the "why" flag, and the global focus ring.
- **Brass, Printed Dark** (`spot-ink`): brass dark enough for small text on white (clears 5:1). The only secondary-text colour: step counters, dashboard metadata, muted notes, placeholder text, link hover, the "Eye level" note heading in figures, the current chapter in the contents column, done-task text.

### Neutral
- **White Stock** (`stock`): page, cards, buttons at rest, inputs, and the fill of every inked item in a figure.
- **Stone Band** (`band`): the chapter-opener field alone, run full-bleed. Ink type sits on it.
- **Stone** (`tint`): every field that carries content. Hover fill on ghost buttons, chips, cards and options; selected options; figure zones; the card-art stage; the step-art band; the signup, rail note, helper, safety note, and legal callout panels.
- **Deeper Stone** (`tint-2`): the emphasized row where stone already exists. Active press on ghost buttons and segments, the eye-level zone in figures, the progress-rail track, the highlighted zone in the "What you get" figure.

### Semantic
- **Correction Pencil** (`danger`, `danger-ink`, `danger-bg`): the one exception, used for nothing but a failure (invalid email, unplaceable organizer). Success and info are the ink; warning is ink on stone.

### Named Rules
**The One-Ink Rule.** Text, rule, button, and selection are the same charcoal. A selected thing is printed, not coloured; a new colour is a new plate and does not get one.
**The Brass-Is-A-Rule Rule.** Brass appears as a stroke, a short rule, a numeral, or a small dark word. It never fills a field or a button, and it never carries state alone.
**The No-Grey Rule.** Secondary text is `spot-ink`, borders are `ink`, disabled state is opacity 0.45 on the full-colour element. There is no neutral grey token and none may be introduced.
**The Correction-Pencil Rule.** Red appears only on a failure, never on a call to action, badge, or highlight, so it can never be mistaken for one.
**The Marked-State Rule.** Never encode state by hue alone. Pair every state with a printed mark (empty, half, filled square), a strikethrough, or a word.

## Typography

**Display Font:** Bodoni Moda variable, optical sizing on (with Didot, Bodoni 72, Georgia)
**Body Font:** Archivo variable, width axis 62 to 125% (with -apple-system, Helvetica Neue, Arial)
**Label/Mono Font:** Archivo narrowed to 80% width for labels; system monospace is declared but unused in shipped surfaces

**Character:** The Didone sets the chapter titles and the lede at book weight, so a title is quiet and large rather than bold; the grotesque sets everything the reader looks up. Bodoni's hairlines are the reason the palette is warm charcoal rather than black: the face does not survive a hard black stem at 68px on a phone.

### Hierarchy
- **Display** (Bodoni Moda 400, `clamp(40px, 7vw, 68px)`, 1.02, -0.01em): h1 only. Ink on the stone band with the brass rule 22px above it; max 16ch. The report hero (`clamp(34px, 5.2vw, 56px)`) and the legal h1 are the same voice a step down.
- **Headline** (Bodoni Moda 400, `clamp(30px, 4.6vw, 44px)`, 1.06, -0.005em): h2 section heads, sitting on a 1px rule with 18px above. The room heading in the spaces gallery is the same face at `clamp(24px, 2.8vw, 30px)`, centred on a rule.
- **Lede** (Bodoni Moda italic, `clamp(19px, 2.2vw, 24px)`, 1.45): the paragraph under a chapter title, the exercise question, the first paragraph of the credibility spread. Max 44 to 48ch.
- **Title** (Archivo 700, `clamp(17px, 3vw, 19px)`, 1.15, -0.012em): h3 card names, figure titles, list items. Card names run 800 at 18px; h4 is 16px / 700.
- **Body** (Archivo 400, 16px, 1.6): reading text. Section subtitles run 17px; small is 14px / 1.5; figure captions 14.5px; legal prose 16.5px / 1.7. Serif inside a figure is 14.5 to 15px Bodoni for item names and step text.
- **Label** (Archivo 700 to 800, 12px, 0.09em, uppercase, width 80%): figure numbers, column heads, nav items, step counters, the exercise spine, the contents heading, zone names in figures (16 to 19px, 0.08em).
- **Button** (Archivo 800, 14px, 0.06em, uppercase, width 90%): every button label; small buttons drop to 12.5px; the exercise-box primary rises to 15px.

### Named Rules
**The Quiet-Title Rule.** A title is Bodoni Moda at weight 400. Bold is not a title size; if a heading needs more presence it gets more size, a rule, or a brass mark, never a heavier weight.
**The Serif-Is-Looked-At Rule.** Bodoni appears where the eye rests (titles, ledes, the numeral in a numbered method, item names in a figure) and Archivo everywhere the eye works (reading text, labels, controls, tables).
**The Narrow-Label Rule.** A caps label is Archivo at 80% width with 0.09em tracking; buttons are the same voice at 90%. Regular-width Archivo is for reading and for card names, never for a label.
**The Figure-Number Rule.** A figure is captioned "Fig. n" in a white-on-ink label tab; the number sits inside the caption or the h3, never above a heading.

## Layout

Two measures: lessons read at 760px (`--maxw`; the wizard at 820px, legal text at 680px); the landing page, report, and dashboard spread to 1100px. Page gutter is 18px, rising to 24px at 560px. The running head (sticky, 1px rule beneath, thickening to 2px on scroll) and the flow footer (fixed, 2px rule above) are the page furniture; the progress rail is a 3px deeper-stone track with a brass bar advancing along it.

The chapter band breaks out of the gutter with a negative margin and a 100vmax box-shadow in its own stone, clipped to the band; this is the only box-shadow in the system and it is a paint trick, not depth.

Section rhythm on the landing page is `clamp(64px, 10vh, 104px)` above each h2. Inside a section: 30 to 40px to the first block, 12 to 16px between cards, 10 to 12px inside lists. Rules do the separating: lists and tables are stacks of rows with a 1px rule beneath each and a 1px or 2px rule on top of the whole.

Grids: space cards run two across on a phone, four across from 780px, centred so an odd third card sits mid-row; the story spread is 320px photo plus fluid column from 700px; the method list is 52px numeral, 280px title, fluid text from 720px; the report is a 190px sticky contents column plus fluid from 960px, and a horizontally scrolling caps bar beneath the running head below that; the wizard is 7fr question plus 4fr sticky rail from 900px. Below 719px Figure 1 crops to the cupboard alone with its notes set as a ruled list beneath.

Breakpoints in use: 420, 480, 520, 560, 640, 720, 760, 780, 860, 880, 900, 960, 980px. The nav collapses to a hamburger at 859px (measured: the row needs 777px); the wordmark yields to the brand square below 430px.

## Elevation & Depth

Print casts no shadow. Every shadow token is `none`, corners are 0, and there are no gradient surfaces. Depth is conveyed by ink weight and paper: a 1px rule for a card or row, a 2px rule for a panel that matters (exercise box, modal, signup, setup card, chapter head), a 1px rule with 18px of air above a section title. The order of surfaces is stock, then stone, then deeper stone: a hovered card goes to stone, a pressed one to deeper stone, and a selected one gets an ink border plus a 1px inset ink ring.

The modal backdrop is a 60% dark scrim over the page, not a blur. The only lifts are 1px down on button press and 2 to 3px up on card hover, both transforms without shadow.

### Named Rules
**The Rule-Not-Shadow Rule.** To separate or frame, add a rule (1px ink or 2px ink). Never a shadow, never a gradient, never a radius.
**The Inset-Ring Rule.** A selected or hovered card marks itself with `inset 0 0 0 1px` of ink inside its ink border, so the mark stays within the box and the layout does not shift.

## Shapes

Every corner is square (radius 0, including focus rings and the progress-rail thumb). Borders are 1px solid ink at rest; 2px for load-bearing frames; dashed 1px ink for provisional containers (the helper note, the "new space" card, a skipped task). Figures are drawn with round line joins and caps: 4px for the case outline, 2.5px for shelves, 2.2 to 2.4px for items, 2.6px brass for the label stroke on each item; card-scale elevations (`.art-el`) drop to 1px for items, 1.6px for the case, and 1.2px brass for the label. Zones are flat stone rectangles inside the case. The exercise box carries a vertical ink spine with its label rotated; the figure number is an ink tab; the brand mark is a 28px ink square. Stage marks are 16px squares with a 2px ink border: empty, half-filled with a hard-edged ink fill, or fully filled with ink. Task checks in the report are 44px squares of the same construction.

## Components

### Buttons
A button is a ruled box with a caps label: the primary one is printed in the ink, the ghost is the same box left unprinted.
- **Shape:** square corners (0), 1px ink border on both variants.
- **Primary:** ink fill, white label; 14px 22px padding; 16px 28px at 15px inside the exercise box.
- **Hover / Focus:** hover deepens to `spot-deep`; active returns to ink and drops 1px; focus-visible is a 2px brass outline offset 2px. Transitions 180ms on colour, 120ms on transform.
- **Ghost:** white fill, ink label; hover to stone, active to deeper stone.
- **Small:** 11px 14px padding at 12.5px. Disabled is opacity 0.45.
- **Text buttons** (nav, back, replay, home links): label style in ink, hover to `spot-ink`; nav items draw a 2px ink underline on hover.

### Chips
- **Style:** white, 1px ink border, 9px 16px, Archivo 600 at 14px (11px 18px at 15px in the wizard).
- **State:** hover to stone; selected inverts to ink fill with white text. Segmented yes/no controls are the same construction sharing one border with the selected segment ink-filled. The legal-page sibling nav is a chip row with the current page inverted.
- **Tags** (small, non-interactive): stone fill, ink border, 12.5px; semantic variants use the correction pencil only for danger.

### Cards / Containers
- **Corner Style:** square.
- **Background:** white; stone for panels that are notes, callouts, or asks (signup, rail note, helper, safety note, legal note).
- **Shadow Strategy:** none (see Elevation). Selection is an ink border plus 1px inset ink ring; dashboard cards take the same ring on hover.
- **Border:** 1px ink; 2px ink for the modal, exercise box, signup, and setup cards.
- **Internal Padding:** `clamp(18px, 4vw, 26px)`; option rows 15px 16px; card labels 12px 16px 14px.
- **Space cards:** stone art stage at 4/3 (3/2 on the landing gallery), 1px rule beneath, name in Archivo 800 at 18px; hover lifts 3px with the inset ring and nudges the drawing 5% upward; selected shows a 28px ink check square in the corner.

### Inputs / Fields
- **Style:** white, 1px ink border, 12px 14px, Archivo at 15px; labels in Archivo 600 at 14px above. Placeholder text is `spot-ink`. The signup input shares its right edge with the button. Range sliders are a 4px ink track with an 18px square ink thumb.
- **Focus:** 2px ink outline, no offset (the ring sits on the border). Free-text areas take the inset ink ring instead.
- **Error:** correction-pencil border and outline with a 320ms shake (none under reduced motion).

### Navigation
- **Running head:** sticky white bar with a 1px rule beneath; brand as a 28px ink square plus the wordmark in Bodoni Moda 500 caps at 22px; nav items in label style with an ink underline drawn on hover; a step counter ("Step 4 of 11") in `spot-ink` on wizard screens; below 860px the nav folds into a full-width stacked list of 48px rows separated by rules.
- **Report contents:** a sticky 190px column with a 2px-ruled heading and 1px-ruled rows (Archivo 600 at 13.5px), current chapter in `spot-ink`; below 960px it becomes a scrolling caps bar under the running head with a 3px ink underline on the current chapter.
- **Flow footer:** fixed, white, 2px rule above, back link in label style at left, primary button at right, 44px minimum targets.

### Figures (signature)
An inked cupboard elevation: a 4px ink case, 2.5px shelves, items drawn white-filled with 2.4px round-capped ink strokes and a 2.6px brass label stroke on each, zones as flat stone rectangles (deeper stone for the eye-level shelf), zone names in Archivo 800 caps at 16 to 19px with 0.08em tracking, and 2px leader lines to Archivo notes with the eye-level heading in `spot-ink`. Figure 1 on the landing page is the interactive version: items begin displaced and rotated and travel to their zone over 1.15s on the exponential ease-out, staggered 55ms per item; zones screen in after 1.1s; leader lines draw in via dash offset; notes slide in last; a "Sort it again" replay control appears after 2.6s. Under reduced motion the finished figure is shown and the replay hidden.

The same vocabulary scales down to the card elevations (`EL_ART`, `SETUP_ART`, `productArt`): a 96 by 72 viewBox, 1px ink items, 1.6px case, 1.2px brass label stroke, fills re-inked from the stylesheet to stock, stone, and deeper stone. Each card carries one ambient storage motion (a drawer pulling, a door opening, a bin sliding, a shirt or towel swaying, a jar lifting) looping at 4.1 to 5.4s, quickening to 2.4s and scaling 6% on hover. The plan report's hero (`planElevationSvg`) draws one shelf per zone from the same glyphs, reading its colours from the tokens at render time.

### Stage marks (signature)
Progress is printed, never coloured: a 16px ink-bordered square that is empty (to do), half ink (in progress), or full ink (done), with done rows struck through in ink and their text in `spot-ink`. Task checks in the report are 44px versions carrying the step number until done, when the number gives way to a white check on ink. Progress bars are an 8px ink-bordered track with brass advancing.

### Motion
Inked in one stroke. `--ease` (0.2,0.7,0.2,1) for state changes, `--ease-out` (0.16,0.84,0.28,1) for arrivals, `--ease-physical` (0.34,1.32,0.48,1) for things that stand for objects. Durations 120ms (transform), 180ms (colour), 340ms (slow), 400ms for a screen rising 10px into place, 450ms for the rail, 540ms for a card arriving with a 55ms stagger. Every animation is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** resolve every colour to stock, stone, or the charcoal ink; brass is a rule or a small dark word; the correction pencil is for a failure only.
- **Do** separate with rules: 1px ink between rows, 2px ink to frame a panel, 1px ink with 18px of air above a section title.
- **Do** set titles and ledes in Bodoni Moda at weight 400 (italic for the lede), labels in Archivo narrow (80%) caps at 12px with 0.09em tracking, and reading text in Archivo at 16px / 1.6.
- **Do** caption every drawing "Fig. n" in the ink tab and draw it in the elevation voice: white-filled items, round-capped ink strokes, one brass label stroke per item, flat stone zones.
- **Do** mark state with a printed square (empty, half, full), a strikethrough, or a word, and pair any hue with one of those.
- **Do** keep focus rings 2px outlines with square corners (brass on controls, ink on fields and cards), and keep touch targets at 44px minimum.

### Don't:
- **Don't** introduce grey text, grey borders, or a neutral grey token; secondary text is `spot-ink`.
- **Don't** add a box-shadow, a gradient surface, or a corner radius; the only allowed shadow is the 100vmax full-bleed paint trick on the chapter band.
- **Don't** put a kicker or eyebrow above a heading; the figure number lives inside the caption or the h3, and the chapter band opens on a brass rule, not a numeral.
- **Don't** fill a field or a button with brass, or let brass be the only thing that says "selected".
- **Don't** use red, brass, or any hue as the sole carrier of a state.
- **Don't** set a title in bold Bodoni or in Archivo wide; the display voice is Bodoni at book weight.
- **Don't** arrange a section as photo-left, headline-right, three feature cards.
