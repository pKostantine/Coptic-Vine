# Text size

How the reading text size is chosen, stored and rendered. The code is
`src/utils/readingFontSize.js` (the model, pure and unit-tested in
`tests/readingFontSize.test.mjs`), `src/utils/preferencesStorage.ts` (this
screen's range, the stored preference), `src/context/ReadingPreferencesContext.tsx`
(the setters) and `src/components/vine/ui/FontScaleControl.tsx` / `.web.tsx`
(the control). Both readers, the scrolling page and the slideshow, take one
number from it: the base size in logical pixels.

## One scale, rendered the same everywhere

The preference is a single number, `fontScale`, a multiple of a 14px base
(`READING_FONT_BASE_PX`). The text renders at `round(14 × scale)` pixels
(`fontScaleToPx`) on every device: a phone and a tablet at a scale of 1.5
both show 21px English. The per-script sizes hang off that one number as
they always have — Coptic at 1.25× and Arabic at 1.15× the base, line
heights of 1.3× (Arabic 1.6×), the gap between language columns a fraction
of it (`documentPresentationMetrics.js`) — so the whole page grows and
shrinks together.

This replaces the earlier ten levels, each a size from a per-device table
(14–38px on a phone, 16–44px on a tablet or desktop), which gave a coarse,
uneven ladder and the same ceiling to a 7" tablet, a 13" iPad and a
projected screen.

## The range grows with the screen

The slider runs from a scale of 1 (14px) to `maxFontScaleForScreen`: the
screen's shortest side over 140, never less than 2.714 (38px, the largest
size the earlier phone table offered), so no reader's size shrinks on a
small phone.

| screen (shortest side) | top of the range | largest English |
| --- | --- | --- |
| 320–380pt phone | 2.71 | 38px |
| 390pt phone | 2.79 | 39px |
| 820pt iPad | 5.86 | 82px |
| 1080p screen | 7.71 | 108px |

The shortest side is the same either way up, so turning the device never
moves the reader's size, and it is read once at startup from
`Dimensions.get('screen')`, the device, not the window. There are twenty
divisions between the ends whatever the screen (`FONT_SCALE_STEPS`): on a
phone a step is about 1px, on a 1080p screen about 5px, which is what the
step buttons, the keyboard and the native slider's `step` move by. The
slider snaps to a division (`snapFontScale`); a size set otherwise (a
migrated one) keeps its exact value until the slider is touched. On the web
the track is focusable and answers the keys a slider does: the arrows step
one division, Page Up and Page Down five, Home and End go to the ends.

New installations open at a scale of 1.5: 21px, between the sizes the
earlier tables opened at.

## Stored, and read from every earlier format

`fontScale` is a device choice, not a synced one (a phone on a pew and a
laptop at home are read differently), stored with
`fontScaleVersion: 2`. A level build that rewrites such a record (an
update rolled back, an old web tab) keeps the version marker and writes its
level beside it with `fontScaleRangeMax`, which this build never writes, so
a record carrying `fontScaleRangeMax` is read as a level whatever version it
claims. `readStoredFontScale` reads whatever an earlier installation wrote: a 1–10 level with `fontScaleRangeMax: 10`, or the
0–10 and 0–20 ranges before that. Each becomes the scale that renders at
the size it rendered on this device (the old table and device class are
kept for that alone), so an update never changes the size a reader had
chosen. A stored scale beyond this screen's top is held to the top.

## What this takes from Spirit & Truth

Spirit & Truth stores one double (`textScaleFactor_v2`, default 1.5) and
offers it on a slider from 1.0 to `shortestSide / 130` with 20 divisions;
each script's size is `(base + offset) × scale` and the column gap
`5 × scale`, so its layout scales as one. This model is the same shape: one
scale, a screen-sized range, twenty divisions, every size derived from the
one number. Two things it does that this app does not, yet: it bundles all
three fonts (its English and Arabic are system fonts here, so a line can
measure differently from one platform to the next), and its script offsets
are tuned to those fonts (ours are the 1.25×/1.15× multipliers for the
fonts we ship and fall back to).
