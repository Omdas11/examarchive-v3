# Stitch UI Design System Implementation Guide

**Project:** ExamArchive v3  
**Design System:** The Digital Curator  
**Implementation Date:** March 20, 2026  
**Status:** Phase 1 - Foundation Components Complete

---

## 📋 Executive Summary

This document provides a step-by-step guide to implementing the Stitch-generated Digital Curator design system into your Next.js React codebase. The conversion focuses on clean TypeScript React components using Tailwind CSS, maintaining your existing project structure.

### What's Been Created

✅ **Layout Components** (Ready to use)
- `MainLayout.tsx` - Main page wrapper with sidebar + header
- `Header.tsx` - Top navigation with search, notifications, profile
- `Sidebar.tsx` - Collapsible sidebar navigation

✅ **Dashboard Components** (Ready to use)
- `DigitalCuratorDashboard.tsx` - Complete example page
- `DashboardCard.tsx` - Reusable stat/content card
- `ActivityLog.tsx` - Timeline activity display
- `RecommendationGrid.tsx` - Suggestion grid with cards

✅ **Configuration**
- Tailwind CSS already configured with all design tokens
- Material Design 3 color system integrated
- Custom utilities (glass, gradients, tonal) ready to use

---

## 🎨 Design System Reference

### Color Palette

The **Digital Curator** uses a sophisticated Material Design 3 palette:

**Primary (Deep Indigo)**
- `primary`: #3525cd
- `primary-container`: #4f46e5
- Use for main actions, focus states, important content

**Secondary (Muted Teal)**
- `secondary`: #006a61
- `secondary-container`: #86f2e4
- Use for success, positive feedback, secondary actions

**Tertiary (Warm Gold)**
- `tertiary`: #684000
- `tertiary-container`: #885500
- Use for pro badges, premium features, accents

**Surface System** (Tonal Layering)
- `surface`: #f8f9ff (base)
- `surface-container-low`: #eff4ff (grouped items)
- `surface-container-highest`: #d3e4fe (interactive elements)
- **Important Rule**: No 1px solid borders for sectioning. Use background color shifts instead.

### Spacing Scale

All spacing uses multiples of `0.5rem` (8px):

```
xs: 0.5rem   (8px)    - Micro spacing
sm: 1rem     (16px)   - Small spacing
md: 1.5rem   (24px)   - Standard spacing
lg: 2rem     (32px)   - Large spacing
xl: 2.5rem   (40px)   - Extra large spacing
2xl: 3rem    (48px)   - Major sections
3xl: 4rem    (64px)   - Large sections
4xl: 6rem    (96px)   - Hero sections
```

### Border Radius

- `sm`: 0.5rem (8px) - Small interactive elements
- `md`: 0.75rem (12px) - Standard containers
- `lg`: 1rem (16px) - Large cards, main containers
- `xl`: 1.5rem (24px) - Hero sections, modals
- `full`: 9999px - Pills, badges

### Typography

All text uses **Inter** font family:

- **Display Large**: 3rem, bold, 1.2 line-height
- **Display Small**: 2rem, bold, 1.4 line-height
- **Headline**: 1.25-1.5rem, semibold, 1.4 line-height
- **Body**: 1rem, regular, 1.6 line-height
- **Label**: 0.75-0.875rem, semibold, 1.5 line-height

### Elevation & Shadows

No heavy shadows! Use tonal layering instead:

```css
/* Stitch Spec: Ambient Shadow (floating elements only) */
box-shadow: 0 10px 30px rgba(11, 28, 48, 0.06);

/* For cards on backgrounds */
box-shadow: 0 2px 8px rgba(11, 28, 48, 0.04);
```

### Glass Morphism (Floating Elements)

For navigation bars, sticky headers, modals:

```css
.glass {
  background: rgba(248, 249, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

---

## 🗂️ File Structure

```
src/
├── components/
│   ├── layout/                    # NEW: Layout components
│   │   ├── MainLayout.tsx        # Main wrapper component
│   │   ├── Header.tsx            # Top navigation
│   │   ├── Sidebar.tsx           # Side navigation
│   │   └── index.ts              # Barrel exports
│   │
│   ├── dashboard/                 # NEW: Dashboard components
│   │   ├── DigitalCuratorDashboard.tsx  # Example page
│   │   ├── DashboardCard.tsx      # Stat/content cards
│   │   ├── ActivityLog.tsx        # Activity timeline
│   │   ├── RecommendationGrid.tsx # Suggestion cards
│   │   └── index.ts              # Barrel exports
│   │
│   ├── (existing components)
│   ├── ToastContext.tsx
│   ├── Footer.tsx
│   └── ...
│
├── app/
│   ├── (existing routes)
│   └── dashboard/
│       └── page.tsx              # USE: DigitalCuratorDashboard
│
└── lib/
    └── utils.ts                  # Ensure cn() utility exists
```

---

## 🚀 Implementation Steps

### Step 1: Verify Tailwind Setup ✅

Your `tailwind.config.ts` already has all necessary theme extensions. Ensure your `globals.css` includes:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 2: Integrate Layout Components

Update your main layout or root page to use `MainLayout`:

```tsx
// app/dashboard/page.tsx
import { DigitalCuratorDashboard } from '@/components/dashboard';

export default function DashboardPage() {
  return <DigitalCuratorDashboard />;
}
```

### Step 3: Update Individual Pages

Each page should be wrapped with `MainLayout`:

```tsx
// app/browse/page.tsx
'use client';

import MainLayout from '@/components/layout/MainLayout';

const SIDEBAR_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { label: 'Browse Papers', icon: 'library_books', href: '/browse' },
  // ... more items
];

export default function BrowsePage() {
  return (
    <MainLayout
      title="Browse Papers"
      sidebarItems={SIDEBAR_ITEMS}
      userRole="user"
    >
      {/* Your page content */}
    </MainLayout>
  );
}
```

### Step 4: Use Dashboard Components

Use `DashboardCard`, `ActivityLog`, and `RecommendationGrid` in your pages:

```tsx
import { DashboardCard, ActivityLog } from '@/components/dashboard';

export default function HomePage() {
  return (
    <MainLayout>
      <div className="p-6 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <DashboardCard
            icon="upload_file"
            title="Papers Uploaded"
            value="24"
            description="+3 this month"
          />
          {/* ... more cards */}
        </div>

        {/* Activity Log */}
        <ActivityLog items={activityData} />
      </div>
    </MainLayout>
  );
}
```

---

## 🎯 Component API Reference

### MainLayout

```tsx
<MainLayout
  title="Page Title"
  breadcrumbs={[
    { label: 'Home', href: '/' },
    { label: 'Current Page' }
  ]}
  showSearch={true}
  userInitials="JD"
  userName="John Doe"
  notifications={5}
  onSearch={(query) => console.log(query)}
  sidebarItems={SIDEBAR_ITEMS}
  userRole="curator"
  hideSidebar={false}
  hideHeader={false}
>
  {children}
</MainLayout>
```

### DashboardCard

```tsx
<DashboardCard
  icon="star"                    // Material Symbol name
  iconBg="primary"              // 'primary' | 'secondary' | 'tertiary' | 'surface'
  title="Scholar Points"
  value={1240}
  description="+120 this week"
  tags={[{ label: 'PRO', variant: 'primary' }]}
  badge="New"
  isHoverable={true}
  onClick={() => navigate('/stats')}
/>
```

### ActivityLog

```tsx
<ActivityLog
  items={[
    {
      id: '1',
      icon: 'check_circle',
      title: 'Paper Verified',
      description: 'Added to Public Archive',
      status: 'success',  // 'success' | 'pending' | 'error' | 'info'
      timestamp: '2 hours ago',
      tags: ['CS 3050'],
    }
  ]}
  title="Recent Activity"
  maxItems={5}
/>
```

### RecommendationGrid

```tsx
<RecommendationGrid
  items={[
    {
      id: '1',
      title: 'NLP Course Materials',
      subtitle: 'University of Oxford Archive',
      category: 'Course',
      tags: ['FE COMP', 'PREP'],
      views: 1200,
      href: '/papers/1',
      isPremium: false,
    }
  ]}
  title="Suggested for You"
  isPro={true}
  columns={2}
