# UI Stack Prune + Mobile Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the unused Sheet component, serve all four modals as swipeable bottom sheets on phones via the existing Drawer, replace the custom swipe composable with VueUse, and polish touch targets — with no new dependencies.

**Architecture:** Prune first (pure deletion), then add one adaptive shell component that picks Dialog vs Drawer at the 640px breakpoint, then migrate the four modals onto it, then swap the gesture engine, then verify on a mobile viewport.

**Tech Stack:** Vue 3, shadcn-vue (reka-ui Drawer/Dialog), `@vueuse/core` `useMediaQuery` + `usePointerSwipe`, Tailwind 4.1, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-15-ui-stack-prune-mobile-design.md`

## Global Constraints

- No new packages; no `package.json` changes at all.
- No Capacitor/native shell; PWA mobile web only.
- No visual reskin and no token/theme changes.
- One commit per task, no push.
- E2E runs need the Docker stack up plus the preview server (`yarn build && yarn preview`, baseURL `http://localhost:4173`); if the stack is unavailable, `yarn build` + eslint are the gate (same as last session).

---

## File Structure

- Delete: `src/components/ui/sheet/` (entire directory, 7 files, zero usages).
- Modify: `src/lib/comps-ui.js` (remove Sheet import + 8 registrations).
- Create: `src/components/AdaptiveModal.vue` (Dialog on desktop / Drawer bottom sheet on mobile, same `open` prop + `update:open` event as both shells).
- Modify: `src/components/EventModal.vue`, `src/components/BulkSchedule.vue`, `src/components/SpinScheduler.vue`, `src/components/InviteModal.vue` (shell swap only, internals untouched).
- Modify: `src/components/Calendar.vue` (use `usePointerSwipe` instead of `useSwipe`).
- Delete: `src/composable/useSwipe.js`.
- Create: `e2e/mobile-sheets.spec.js` (one regression spec: EventModal opens as a bottom sheet on a 390px viewport).

---

### Task 1: Prune the unused Sheet component

**Files:**
- Delete: `src/components/ui/sheet/` (whole directory)
- Modify: `src/lib/comps-ui.js:71-80` (Sheet import block), `src/lib/comps-ui.js:143-150` (Sheet registrations)

**Interfaces:**
- Consumes: nothing.
- Produces: `UiSheet*` globals no longer exist; verified zero usages so no consumer breaks.

- [ ] **Step 1: Confirm zero usages before deleting**

Run: `rg 'UiSheet|ui/sheet' src --no-filename | wc -l`
Expected: `0`

- [ ] **Step 2: Delete the directory**

```bash
git rm -r src/components/ui/sheet
```

- [ ] **Step 3: Unregister from comps-ui.js**

Remove this import block:

```js
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
```

Remove these registration lines:

```js
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
```

- [ ] **Step 4: Verify deletion is clean**

Run: `rg 'UiSheet|ui/sheet' src --no-filename | wc -l`
Expected: `0`

Run: `npx eslint src/lib/comps-ui.js`
Expected: no errors.

Run: `yarn build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove unused Sheet ui component"
```

---

### Task 2: Create the AdaptiveModal wrapper

**Files:**
- Create: `src/components/AdaptiveModal.vue`
- Test: `yarn build` + eslint (no unit framework in repo; visual check via Task 6 e2e)

**Interfaces:**
- Consumes: globally registered `UiDialog*` / `UiDrawer*` (from `src/lib/comps-ui.js`), `useMediaQuery` from `@vueuse/core`.
- Produces: `AdaptiveModal` with props `{ open: Boolean, dialogClass: String }`, event `update:open`, slots `title`, default, `footer`. Task 3 consumes exactly this interface.

- [ ] **Step 1: Write the component**

