---
version: alpha
name: Visa Prepaid Platform
description: Persian-first virtual prepaid card storefront and operations console with a restrained midnight-blue financial interface.
colors:
  primary: "#3978EE"
  background: "#05070C"
  surface: "#0B101A"
  surfaceRaised: "#101827"
  border: "#1C2A40"
  text: "#F3F6FC"
  muted: "#91A0B5"
  success: "#5ED6AE"
  danger: "#FF777D"
typography:
  sans:
    fontFamily: '"Vazirmatn", "Yekan Bakh", Tahoma, system-ui, sans-serif'
  mono:
    fontFamily: 'ui-monospace, "Cascadia Code", monospace'
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.125rem"
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
The interface should feel like the quiet operations console behind a premium financial product: dark instrument-panel surfaces, precise blue highlights, calm typography, and restrained card-inspired details. The visual signature is a single angled virtual-card object on the sign-in surface. The rest of the product stays utility-first.

### Product context and register
- **Audience and primary job:** Persian-speaking customers browsing eligible prepaid card products and operators maintaining the catalog.
- **Target market(s) and evidence:** International provider-approved recipients; interface language does not imply a recipient country or eligibility.
- **Locale(s) and language policy:** Persian (fa-IR), RTL by default. Email addresses, provider IDs, and currency values remain LTR where appropriate.
- **Usage scene:** Responsive desktop-first operations with mobile account access.
- **Register:** Hybrid; public entry has a small amount of brand expression, authenticated product/admin surfaces prioritize task clarity.
- **Memorable signature:** A restrained blue virtual-card illustration with a slight angle.
- **Restraint:** Avoid glossy gradients across every panel, oversized promotional copy in the admin, and decorative chart noise.
- **Anti-references:** Generic SaaS dashboards with bright white cards, overuse of gradients, and colorful status chips.
- **Token ownership/runtime mapping:** Runtime CSS custom properties in `frontend/src/style.css` are canonical; this document mirrors them. Components consume the semantic variables declared at the top of that stylesheet. Update both in one change and verify contrast after token changes.

## Colors
Midnight is the canvas, raised navy surfaces establish hierarchy, and royal blue is reserved for primary actions and focus. Green communicates verified/active states; red is reserved for errors and destructive intent. Borders remain subtle but visible. Never use blue as a substitute for a success state.

## Typography
Vazirmatn is the primary Persian family, with Yekan Bakh and Tahoma fallbacks. Use a clear weight contrast for headings and controls. Latin technical identifiers, emails, and amounts use LTR direction and tabular/monospace treatment where needed. Avoid all-caps for Persian copy; small uppercase English labels are only metadata.

## Layout
The public sign-in view uses a two-column composition on wide screens and a single vertical flow on mobile. Authenticated pages use a natural document flow with summary cards, section headers, and bounded table overflow. RTL is the page default; technical values explicitly switch to LTR. Preserve readable form widths and never hide horizontal table overflow.

## Elevation & Depth
Use tonal surfaces and hairline borders for hierarchy. Shadows are limited to the card illustration and the sign-in panel. Admin tables and forms should remain mostly flat. No backdrop blur is required for core tasks.

## Shapes
Use medium rounded corners (9–18px) for fields, panels, and buttons. The virtual-card illustration may use a larger radius. Dividers are 1px and low contrast. Status pills are compact and always include text.

## Components

### Foundational visual states
Buttons expose hover, focus-visible, pressed, disabled, and busy states. Inputs expose focus rings and preserve their geometry during validation. Loading uses a compact spinner; reduced-motion preferences disable continuous animation.

### Buttons and actions
Primary solid blue is reserved for the main safe action. Secondary actions are neutral outlined/quiet. Danger is text/outline and visually separated. Button labels name the action.

### Navigation and data display
Tabs use a quiet inset surface and a selected blue-tinted state. Tables use semantic headers, visible row dividers, bounded horizontal overflow, and concise status labels.

### Forms and overlays
Forms use visible labels, inline global errors, no browser-native validation bubbles, and preserved entered values. Sensitive inputs are masked by default. Destructive actions should be reversible where possible and confirmed if they become irreversible.

### Iconography
Use simple text or small CSS geometry until a consistent icon set is adopted. Never use emoji as an operational icon.

### Motion
Use short 150–200ms transitions for hover/focus. The card illustration is the only ambient visual flourish. Honor `prefers-reduced-motion`.

### Content and data visualization
Persian copy is direct and action-oriented. Provider-specific identifiers remain visible to operators but should not be shown to customers. Currency is USD and formatted with the Persian locale while remaining legible.

## Do's and Don'ts
- **Do:** Keep customer and operator surfaces visually related.
- **Do:** Show eligibility and issuance limitations honestly.
- **Don't:** Present a product as orderable until the order/payment flow is implemented.
- **Don't:** imply that a Persian interface means a recipient is eligible in every country.
