# Design

## Overview

A dark, gridded, pixel-type interface: a retro-futurist terminal for a savings circle. The reference is the CyberKongz site (dark grid, acid lime, purple, blocky type); we keep its style family and nothing of its identity. Our motif is the circle: pixel members around a pot, pixel coins, and a pixel "dissolve" edge.

Scene: a member opens an invite link on her phone at night to check who has paid before the round closes. Dark only; there is no light theme.

Colour strategy: **Committed**. Lime carries the primary actions, the live round, and one or two solid blocks per screen. Purple marks "your turn" and the creator. Everything else is tinted near-black.

## Colors

All in OKLCH, neutrals tinted toward lime (hue 128).

| Token | Value | Use |
|---|---|---|
| `--color-void` | `oklch(0.2 0.006 128)` | Page background |
| `--color-grid` | `oklch(0.255 0.008 128)` | Background grid lines |
| `--color-panel` | `oklch(0.235 0.008 128)` | Panels |
| `--color-line` | `oklch(0.38 0.012 128)` | Hairline borders |
| `--color-ink` | `oklch(0.96 0.012 120)` | Main text |
| `--color-dim` | `oklch(0.76 0.02 125)` | Secondary text (≥ 7:1 on void) |
| `--color-lime` | `oklch(0.89 0.2 128)` | Primary action, live state, success |
| `--color-lime-deep` | `oklch(0.55 0.13 132)` | Hard shadow under lime blocks |
| `--color-on-lime` | `oklch(0.2 0.03 130)` | Text on lime |
| `--color-violet` | `oklch(0.62 0.21 300)` | Your turn, creator, highlights (fills) |
| `--color-violet-ink` | `oklch(0.8 0.13 300)` | Violet as text |
| `--color-amber` | `oklch(0.84 0.15 80)` | Waiting, time running out |
| `--color-red` | `oklch(0.72 0.18 28)` | Missed, errors |

## Typography

Pixel type everywhere, in two families.

- **Silkscreen** (700 and 400): display and UI chrome. Logo, page titles, countdown, pot amounts, buttons, badges, small uppercase labels. Crisp at multiples of 8px: 16, 24, 32, 48, 64, 96. Never below 12px.
- **Pixelify Sans** (400 and 600): sentences, amounts inside sentences, form inputs, member addresses. 16px minimum, 17px default body.

Scale: 12 / 14 / 16 / 17 / 24 / 32 / 48 / 64 / 96 px. Headings are uppercase Silkscreen with tight leading (1.0).

## Shape and depth

- Square corners everywhere (radius 0).
- 1px hairline borders in `--color-line`.
- Solid blocks (lime cards, primary buttons) get a hard offset shadow: `4px 4px 0 var(--color-lime-deep)`. No blur shadows.
- Small `× × ×` markers and corner labels as section eyebrows.

## Components

- **Button, primary**: lime fill, on-lime text, Silkscreen 16px uppercase, hard shadow; on press the shadow collapses (translate 2px). Secondary: transparent with lime 1px border and lime text. Quiet: lime text, underline on hover.
- **Badge**: Silkscreen 12px uppercase, 1px border, square. Tones: lime (paid/live), amber (waiting), red (missed), violet (your turn), plain.
- **Panel**: hairline border on `--color-panel`, eyebrow label in the top-left. Never nested.
- **Stat**: tiny uppercase label, Silkscreen value.
- **Pixel art**: rendered as SVG rects from small bitmaps, `shape-rendering: crispEdges`.

## Layout

- Max width 1120px, 16px side gutter on phones.
- Background: 48px grid of hairlines, fixed.
- Screens are built from bordered boxes on that grid, like the reference: big title band, then panels.

## Motion

- 150–200ms ease-out for hover and press.
- The countdown turns amber under one minute. Nothing else moves on its own.
- Respect prefers-reduced-motion (drop the spinner animation to a static marker).
