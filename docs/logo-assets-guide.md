# Logo Assets Guide

This guide describes the logo asset structure for ExamArchive and explains
where to place files for correct rendering across the site.

---

## Directory Structure

```
public/
└── logos/
    ├── ea.svg                     # Main EA monogram (static badge)
    ├── loading/
    │   └── ea-loader.svg          # Animated EA loader (used on loading screens)
    └── universities/
        ├── .gitkeep               # Keeps the folder tracked by git when empty
        ├── assam-university.png   # Example: Assam University logo
        └── <slug>.png             # One file per university
```

---

## ea.svg — Main EA Logo

**Path:** `public/logos/ea.svg`  
**Usage:** Static EA monogram badge. Used as a fallback/static logo wherever the
`EALogo` component (`src/components/EALogo.tsx`) is rendered.

- Format: SVG
- Recommended size: 64×64 viewBox
- The EA letters must be clearly legible at sizes from 24px to 128px

---

## ea-loader.svg — Animated Loading Indicator

**Path:** `public/logos/loading/ea-loader.svg`  
**Usage:** Shown by `src/app/loading.tsx` during Next.js page transitions.

- Format: SVG with embedded `<style>` / CSS `@keyframes` animation
- The animation should be a gentle pulse or scale effect (≤ 2 s loop)
- If the file is missing or fails to load, `loading.tsx` automatically falls back
  to the inline EA badge with a CSS pulse animation

### Customising the loader

Replace `public/logos/loading/ea-loader.svg` with any SVG that has an embedded
animation. The `<img>` tag in `loading.tsx` has an `onError` handler that shows
the inline fallback if the file cannot be loaded.

---

## University Logos

**Path:** `public/logos/universities/<slug>.png`  
**Usage:** Displayed on paper cards, syllabus pages, and university profile sections
when the university name matches a known slug.

### Naming Convention

Use a URL-safe lowercase kebab-case slug derived from the university name:

| University | File name |
|------------|-----------|
| Assam University | `assam-university.png` |
| Gauhati University | `gauhati-university.png` |
| Dibrugarh University | `dibrugarh-university.png` |
| Cotton University | `cotton-university.png` |

### Recommended specifications

- Format: PNG with transparent background, or SVG
- Dimensions: at least 200×80 px (landscape orientation preferred)
- Max file size: 100 KB per logo

---

## How Logos Are Resolved

University logos are resolved at runtime by converting the stored `institution`
or `university` field to a slug:

```ts
function toLogoSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
// Usage: /logos/universities/${toLogoSlug(paper.institution)}.png
```

If the resolved file does not exist (HTTP 404), the browser falls back to
the text name displayed in the UI.

---

## EALogo Component

The `EALogo` component at `src/components/EALogo.tsx` renders the inline SVG
EA monogram as a React component. It is the single source of truth for the
logo badge used in the Navbar and Login page header. To change the logo
site-wide, update the SVG paths inside `EALogo.tsx`.
