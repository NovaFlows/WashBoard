# washboard DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: None detected
> Colors: 20 · Fonts: 2 · Components: 7
> Icon library: not detected · State: not detected
> Primary theme: dark · Dark mode toggle: yes · Motion: subtle

## Visual Reference

**Match this design exactly** — study colors, fonts, spacing, and component shapes before writing any UI code.

![washboard Homepage](../screenshots/homepage.png)

---

## 1. Visual Theme & Atmosphere

This is a **dark-themed** interface with a cool tone. Depth is expressed through layered shadows and subtle surface color variation. Typography uses **Geist** throughout — a clean, modern choice that maintains consistency. Spacing follows a **4px base grid** (compact density), with scale: 4, 8, 12, 16, 20, 24, 28, 32px. The accent color **#00c4d4** anchors interactive elements (buttons, links, focus rings). Motion is subtle — smooth transitions (150-300ms) ease state changes without drawing attention.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| color-red-950 | `#460809` | background | Page background, darkest surface |
| color-slate-900 | `#0b1828` | surface | Card and panel backgrounds |
| tw-ring-offset-color | `#ffffff` | text-primary | Headings and body text |
| accent | `#00c4d4` | accent | CTAs, links, focus rings, active states |
| color-orange-900 | `#7e2a0c` | danger | Error states, destructive actions |
| color-emerald-50 | `#ecfdf5` | success | Success states, positive indicators |
| color-orange-100 | `#ffedd5` | warning | Warning states, caution indicators |
| color-blue-700 | `#1447e6` | info | Informational highlights |
| color-blue-950 | `#162456` | unknown | Palette color |
| color-slate-800 | `#1d293d` | unknown | Palette color |
| color-red-50 | `#fef2f2` | unknown | Palette color |
| color-amber-950 | `#461901` | unknown | Palette color |
| color-emerald-950 | `#002c22` | unknown | Palette color |
| color-red-900 | `#82181a` | unknown | Palette color |
| color-blue-500 | `#3080ff` | unknown | Palette color |
| color-blue-900 | `#1c398e` | unknown | Palette color |
| color-emerald-900 | `#004e3b` | unknown | Palette color |
| color-slate-950 | `#020618` | unknown | Palette color |
| unknown | `#6a9fff` | unknown | Palette color |
| color-orange-200 | `#ffd7a8` | unknown | Palette color |

### Dark Mode Token Mapping

| Variable | Light | Dark |
|---|---|---|
| `--background` | `#f8fafc` | `#0f172a` |
| `--foreground` | `#0f172a` | `#f1f5f9` |

### CSS Variable Tokens

```css
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #f8fafc;
--foreground: #0f172a;
--background: #0f172a;
--foreground: #f1f5f9;
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #f8fafc;
--foreground: #0f172a;
--background: #0f172a;
--foreground: #f1f5f9;
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #f8fafc;
--foreground: #0f172a;
--background: #0f172a;
--foreground: #f1f5f9;
--tw-border-style: solid;
--tw-border-style: dashed;
```


---

## 3. Typography Rules

**Font Stack:**
- **Geist** — Heading 1, Heading 2, Heading 3, Body, Caption
- **Geist Mono** — Code

**Font Sources:**

```css
@font-face {
  font-family: "Geist";
  src: url("https://www.washboard.fr/_next/static/media/fef07dbb0973bf53-s.12tyk43_3sh9u.woff2") format("woff2");
  font-weight: 100;
}
@font-face {
  font-family: "Geist Mono";
  src: url("https://www.washboard.fr/_next/static/media/5ce348bf30bf5439-s.0zgw-jeven.3w.woff2") format("woff2");
  font-weight: 100;
}
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Geist | 9rem | 700 |
| Heading 2 | Geist | 0.875rem | 700 |
| Heading 3 | Geist | 0.8125rem | 700 |
| Body | Geist | 11px | 400 |
| Caption | Geist | 10px | 400 |
| Code | Geist Mono | 14px | 400 |

**Typographic Rules:**
- Use **Geist** for all text — do not mix font families
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (1)

**Footer** — `html`

### Navigation (1)

**Navigation** — `html`

### Data Display (1)

**Badge** — `html`

### Data Input (2)

**Button** — `html`
- Animation: 

**Input** — `html`
- State: :focus, :placeholder

### Media (2)

**Image** — `html`

**Icon** — `html`



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48
- **Border radius:** .25rem, 0.75rem, 4px, 12px
- **Max content width:** 96rem

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Raised — cards, buttons, interactive elements

- `0 0 0 3px rgba(22,81,232,0.12)`
- `0 0 0 3px rgba(74,129,255,0.15)`

### Overlay — full-screen overlays, top-level dialogs

- `0 4px 24px rgba(22,81,232,0.06)`
- `0 4px 32px rgba(22,81,232,0.07)`

### Z-Index Scale

`10, 20, 30, 50, 9999`



---

## 7. Animation & Motion

This project uses **subtle motion**. Transitions smooth state changes without demanding attention.

### CSS Animations

- `@keyframes spin`
- `@keyframes pulse`
- `@keyframes washGleam`

### Animated Components

- **Button**: 

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#00c4d4` for interactive elements (buttons, links, focus rings)
- Use `#460809` as the primary page background
- Use **Geist** for all UI text
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: .25rem, 0.75rem, 4px, 12px
- Reuse existing components from Section 4 before creating new ones
- Always use CSS variables for colors — never hardcode hex
- Test both light and dark modes for contrast

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't mix font families — use Geist consistently
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| sm | 40rem | css |
| md | 48rem | css |
| lg | 64rem | css |
| xl | 80rem | css |
| 2xl | 96rem | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #0b1828
Border: 1px solid var(--border)
Radius: 4px
Padding: 16px
Font: Geist
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg #00c4d4, text white
Ghost: bg transparent, border var(--border)
Padding: 8px 16px
Radius: 4px
Hover: opacity 0.9 or lighter shade
Focus: ring with #00c4d4
```

### Build a Page Layout

```
Background: #460809
Max-width: 96rem, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #0b1828
Label: var(--text-muted) (muted, 12px, uppercase)
Value: #ffffff (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #460809
Input border: 1px solid var(--border)
Focus: border-color #00c4d4
Label: var(--text-muted) 12px
Spacing: 16px between fields
Radius: 4px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: Geist, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```