```vue
<script setup>
import { useMediaQuery } from '@vueuse/core'

defineProps({
  open: { type: Boolean, default: false },
  dialogClass: { type: String, default: '' },
})

defineEmits(['update:open'])

const isMobile = useMediaQuery('(max-width: 640px)')
</script>

<template>
  <UiDrawer
    v-if="isMobile"
    :open="open"
    swipe-direction="down"
    @update:open="$emit('update:open', $event)"
  >
    <UiDrawerContent class="max-h-[90vh]">
      <UiDrawerHeader v-if="$slots.title">
        <UiDrawerTitle><slot name="title" /></UiDrawerTitle>
      </UiDrawerHeader>
      <div
        class="overflow-y-auto overscroll-contain"
        :style="{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }"
      >
        <slot />
      </div>
      <UiDrawerFooter v-if="$slots.footer">
        <slot name="footer" />
      </UiDrawerFooter>
    </UiDrawerContent>
  </UiDrawer>
  <UiDialog v-else :open="open" @update:open="$emit('update:open', $event)">
    <UiDialogContent :class="dialogClass">
      <UiDialogHeader v-if="$slots.title">
        <UiDialogTitle><slot name="title" /></UiDialogTitle>
      </UiDialogHeader>
      <slot />
      <UiDialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>
```

Notes for the implementer:
- `swipe-direction="down"` is required: `DrawerContent.vue` keys its bottom-sheet positioning off `data-[swipe-direction=down]`; without it the sheet has no placement.
- `UiDrawerTitle`/`UiDialogTitle` always wrap the title slot (reka-ui logs an a11y warning for title-less overlays).
- Safe-area padding and `overscroll-contain` live in the wrapper so every modal gets them for free.
- Known limitation: resizing across 640px while a modal is open remounts the shell; state survives via the `open` prop. Acceptable, do not handle.

- [ ] **Step 2: Lint and build**

Run: `npx eslint src/components/AdaptiveModal.vue`
Expected: no errors.

Run: `yarn build`
Expected: builds clean (unused-import warnings for `Ui*` globals must not appear — they are global components, no import needed, matching how `EventModal.vue` uses them today).

- [ ] **Step 3: Commit**

```bash
git add src/components/AdaptiveModal.vue
git commit -m "feat: add AdaptiveModal dialog-on-desktop drawer-sheet-on-mobile wrapper"
```

---

### Task 3: Convert the four modals onto AdaptiveModal

**Files:**
- Modify: `src/components/EventModal.vue:2-6` (shell tags)
- Modify: `src/components/BulkSchedule.vue:2-6` (shell tags)
- Modify: `src/components/SpinScheduler.vue:2-3` (shell tags)
- Modify: `src/components/InviteModal.vue:2-6` (shell tags)

**Interfaces:**
- Consumes: `AdaptiveModal` from Task 2 (props `open`/`dialogClass`, event `update:open`, slots `title`/default/`footer`).
- Produces: four modals with identical props/events to their parents; only the shell tags change.

Pattern for every modal (example: EventModal, currently `<UiDialog :open="visible" @update:open="$emit('close')">` + `<UiDialogContent class="sm:max-w-lg">` + `<UiDialogHeader><UiDialogTitle>…`):

```vue
<AdaptiveModal :open="visible" dialog-class="sm:max-w-lg" @update:open="$emit('close')">
  <template #title>{{ event ? 'Edit Event' : 'Add New Event' }}</template>
  <form @submit.prevent="saveEvent" class="space-y-5">
    <!-- everything between UiDialogHeader and UiDialogContent close tag, unchanged -->
  </form>
</AdaptiveModal>
```

Rules: keep each modal's existing open-prop expression (`visible`, `showModal`, `modelValue` — do not rename); move the old `UiDialogContent` class to `dialog-class`; move the old `UiDialogTitle` contents into `#title`; move `UiDialogFooter` contents into `#footer` if present; delete nothing else. `SpinScheduler.vue` keeps its `:open="modelValue"` / `@update:open="$emit('update:modelValue', false)` pair verbatim, only the tag names change. Import `AdaptiveModal` with a relative import (`import AdaptiveModal from './AdaptiveModal.vue'`) since it is a local component, not a `Ui*` global.

