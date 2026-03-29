#!/bin/bash
# ExamArchive v3 - Stitch UI Implementation Checklist
# Copy this checklist and track your progress as you implement

## 📋 PRE-IMPLEMENTATION
- [ ] Read STITCH_SUMMARY.md (overview)
- [ ] Read STITCH_QUICK_START.md (3 step guide)
- [ ] Review DESIGN_TOKENS_REFERENCE.ts (get familiar with tokens)
- [ ] Backup your current /src/app/dashboard/page.tsx
- [ ] Review tailwind.config.ts (already configured ✓)

## 🔧 STEP 1: SETUP (30 minutes)
- [ ] Verify all component files exist:
  - [ ] src/components/layout/MainLayout.tsx
  - [ ] src/components/layout/Header.tsx
  - [ ] src/components/layout/Sidebar.tsx
  - [ ] src/components/layout/index.ts
  - [ ] src/components/dashboard/DigitalCuratorDashboard.tsx
  - [ ] src/components/dashboard/DashboardCard.tsx
  - [ ] src/components/dashboard/ActivityLog.tsx
  - [ ] src/components/dashboard/RecommendationGrid.tsx
  - [ ] src/components/dashboard/BrowsePageExample.tsx
  - [ ] src/components/dashboard/index.ts
- [ ] Verify documentation files exist:
  - [ ] STITCH_SUMMARY.md
  - [ ] STITCH_QUICK_START.md
  - [ ] STITCH_IMPLEMENTATION_GUIDE.md
  - [ ] src/styles/DESIGN_TOKENS_REFERENCE.ts
- [ ] Verify Tailwind config has Material Symbols font imports
- [ ] Test build: `npm run build`

## 📱 STEP 2: TEST MAIN LAYOUT (1 hour)
- [ ] Create a test page: app/dashboard/page.tsx
- [ ] Import MainLayout:
  ```tsx
  import MainLayout from '@/components/layout/MainLayout';
  ```
- [ ] Create SIDEBAR_ITEMS array with your navigation
- [ ] Wrap test content with MainLayout
- [ ] Test locally: `npm run dev`
- [ ] Verify:
  - [ ] Sidebar renders and is collapsible
  - [ ] Header shows search bar
  - [ ] Profile button works
  - [ ] Navigation items appear
  - [ ] Colors match design system
  - [ ] No console errors

## 🎨 STEP 3: INTEGRATE DASHBOARD COMPONENTS (30 minutes)
- [ ] Export DigitalCuratorDashboard if using directly:
  ```tsx
  import DigitalCuratorDashboard from '@/components/dashboard/DigitalCuratorDashboard';
  export default DigitalCuratorDashboard;
  ```
- [ ] OR build your own using:
  - [ ] DashboardCard for stats
  - [ ] ActivityLog for activity feed
  - [ ] RecommendationGrid for suggestions
- [ ] Test each component independently
- [ ] Verify responsive layout (test on mobile viewport)
- [ ] Check all colors are correct (compare with Stitch designs)

## 🏠 STEP 4: UPDATE OTHER PAGES (2-3 hours)
- [ ] /browse page:
  - [ ] Wrap with MainLayout
  - [ ] Add Sidebar items
  - [ ] Reference BrowsePageExample.tsx for pattern
  - [ ] Test filtering/sorting works
  - [ ] Verify responsive grid
- [ ] /profile page:
  - [ ] Wrap with MainLayout
  - [ ] Use DashboardCard for profile stats
  - [ ] Test form inputs (next phase)
- [ ] /settings page:
  - [ ] Wrap with MainLayout
  - [ ] Add setting groups using cards
  - [ ] Test layout

## ✨ STEP 5: CUSTOM STYLING (1 hour each page)
For each updated page:
- [ ] Review against Stitch design
- [ ] Adjust spacing (use p-md, gap-lg, etc.)
- [ ] Verify colors match (use design tokens, not arbitrary)
- [ ] Check border-radius consistency (use rounded-lg)
- [ ] Test hover/active states
- [ ] Verify shadows (use shadow-ambient or shadow-lift only)
- [ ] NO 1px borders! Use background layering instead

## 📱 STEP 6: RESPONSIVE TESTING (30 minutes)
For each updated page:
- [ ] Mobile (390px):
  - [ ] Sidebar accessible or hidden
  - [ ] Text readable
  - [ ] Buttons tappable (44px min)
  - [ ] Grid stacks to 1 column
  - [ ] No horizontal scroll
