# ExamArchive – Custom Branding

Place your custom brand assets in this directory.
Files here are served from the root of the site (e.g. `/branding/logo.png`).

## Supported files

| File | Used for | Recommended size | Format |
|------|----------|-----------------|--------|
| `logo.png` | Site logo (navbar, header, login page, loading screen, metadata icons, social preview) | 56 × 56 px or larger | PNG (or SVG renamed to `.png`) |
| `loading.png` | Loading / splash screen icon | 56 × 56 px | PNG |

Both files are **optional**.  
If a file is missing the app automatically falls back to the built-in inline SVG "EA" monogram,
so the site will always render correctly even without any custom branding.

## Footer Partner Logos

Partner / institution logos shown in the footer must be placed in the
**`/public/branding/footer/`** sub-directory.

Naming convention:

```
/public/branding/footer/
  partner-<slug>.png    ← e.g. partner-aus.png, partner-gu.png
  partner-<slug>.svg
```

Recommended size: **120 × 40 px** (horizontal logo) or **80 × 80 px** (square mark).
Use PNG-24 with transparent background so logos look correct on both light and
dark themes.

> The Footer component (`src/components/Footer.tsx`) will need to be updated to
> reference these images once they are uploaded.

## Tips

- Use a **square** image for both `logo.png` and `loading.png` so they look
  correct inside the rounded badge.
- Transparent background (PNG-24) works best on both light and dark themes.
- You can also use an **SVG** file — just name it `logo.png` or `loading.png`
  and the browser will display it correctly (browsers accept SVGs served as
  `image/png` paths when using `<img>`).
- After adding or replacing files, do a hard refresh (`Ctrl+Shift+R`) to clear
  the browser cache.

## How it works

`EALogo` (`src/components/EALogo.tsx`) first tries to load `/branding/logo.png`.  
If the request returns a 404 the component quietly falls back to the inline SVG
monogram — no broken-image icons, no console errors that affect users.

Similarly, `src/app/loading.tsx` first tries `/branding/loading.png`, then
`/logos/loading/ea-loader.svg`, and finally the inline animated badge.

The same `/branding/logo.png` file is referenced in `src/app/layout.tsx` for:
- The Open Graph (`og:image`) social preview
- The `<link rel="icon">` favicon
- The `<link rel="apple-touch-icon">` home-screen icon