- [ ] **Step 1: Convert EventModal.vue**
- [ ] **Step 2: Convert BulkSchedule.vue**
- [ ] **Step 3: Convert SpinScheduler.vue**
- [ ] **Step 4: Convert InviteModal.vue**
- [ ] **Step 5: Verify no Dialog shells remain in modals**

Run: `rg 'UiDialog' src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue --no-filename | wc -l`
Expected: `0` (inner `UiSelect`/`UiInput` etc. are untouched; only the shell tags were Dialog).

Run: `npx eslint src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue src/components/AdaptiveModal.vue`
Expected: no errors.

Run: `yarn build`
Expected: builds clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue
git commit -m "feat: serve modals as bottom sheets on mobile via AdaptiveModal"
```

---

### Task 4: Replace custom useSwipe with VueUse usePointerSwipe

**Files:**
- Modify: `src/components/Calendar.vue:310` (import), `src/components/Calendar.vue:643-651` (swipe wiring)
- Delete: `src/composable/useSwipe.js`

**Interfaces:**
- Consumes: `usePointerSwipe` from `@vueuse/core` 14.4.0 (verified present in `node_modules/@vueuse/core/dist/index.js`), target `calendarEl` template ref already in `Calendar.vue`.
- Produces: identical behavior (left → `next()`, right → `prev()`, 40px threshold), touch-only as before.

- [ ] **Step 1: Swap the import**

Replace:

```js
import { useSwipe } from '@/composable/useSwipe'
```

with:

```js
import { usePointerSwipe } from '@vueuse/core'
```

- [ ] **Step 2: Swap the wiring**

Replace:

```js
// ── Touch swipe navigation ───────────────────────────────
const { attachSwipe } = useSwipe({
  onLeft: () => next(),
  onRight: () => prev(),
})

onMounted(() => {
  if (calendarEl.value) attachSwipe(calendarEl.value)
})
```

with:

```js
// ── Touch swipe navigation ───────────────────────────────
usePointerSwipe(calendarEl, {
  threshold: 40,
  pointerTypes: ['touch'],
  onSwipeEnd(e, direction) {
    if (direction === 'left') next()
    else if (direction === 'right') prev()
  },
})
```

Notes: `pointerTypes: ['touch']` preserves the old touch-only behavior — VueUse defaults to mouse+touch+pen, and mouse-drag advancing the month would be a behavior change. `calendarEl` is passed as the ref itself; VueUse watches it internally, so the `onMounted`/`attachSwipe` dance goes away. If `onMounted` has no other uses left in `Calendar.vue`, remove it from the `vue` import; otherwise leave the import alone.

- [ ] **Step 3: Delete the custom composable**

```bash
git rm src/composable/useSwipe.js
```

- [ ] **Step 4: Verify**

Run: `rg 'useSwipe[^P]|attachSwipe|composable/useSwipe' src --no-filename | wc -l`
Expected: `0` (the `usePointerSwipe` matches are excluded by the `[^P]` guard; confirm any hits are `usePointerSwipe` only).

Run: `npx eslint src/components/Calendar.vue`
Expected: no errors.

Run: `yarn build`
Expected: builds clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: replace custom useSwipe with VueUse usePointerSwipe"
```

---

### Task 5: Touch-target polish on converted modals

**Files:**
- Modify: whichever of the four Task 3 modals have action buttons shorter than 44px.

**Interfaces:**
- Consumes: converted modals from Task 3.
- Produces: all sheet primary actions meet a 44px minimum touch target.

- [ ] **Step 1: Audit action buttons**

Run: `rg -n 'UiButton|<button' src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue`
Expected: a list of button lines to inspect.

- [ ] **Step 2: Add minimum height where missing**

For each action button without an existing height class, add `min-h-[44px]`, e.g.:

```vue
<UiButton type="submit" class="min-h-[44px]">Save Event</UiButton>
```

