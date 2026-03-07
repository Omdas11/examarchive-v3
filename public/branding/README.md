# ExamArchive – Custom Branding

Place your custom brand assets in this directory.
Files here are served from the root of the site (e.g. `/branding/logo.png`).

## Supported files

| File | Used for | Recommended size | Format |
|------|----------|-----------------|--------|
| `logo.png` | Site logo (navbar, header) | 56 × 56 px or larger | PNG (or SVG renamed to `.png`) |
| `loading.png` | Loading / splash screen icon | 56 × 56 px | PNG |

Both files are **optional**.  
If a file is missing the app automatically falls back to the built-in inline SVG "EA" monogram,
so the site will always render correctly even without any custom branding.

## Tips

- Use a **square** image for both files so it looks correct inside the rounded badge.
- Transparent background (PNG-24) works best on both light and dark themes.
- You can also use an **SVG** file — just name it `logo.png` or `loading.png` and the browser
  will display it correctly (browsers accept SVGs served as `image/png` paths when using `<img>`).
- After adding or replacing files, do a hard refresh (`Ctrl+Shift+R`) to clear the browser cache.

## How it works

`EALogo` (`src/components/EALogo.tsx`) first tries to load `/branding/logo.png`.  
If the request returns a 404 the component quietly falls back to the inline SVG monogram — no
broken-image icons, no console errors that affect users.

Similarly, `src/app/loading.tsx` first tries `/branding/loading.png`, then
`/logos/loading/ea-loader.svg`, and finally the inline animated badge.
