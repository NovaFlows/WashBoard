# peekly DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: None detected
> Colors: 20 · Fonts: 3 · Components: 7
> Icon library: not detected · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: expressive

## Visual Reference

**Match this design exactly** — study colors, fonts, spacing, and component shapes before writing any UI code.

![peekly Homepage](../screenshots/homepage.png)

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a cool, approachable feel. The light background emphasizes content clarity. Typography pairs **Plus Jakarta Sans** for display/headings with **Space Grotesk** for body text, creating clear visual hierarchy through type contrast. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 18, 20, 34, 50px. The accent color **#573b97** anchors interactive elements (buttons, links, focus rings). Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| tw-ring-offset-color | `#ffffff` | background | Page background, darkest surface |
| color-black | `#000000` | text-primary | Headings and body text |
| accent | `#573b97` | accent | CTAs, links, focus rings, active states |
| danger | `#e11d48` | danger | Error states, destructive actions |
| tw-ring-color | `#72fd4e` | success | Success states, positive indicators |
| color-amber-500 | `#f99c00` | warning | Warning states, caution indicators |
| info | `#8a6cd9` | info | Informational highlights |
| unknown | `#cd8ef8` | unknown | Palette color |
| color-zinc-950 | `#0f0618` | unknown | Palette color |
| tw-ring-color | `#c0392b` | unknown | Palette color |
| unknown | `#1b122c` | unknown | Palette color |
| color-purple-100 | `#f3e8ff` | unknown | Palette color |
| foreground | `#0a0a0a` | unknown | Palette color |
| unknown | `#dcc8ff` | unknown | Palette color |
| unknown | `#f87171` | unknown | Palette color |
| color-slate-200 | `#e2e8f0` | unknown | Palette color |
| unknown | `#f0f1f3` | unknown | Palette color |
| unknown | `#7855be` | unknown | Palette color |
| color-indigo-100 | `#e0e7ff` | unknown | Palette color |
| unknown | `#2a1a49` | unknown | Palette color |

### CSS Variable Tokens

```css
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #fafafa;
--foreground: #0a0a0a;
--accent: #573b97;
--accent-soft: #efebf7;
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #fafafa;
--foreground: #0a0a0a;
--accent: #573b97;
--accent-soft: #efebf7;
--tw-border-style: solid;
--tw-border-style: dashed;
--background: #fafafa;
--foreground: #0a0a0a;
--accent: #573b97;
--accent-soft: #efebf7;
--tw-border-style: solid;
--tw-border-style: dashed;
```


---

## 3. Typography Rules

**Font Stack:**
- **Space Grotesk** — Heading 1, Heading 2, Heading 3
- **Plus Jakarta Sans** — Body, Caption
- **Geist Mono** — Code

**Font Sources:**

```css
@font-face {
  font-family: "Plus Jakarta Sans";
  src: url("https://peekly.app/_next/static/media/0b1dc8ddaa74ba49-s.0e__wj8580tc5.woff2?dpl=dpl_BkGvzer7ErDWtWq6BKdugq279xLZ");
  font-weight: 200;
}
@font-face {
  font-family: "Space Grotesk";
  src: url("https://peekly.app/_next/static/media/32687112bd2dd8db-s.1gepa_7fcx9fm.woff2?dpl=dpl_BkGvzer7ErDWtWq6BKdugq279xLZ");
  font-weight: 500;
}
@font-face {
  font-family: "Geist Mono";
  src: url("https://peekly.app/_next/static/media/5ce348bf30bf5439-s.31988l_ccedte.woff2?dpl=dpl_BkGvzer7ErDWtWq6BKdugq279xLZ");
  font-weight: 100;
}
@font-face {
  font-family: "Instrument Sans";
  src: url("https://peekly.app/_next/static/media/c7f47671e39f7787-s.0klc_mi0-5f4_.woff2?dpl=dpl_BkGvzer7ErDWtWq6BKdugq279xLZ");
  font-weight: 400;
}
@font-face {
  font-family: "GeistSans";
  src: url("https://peekly.app/_next/static/media/Geist_Variable-s.p.0mrjj4bg00-he.woff2?dpl=dpl_BkGvzer7ErDWtWq6BKdugq279xLZ");
  font-weight: 100;
}
```

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Space Grotesk | clamp(4.5rem,14vw,7.5rem) | 700 |
| Heading 2 | Space Grotesk | 3.6rem | 700 |
| Heading 3 | Space Grotesk | 3rem | 700 |
| Body | Plus Jakarta Sans | 12.5px | 400 |
| Caption | Plus Jakarta Sans | 16px | 400 |
| Code | Geist Mono | 14px | 400 |