Do not touch buttons that already size themselves (e.g. `SpinScheduler.vue` controls already using `min-h-[44px]`). Safe-area and scroll containment are already handled wrapper-level in `AdaptiveModal.vue` — do not duplicate per modal.

- [ ] **Step 3: Verify**

Run: `npx eslint src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue`
Expected: no errors.

Run: `yarn build`
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/EventModal.vue src/components/BulkSchedule.vue src/components/SpinScheduler.vue src/components/InviteModal.vue
git commit -m "fix: ensure 44px touch targets on modal actions"
```

---

### Task 6: Mobile-viewport regression spec + full verification

**Files:**
- Create: `e2e/mobile-sheets.spec.js`
- Test: `yarn e2e e2e/mobile-sheets.spec.js` (needs Docker stack + `yarn preview` on :4173)

**Interfaces:**
- Consumes: converted `EventModal` (Task 3), existing `e2e/single-origin.spec.js` register flow as the login pattern.
- Produces: a committed regression spec — justified as forever-behavior (modal shell contract), kept to one small file per repo test-hygiene rules.

- [ ] **Step 1: Find the add-event trigger**

Read `src/components/Home/Navigator.vue` (mobile FAB) and `src/views/Group.vue:352` (FAB listener comment) to get the exact button label/test-id that opens `EventModal`.

- [ ] **Step 2: Write the spec**

```js
import { expect, test } from '@playwright/test'

test('event modal opens as a bottom sheet on a mobile viewport', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/register')

  await page.getByLabel('Full Name').fill('Sheet E2E User')
  await page.getByLabel('Email').fill(`sheet-e2e-${unique}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123!')
  await page.getByLabel('Confirm Password').fill('Test-password-123!')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  // <trigger from Step 1, e.g. FAB>: open EventModal here, then:
  const sheet = page.locator('[data-slot="drawer-content"]')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByText('Add New Event')).toBeVisible()
})
```

Replace the placeholder comment with the real trigger click from Step 1 (exact role/name from the files read). Desktop behavior (Dialog, no `drawer-content`) is covered implicitly: the same modal at default viewport must NOT match `drawer-content` — assert that too with a second viewport block if cheap.

- [ ] **Step 3: Run the full gate**

Run: `yarn build`
Expected: builds clean.

Run: `npx eslint src/ e2e/mobile-sheets.spec.js`
Expected: no errors.

Run: `yarn e2e e2e/mobile-sheets.spec.js` (stack + preview running)
Expected: PASS. If the Docker stack is unavailable, record the skip (same precedent as last session) — build + eslint are the gate.

- [ ] **Step 4: Commit**

```bash
git add e2e/mobile-sheets.spec.js
git commit -m "test: cover mobile bottom-sheet modal shell"
```

---

## Self-Review

**1. Spec coverage.** Prune → Task 1 (Sheet deletion; Drawer kept per spec). Adaptive modal → Tasks 2+3 (four named modals; calendar-integrations dialog excluded per spec). Gestures → Task 4 (VueUse swap, custom file deleted, 40px threshold kept). Touch polish → Task 5 (44px audit; safe-area/overscroll live in the Task 2 wrapper). Verify → Task 6 (build, eslint, rg-zero checks, Playwright mobile pass). No spec section lacks a task.

**2. Placeholder scan.** No TBD/TODO; every command and code block is complete. The single open item (exact FAB trigger selector) is resolved by an explicit Step 1 read before the spec is written.

**3. Type consistency.** `AdaptiveModal` interface (`open: Boolean`, `dialogClass: String`, `update:open`, slots `title`/default/`footer`) is defined once in Task 2 and referenced identically in Tasks 3 and 6. `usePointerSwipe(calendarEl, { threshold: 40, pointerTypes: ['touch'], onSwipeEnd })` matches the verified `UsePointerSwipeOptions` signature in installed `@vueuse/core` 14.4.0. `swipe-direction="down"` matches the `Drawer.vue` prop and the `data-[swipe-direction=down]` selectors in `DrawerContent.vue`.
