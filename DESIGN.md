---
version: alpha
name: Visa Prepaid Platform
description: Persian-first prepaid card platform with a strict black, white, and Yekan visual identity.
colors:
  primary: "#FFFFFF"
  background: "#000000"
  surface: "#080808"
  surfaceRaised: "#111111"
  border: "#292929"
  text: "#FFFFFF"
  muted: "#A0A0A0"
  success: "#FFFFFF"
  danger: "#BDBDBD"
typography:
  sans:
    fontFamily: '"Yekan", "Yekan Bakh", Tahoma, sans-serif'
  mono:
    fontFamily: 'ui-monospace, "Cascadia Code", monospace'
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
spacing:
  page-max: "72.5rem"
  section-gap: "3rem"
components:
  button: {}
  card: {}
  input: {}
  table: {}
---
# Visa Prepaid Platform Design System

## Overview

### Creative North Star
A restrained, monochrome financial product interface. It should feel deliberately designed and quiet: black canvas, white type, subtle gray separators, and no decorative color. The design relies on typography, spacing, and alignment rather than effects.

### Product context and register
- Audience: Persian-speaking customers and authorized operations staff.
- Locale: Persian (fa-IR), RTL by default. Email addresses, provider IDs, and currency values remain LTR.
- Register: Product-first. Clear labels and direct actions take priority over decoration.
- Signature: Pure black surfaces with crisp white Yekan typography.
- Anti-references: Blue accents, gradients, glow, colorful status treatments, generic AI-style decoration, unnecessary English labels, and promotional filler copy.
- Token ownership: Runtime CSS custom properties in `frontend/src/style.css` are canonical; this document mirrors them.

## Colors
- Canvas: `#000000`.
- Surfaces: `#080808` and `#111111`.
- Text: `#FFFFFF`.
- Secondary text: `#A0A0A0`.
- Borders: `#292929`.
- No blue, colored gradients, or glow effects. Statuses use concise text and monochrome contrast.

## Typography
Use Yekan first, then Yekan Bakh and Tahoma as fallbacks. Keep Persian copy natural, concise, and direct. Do not add English eyebrow labels or decorative microcopy. Use monospace only for technical identifiers where it improves readability.

## Layout
Preserve the existing responsive page structure. Use consistent spacing, clear alignment, simple surfaces, and readable widths. RTL is the default; technical values explicitly use LTR.

## Elevation & Depth
Flat surfaces. No gradients, glow, decorative shadows, or glass effects. Use subtle borders to distinguish sections.

## Shapes
Small, restrained radii. Avoid pill-shaped decoration unless it conveys a real status.

## Components
Buttons use white backgrounds with black text for the primary action; secondary actions use black backgrounds, white text, and subtle gray borders. Inputs and panels remain black with white text. Focus states use a visible white outline.

## Do's and Don'ts
- Do use black backgrounds and white text throughout.
- Do use Yekan as the first font family.
- Do keep customer-facing copy short and functional.
- Don't introduce blue or any other decorative accent color.
- Don't use gradients, glows, ornamental English labels, or unnecessary sentences.
- Don't alter product behavior or imply unsupported card/payment capabilities.
