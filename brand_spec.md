# Helferchen Brand Specification

This document defines the visual identity for Helferchen, focusing on a modern, professional, and senior-accessible aesthetic.

## 1. Logo

The Helferchen logo uses a "Sketch/Blueprint" style, combining a hand-drawn house icon with the word "HELFERCHEN" in handwritten block capitals.

### Logo Variants
- **Dark Mode (Blueprint):** Blue sketchy lines on a dark background.
- **Light Mode:** Dark sketchy lines on a light background.

### Assets
- `apps/mobile/assets/logo_light.svg` (For dark backgrounds)
- `apps/mobile/assets/logo_dark.svg` (For light backgrounds)
- `apps/website/public/logo_light.svg`
- `apps/website/public/logo_dark.svg`

## 2. Color Palette

The color palette is chosen for high contrast and professional stability (Teal/Marine) while remaining warm and inviting (Gold Accent).

### Core Colors (Hex Codes for Mobile)
- **Primary:** `#00454A` (Deep Marine Teal)
- **Accent:** `#FFB300` (Helferchen Gold)
- **Background (Light):** `#F9FAFB`
- **Background (Dark):** `#111827`
- **Text (on Light):** `#111827`
- **Text (on Dark):** `#F9FAFB`

### Functional Colors
- **Success:** `#10B981`
- **Error:** `#EF4444`
- **Warning:** `#F59E0B`

### Tailwind CSS Variables (for Web)
```css
:root {
  --color-primary: #00454A;
  --color-accent: #FFB300;
  --color-bg-light: #F9FAFB;
  --color-bg-dark: #111827;
  --color-text-light: #111827;
  --color-text-dark: #F9FAFB;
  --color-success: #10B981;
  --color-error: #EF4444;
  --color-warning: #F59E0B;
}
```

## 3. Typography

- **Headings:** [Architects Daughter](https://fonts.google.com/specimen/Architects+Daughter)
  - *Reason:* Matches the "sketch" logo style while remaining legible.
- **Body Text:** [Open Sans](https://fonts.google.com/specimen/Open+Sans)
  - *Reason:* Exceptional legibility and accessibility, especially for senior users.

## 4. Design Principles

1. **Accessibility First:** High contrast (WCAG AA/AAA compliant) and large hit areas.
2. **Clarity over Cleverness:** Simple icons, clear labels, no "tech-jargon".
3. **Professional Warmth:** The deep teal provides stability, while the hand-drawn elements add a personal, human touch.
