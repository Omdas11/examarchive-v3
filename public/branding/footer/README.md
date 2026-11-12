# Footer Partner Logos

Place partner and institution logo files in this directory.

## Naming convention

```
partner-<slug>.png    ← e.g. partner-au.png for Assam University
partner-<slug>.svg
```

> Note: university logos were deliberately removed from the footer during the Early Access phase; the footer currently renders only platform logos (GitHub / Google / Appwrite / Next.js). Re-adding a university logo is a deliberate decision, not just dropping a file in here.

## Recommended sizes

| Use | Size |
|-----|------|
| Horizontal logo | 120 × 40 px |
| Square mark | 80 × 80 px |

Use **PNG-24 with transparent background** so logos look correct on both
light and dark themes.

## After uploading

Update `src/components/Footer.tsx` to reference the new files.  
Example:

```tsx
<img src="/branding/footer/partner-au.png" alt="Assam University" height={32} />
```