/>
```

---

## 🎨 Tailwind Utility Classes

### Pre-configured Utilities

**Gradients**
```tsx
class="gradient-primary"      // Linear gradient primary → primary-container
class="gradient-secondary"    // Linear gradient secondary → secondary-container
```

**Glass Effect**
```tsx
class="glass"      // Surface 80% + 12px blur
class="glass-sm"   // Surface 90% + 8px blur
```

**Tonal Backgrounds**
```tsx
class="tonal-primary"      // bg-primary-fixed, text-on-primary-fixed
class="tonal-secondary"    // bg-secondary-fixed, text-on-secondary-fixed
```

**Borders**
```tsx
class="ghost-border"        // Outline variant at 20% opacity (no-border rule)
class="ghost-border-focus"  // Outline variant at 50% + focus shadow
```

### Spacing Examples

```tsx
<div className="p-6 space-y-md">        {/* 1.5rem */}
  <h1 className="mb-lg">Title</h1>      {/* 2rem margin-bottom */}
  <p className="mt-xl">Content</p>      {/* 2.5rem margin-top */}
</div>
```

---

## 🔄 Migration Path for Existing Pages

### Before (Old UI)
```tsx
<div className="p-4 border border-gray-300 shadow-lg">
  <h2 className="text-2xl">{title}</h2>
  <p className="text-gray-600">{description}</p>
</div>
```

### After (Digital Curator)
```tsx
<DashboardCard
  title={title}
  icon="library_books"
  description={description}
  isHoverable
/>
```

### Key Changes

1. **Remove border-gray** → Use background color shifts
2. **Remove hard shadows** → Use glass effect or ambient shadow
3. **Update colors**:
   - `text-gray-600` → `text-on-surface-variant`
   - `bg-white` → `bg-surface` or `bg-surface-container-lowest`
   - `border-gray-300` → Use background layering instead
4. **Use design tokens**: Reference color system instead of arbitrary colors

---

## ✨ Component Customization Examples

### Custom Card with Icon and Action

```tsx
<DashboardCard
  icon="verified"
  iconBg="secondary"
  title="Verification Status"
  value="98.5%"
  description="Papers verified this month"
  tags={[
    { label: 'EXCELLENT', variant: 'secondary' }
  ]}
  action={
    <button className="w-full p-2 bg-primary-fixed text-primary rounded-lg font-bold">
      View Details
    </button>
  }
/>
```

### Custom Activity Timeline

```tsx
<ActivityLog
  items={userActivities.map(activity => ({
    id: activity.id,
    icon: getIcon(activity.type),
    title: activity.title,
    description: activity.message,
    status: activity.status as 'success' | 'pending' | 'error',
    timestamp: formatTime(activity.createdAt),
    tags: activity.tags,
    actionUrl: `/activity/${activity.id}`,
  }))}
/>
```

---

## 🎯 Next Steps: Phase 2 & Beyond

### Phase 2 (Next)
- [ ] Convert browse/search page
- [ ] Convert upload flow pages
- [ ] Convert profile/settings pages
- [ ] Create form components (inputs, selects, checkboxes)
- [ ] Create modal/dialog components

### Phase 3
- [ ] Convert admin dashboard
- [ ] Create data table components
- [ ] Create chart components
- [ ] Implement dark mode support

### Phase 4
- [ ] Performance optimization
- [ ] Mobile responsiveness refinement
- [ ] Animation polish
- [ ] Accessibility audit

---

## 🐛 Troubleshooting

### Components not showing colors correctly?

Ensure `tailwind.config.ts` includes the color definitions. Run:
```bash
npm run build
```

### Material Symbols not rendering?

Add to your `_app.tsx` or `layout.tsx`:
```tsx
import '@/styles/material-symbols.css';
```

Or add the link to `head` in your HTML:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />
```

### Sidebar not collapsing on mobile?

Update `Sidebar.tsx` to add a mobile toggle button in `MainLayout`:
```tsx
// Add state for mobile sidebar toggle
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
```

---

## 📚 Related Documentation

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Material Design 3 Spec](https://m3.material.io/)
- [Digital Curator Design Guide](./DESIGN_SYSTEM.md)
- [Component Library](./COMPONENTS.md)

---

## 📞 Support & Questions

For issues or questions about the implementation:

1. Check the component examples in `DigitalCuratorDashboard.tsx`
2. Review the design tokens in `tailwind.config.ts`
3. Refer to Material Design 3 guidelines for patterns
4. Check the Stitch designs for visual reference

---

**Last Updated**: March 20, 2026  
**Status**: Ready for Implementation