- [ ] Tablet (768px):
  - [ ] Sidebar visible
  - [ ] 2-column grid where appropriate
  - [ ] Proper spacing
- [ ] Desktop (1024px+):
  - [ ] Full layout
  - [ ] Multi-column grid
  - [ ] Optimal spacing

## 🧪 STEP 7: QUALITY ASSURANCE (1 hour)
- [ ] Visual QA:
  - [ ] Colors match Stitch designs
  - [ ] Spacing is consistent
  - [ ] Typography looks right
  - [ ] Icons render properly
- [ ] Functional QA:
  - [ ] Links work
  - [ ] Buttons clickable
  - [ ] Forms functional
  - [ ] No console errors/warnings
- [ ] Performance:
  - [ ] Page loads quickly
  - [ ] No layout shift
  - [ ] Images optimized
- [ ] Accessibility:
  - [ ] Keyboard navigation works
  - [ ] Color contrast adequate
  - [ ] ARIA labels present
  - [ ] Focus states visible

## 📖 STEP 8: DOCUMENTATION (30 minutes)
- [ ] Document any custom components you created
- [ ] Record Sidebar items in your app
- [ ] Note any design system deviations
- [ ] Add a comment in MainLayout indicating project version
- [ ] Update README.md if needed

## 🚀 STEP 9: DEPLOYMENT (30 minutes)
- [ ] Final build: `npm run build`
- [ ] Check for errors
- [ ] Test in staging/preview environment
- [ ] Get stakeholder approval
- [ ] Deploy to production
- [ ] Monitor for issues

## 🎉 COMPLETION CHECKLIST
- [ ] All pages updated to use MainLayout
- [ ] Design tokens used throughout (no arbitrary colors)
- [ ] Responsive on mobile/tablet/desktop
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Team trained on new system

## 📝 COMMON TASKS DURING IMPLEMENTATION

### Need to add a new navigation item?
1. Update SIDEBAR_ITEMS array
2. Add icon name (Material Symbol)
3. Provide href path
4. Optional: add roles for filtering

### Need to customize a card?
1. Check DashboardCard.tsx props
2. Use icon, iconBg, title, value, description
3. Add tags if needed
4. Provide onClick handler if needed

### Need to add a new color?
1. Check DESIGN_TOKENS_REFERENCE.ts for existing tokens
2. Use those tokens (don't add new colors)
3. If truly needed, update tailwind.config.ts

### Need better spacing?
1. Reference DESIGN_TOKENS_REFERENCE.ts spacing section
2. Use p-md, gap-lg, etc. (not arbitrary values)
3. Maintain consistent rhythm

### Need to style a button?
1. Use gradient-primary for primary action
2. Use bg-surface-container for secondary
3. Always add hover state
4. Use rounded-lg for consistency

## ⏰ TIME ESTIMATES

| Task | Time |
|------|------|
| Pre-implementation review | 30 min |
| Step 1: Setup | 30 min |
| Step 2: Test MainLayout | 60 min |
| Step 3: Dashboard components | 30 min |
| Step 4: Update other pages | 120-180 min |
| Step 5: Custom styling | 60 min |
| Step 6: Responsive testing | 30 min |
| Step 7: QA | 60 min |
| Step 8: Documentation | 30 min |
| Step 9: Deployment | 30 min |
| **TOTAL** | **6-7 hours** |

## 🆘 TROUBLESHOOTING REFERENCE

| Issue | Solution |
|-------|----------|
| Colors not applying | `npm run build` to regenerate CSS |
| Material Symbols not showing | Add font import to layout.tsx |
| Sidebar not collapsing | Check browser dev tools for console errors |
| Components not found | Verify file paths are correct |
| Spacing looks off | Check you're using p-md, gap-lg, etc. (not px values) |
| Border appears (shouldn't) | Remove border class, use bg-container instead |
| Tailwind classes not recognized | Ensure `content` in tailwind.config.ts includes your component paths |

## 🎓 LEARNING RESOURCES

- Material Design 3: https://m3.material.io/
- Tailwind CSS: https://tailwindcss.com/docs
- This System: Check STITCH_IMPLEMENTATION_GUIDE.md
- Examples: Look at DigitalCuratorDashboard.tsx and BrowsePageExample.tsx

## ✅ Sign-Off

**Project**: ExamArchive v3  
**Implementation Date**: ___________  
**Lead Developer**: ___________  
**Review Date**: ___________  

---

**Keep this checklist! Reference it as you implement each page.**
