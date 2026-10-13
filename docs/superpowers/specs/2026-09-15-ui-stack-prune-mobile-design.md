# UI Stack Prune + Mobile Support Design

Date: 2026-09-15
Status: approved, pending implementation plan

## Goal

Trim dead UI code and improve the mobile experience using libraries
already installed. No new packages, no Capacitor, PWA web only.

## Context / findings

- UI deps (`package.json`): `shadcn-vue`, `reka-ui`,
  `class-variance-authority`, `clsx`, `tailwind-merge`,
  `tw-animate-css`, `lucide-vue-next`, `@vueuse/core`. All are
  load-bearing except as noted below.
- `src/lib/comps-ui.js` registers every shadcn component globally
  as `Ui*`.
- Zero usages in app code: `UiSheet*`, `UiDrawer*` (verified via rg).
  Heaviest usage: `UiButton` (104), `UiLabel` (96), `UiCard*` (~150),
  `UiInput` (36), `UiSelect*` (~120), `UiDialog*` (~50).
- Mobile today: `Navigator.vue` already uses
  `env(safe-area-inset-bottom)`; `Calendar.vue` uses custom
  `src/composable/useSwipe.js` (66 lines, 40px threshold);
  `DrawerContent.vue` already supports swipe directions + handle but
  is never rendered.

## Decisions

- Keep `shadcn-vue`. Prune only provably unused code.
- `package.json` does not shrink: `reka-ui`, `cva`, `clsx`,
  `tailwind-merge`, `tw-animate-css` are all still required by
  Dialog/Select/Popover/AlertDialog. The win is dead-code removal
  plus mobile UX, not fewer installs.
- Keep `Drawer/`, delete `Sheet/` (side slide-over, unused, and the
  wrong pattern for phones — bottom sheets cover the need).

## Design

### 1. Prune

- Delete `src/components/ui/sheet/` (7 files).
- Remove its import and 8 registrations from `src/lib/comps-ui.js`.
- Verify: `rg UiSheet` returns zero, `yarn build` passes.

### 2. Adaptive modal (Dialog on desktop, Drawer sheet on mobile)

- New adaptive modal wrapper component: switches on
  `useMediaQuery('(max-width: 640px)')` from `@vueuse/core`.
  Desktop renders `UiDialog*` centered dialog; mobile renders
  `UiDrawer*` bottom sheet with swipe-to-close + handle.
- Same props/slots for both shells so modal internals don't fork.
- Convert: `EventModal`, `BulkSchedule`, `SpinScheduler`,
  `InviteModal`. The Group calendar-integrations dialog is out of scope.
  Only the shell swaps; form logic untouched.

### 3. Gestures

- Replace `src/composable/useSwipe.js` with `usePointerSwipe` from
  `@vueuse/core` (already a dep) in `Calendar.vue` month/grid
  navigation. Pointer-event based (mouse + touch), ~40px threshold
  preserved. One gesture system; delete the custom composable.

### 4. Touch polish

- 44px minimum touch targets on sheet actions and calendar controls.
- `env(safe-area-inset-bottom)` padding on sheet footers (same
  pattern as `Navigator.vue`).
- Keep `overscroll-contain` / `touch-pan-y` discipline so open
  sheets don't trap page scroll.

## Verification

- `yarn build`, eslint on touched files.
- `rg UiSheet` and `rg useSwipe` return zero (except spec).
- Playwright mobile-viewport pass per converted modal + calendar
  swipe navigation.

## Non-goals

- No DaisyUI, no new UI kit, no Capacitor/native shell.
- No visual reskin, no token/theme changes.
- No `package.json` dependency removals.