**Typographic Rules:**
- Limit to 3 font families max per screen
- Use **Space Grotesk** for body/UI text, **Plus Jakarta Sans** for display/headings
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

**List** — `html`

### Data Input (1)

**Button** — `html`
- Animation: 

### Media (3)

**Image** — `html`

**Icon** — `html`

**Map/Canvas** — `html`



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 18, 20, 34, 50, 60, 136, 140
- **Border radius:** inherit, .25rem, .375rem, .5rem, .75rem, 1rem, 1.15rem, 1.35rem, 1.4rem, 1.5rem, 1.6rem, 1.75rem, 2rem, 2px, 2.3rem, 2.5rem, 2.6rem, 3px, 4px, 5px, 6px, 8px, 10px, 11px, 12px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 28px, 999px
- **Max content width:** 1023px

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

- `4px 4px 4px #0000000d,inset 0 1px 1px #ffffff38`
- `0 2px 8px #00000080`
- `0 0 0 6px #cd8ef880`

### Floating — dropdowns, popovers, modals

- `inset 0 1px #ffffffa6,inset 0-1px #ffffff2e,0 2px 12px #0000000f`
- `inset 0 1px #ffffffbf,inset 0-1px #ffffff38,0 4px 18px #00000014`
- `0 0 16px 2px #ffffff24,4px 4px 4px #0000000f,inset 0 1px 1px #ffffff47`

### Overlay — full-screen overlays, top-level dialogs

- `inset 0 1px 1px #fffffff2,inset 0-1px 1px #ffffff80,inset 1px 0 1px #fff6,inset -1px 0 1px #fff6,0 1px 2px #0000000a,0 16px 44px -12px #00000057`
- `0 0#8a6cd900,0 6px 24px #0000002e`
- `0 0 26px 4px #8a6cd98c,0 6px 24px #0000002e`

### Z-Index Scale

`0, 1, 2, 3, 4, 5, 10, 11, 12, 20, 30, 40, 50, 60, 70, 100, 120, 121, 200, 300, 400, 1600, 9999`



---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### CSS Animations

- `@keyframes float`
- `@keyframes marquee`
- `@keyframes marquee-vertical`
- `@keyframes feed-side-in`
- `@keyframes ripple`
- `@keyframes ripple-glass-violet`
- `@keyframes ripple-logo-out`
- `@keyframes panel-slide-in`

### Animated Components

- **Button**: 

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#573b97` for interactive elements (buttons, links, focus rings)
- Use `#ffffff` as the primary page background
- Pair **Space Grotesk** (body) with **Plus Jakarta Sans** (display) — these are the only allowed fonts
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: inherit, .25rem, .375rem, .5rem, .75rem
- Reuse existing components from Section 4 before creating new ones

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't introduce additional font families beyond Space Grotesk and Plus Jakarta Sans and Geist Mono
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| sm | 40rem | css |
| md | 48rem | css |
| lg | 64rem | css |
| xl | 80rem | css |
| 2xl | 96rem | css |
| xs | 380px | css |
| sm | 639px | css |
| sm | 640px | css |
| md | 767px | css |
| lg | 1023px | css |
| lg | 1024px | css |
| 2xl | 1400px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #ffffff
Border: 1px solid var(--border)
Radius: 3px
Padding: 18px
Font: Space Grotesk
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg #573b97, text white
Ghost: bg transparent, border var(--border)
Padding: 8px 18px
Radius: 3px
Hover: opacity 0.9 or lighter shade
Focus: ring with #573b97
```

### Build a Page Layout

```
Background: #ffffff
Max-width: 1023px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #ffffff
Label: var(--text-muted) (muted, 12px, uppercase)
Value: #000000 (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #ffffff
Input border: 1px solid var(--border)
Focus: border-color #573b97
Label: var(--text-muted) 12px
Spacing: 18px between fields
Radius: 3px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: Space Grotesk, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```
