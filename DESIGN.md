# Design System: Academic Vitality

## 1. Overview & Creative North Star
The design system is engineered for high-performance academic environments, prioritizing clarity, speed, and mental ease. The brand personality is optimistic yet organized, designed to reduce the "exam anxiety" often associated with student repositories.

The style adheres to **Modern Material 3** principles, utilizing tonal elevation and expressive geometry. It features an hyper-rounded aesthetic to feel approachable and "soft" to the touch, contrasting with the rigorous nature of academic data. Large whitespace and high-contrast elements ensure that students can navigate complex archives without cognitive overload.

---

## 2. Colors
The palette is anchored by **Emerald Green**, symbolizing growth and success, paired with **Action Blue** for interactive elements.

- **Primary (Emerald):** #10B981 - Used for brand expression, key actions, and success states.
- **Secondary (Blue):** #3B82F6 - Dedicated to secondary utilities, links, and informational callouts.
- **Background:** #F9FAFB - A cool-toned off-white to minimize glare during long study sessions.
- **Surface:** #FFFFFF - Pure white containers create a clear "layered" effect against the background.
- **Tonal Palettes:** Use 8% opacity of the primary color for subtle hover states and 4% for "Surface Container" fills.

### Semantic Mapping (MD3)
| Role | Color |
| :--- | :--- |
| Primary | #006C49 |
| Primary Container | #10B981 |
| Secondary | #0058BE |
| Secondary Container | #2170E4 |
| Tertiary | #855300 |
| Surface | #F9FAFB |
| On Surface | #141B2B |
| Outline | #6C7A71 |

Note: The "Surface" token (#F9FAFB) represents the baseline page background, while elevated white containers (Surface Container Lowest) use pure white (#FFFFFF).

---

## 3. Typography
This design system utilizes **Plus Jakarta Sans** for all levels to maintain a friendly, contemporary rhythm.

- **Headlines:** Use Bold (700) weights with slightly tighter letter-spacing to create a strong visual anchor.
- **Body:** Regular (400) weight ensures maximum readability for document descriptions and metadata.
- **Labels:** Medium (500) or Semi-Bold (600) weights are used for buttons, chips, and navigation items to distinguish them from content.

### Type Scale
- **Display Large:** 57px / 64px (Bold)
- **Headline Large:** 32px / 40px (Bold)
- **Title Large:** 22px / 28px (Semi-Bold)
- **Body Large:** 16px / 24px (Regular)
- **Label Large:** 14px / 20px (Semi-Bold)

---

## 4. Layout & Spacing
The layout follows a **Fluid Grid** model with strict 8px increments (the "8pt Grid").

- **Desktop (1240px+):** 12-column grid, 24px gutters, and 64px side margins.
- **Tablet (600px - 1239px):** 8-column grid, 16px gutters, and 32px side margins.
- **Mobile (Under 600px):** 4-column grid, 16px gutters, and 16px side margins.

---

## 5. Elevation & Depth
Depth is achieved through **Tonal Layers** and **Ambient Shadows**, following the Material 3 "Surface" logic.

- **Level 0 (Background):** #F9FAFB.
- **Level 1 (Cards):** #FFFFFF with a subtle shadow (`0px 4px 20px rgba(17, 24, 39, 0.05)`).
- **Level 2 (Hover/Active):** #FFFFFF with a more pronounced shadow (`0px 8px 30px rgba(17, 24, 39, 0.10)`).
- **Level 3 (Search/Modals):** Floating elements use the highest elevation with a 15% opacity primary-tinted shadow.

---

## 6. Shapes
The design system uses a **Pill-shaped** logic for its foundation.

- **Extra Large (24px - 32px):** Applied to Cards, Search Bars, and Modals.
- **Full Round (Pill):** Used for Buttons, Chips, and Input Fields.
- **Visual Consistency:** No sharp corners are permitted; even nested images should carry at least a 12px corner radius.

---

## 7. Key Components
- **Floating Search Bar:** High-elevation, pill-shaped input with a 32px corner radius. Includes a prominent Emerald search icon.
- **Action Buttons:** Pill-shaped (ROUND_FULL) with a minimum height of 48px.
- **Repository Cards:** Minimum 24px corner radius. Metadata displayed in small, pill-shaped chips.
- **Filter Chips:** Pill-shaped. Active chips use a solid Secondary (Blue) fill.
