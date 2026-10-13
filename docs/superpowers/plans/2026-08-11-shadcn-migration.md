# shadcn Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all custom CSS component classes with shadcn-vue components while keeping the rose/pink accent color.

**Architecture:** Strip custom CSS to shadcn base + accent override, then migrate each Vue component to use shadcn imports instead of custom classes.

**Tech Stack:** Vue 3, shadcn-vue, Tailwind CSS v4, reka-ui

## Global Constraints
- Keep rose/pink accent: `oklch(0.586 0.253 17.585)`
- Use existing shadcn-vue components in `src/components/ui/`
- Maintain dark mode support
- Preserve all existing functionality

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/assets/main.css` | Modify | Strip to shadcn base + accent |
| `src/views/Login.vue` | Modify | Replace custom classes |
| `src/views/Register.vue` | Modify | Replace custom classes |
| `src/views/DashBoard.vue` | Modify | Replace custom classes |
| `src/views/Settings.vue` | Modify | Replace custom classes |
| `src/views/Settings/Profile.vue` | Modify | Replace custom classes |
| `src/views/Settings/GroupSettings.vue` | Modify | Replace custom classes |
| `src/components/EventModal.vue` | Modify | Replace custom classes |
| `src/components/Calendar.vue` | Modify | Replace custom classes |

---

### Task 1: Clean CSS file

**Files:**
- Modify: `src/assets/main.css`

**Interfaces:**
- Consumes: None
- Produces: Clean shadcn base with accent override

- [ ] **Step 1: Replace CSS with shadcn base + accent**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@import 'tailwindcss';
@import "tw-animate-css";
@import "shadcn-vue/tailwind.css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --primary: oklch(0.586 0.253 17.585);
  --primary-foreground: oklch(0.985 0 0);
}

@theme inline {
  --font-sans: 'Inter Variable', sans-serif;
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-foreground: var(--foreground);
  --color-background: var(--background);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.645 0.246 16.439);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    @apply font-sans;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

- [ ] **Step 2: Verify build succeeds**

Run: `yarn build`
Expected: No CSS errors

- [ ] **Step 3: Commit**

```bash
git add src/assets/main.css
git commit -m "chore: strip CSS to shadcn base with accent override"
```

---

### Task 2: Migrate Login.vue

**Files:**
- Modify: `src/views/Login.vue`

**Interfaces:**
- Consumes: shadcn Button, Card, Input, Label
- Produces: Login page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/Login.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `<div class="card p-6 sm:p-8">` → `<Card class="p-6 sm:p-8"><CardContent>`
- `<button class="btn-primary w-full">` → `<Button class="w-full">`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`
- Add imports: `import { Button } from '@/components/ui/button'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/Login.vue
git commit -m "feat: migrate Login.vue to shadcn components"
```

---

### Task 3: Migrate Register.vue

**Files:**
- Modify: `src/views/Register.vue`

**Interfaces:**
- Consumes: shadcn Button, Card, Input, Label
- Produces: Register page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/Register.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `<div class="card p-6 sm:p-8">` → `<Card class="p-6 sm:p-8"><CardContent>`
- `<button class="btn-primary w-full">` → `<Button class="w-full">`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`
- Add imports: `import { Button } from '@/components/ui/button'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/Register.vue
git commit -m "feat: migrate Register.vue to shadcn components"
```

---

### Task 4: Migrate DashBoard.vue

**Files:**
- Modify: `src/views/DashBoard.vue`

**Interfaces:**
- Consumes: shadcn Button, Card
- Produces: Dashboard page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/DashBoard.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `class="card ..."` → `<Card class="...">`
- `class="btn-primary w-full"` → `<Button class="w-full">`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`
- Add imports: `import { Button } from '@/components/ui/button'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/DashBoard.vue
git commit -m "feat: migrate DashBoard.vue to shadcn components"
```

---

### Task 5: Migrate Settings.vue

**Files:**
- Modify: `src/views/Settings.vue`

**Interfaces:**
- Consumes: shadcn Card
- Produces: Settings page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/Settings.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `<div class="card ...">` → `<Card class="..."><CardContent>`
- `<div class="list-row ...">` → Keep as minimal custom pattern or use `<div class="flex items-center gap-3 px-4 py-3.5 ...">`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/Settings.vue
git commit -m "feat: migrate Settings.vue to shadcn components"
```

---

### Task 6: Migrate Profile.vue

**Files:**
- Modify: `src/views/Settings/Profile.vue`

**Interfaces:**
- Consumes: shadcn Button, Card, Input, Label
- Produces: Profile page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/Settings/Profile.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `<div class="card ...">` → `<Card class="..."><CardContent>`
- `class="input-base"` → `<Input />`
- `class="btn-primary w-full"` → `<Button class="w-full">`
- `class="btn-secondary w-full"` → `<Button variant="secondary" class="w-full">`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`
- Add imports: `import { Button } from '@/components/ui/button'`
- Add imports: `import { Input } from '@/components/ui/input'`
- Add imports: `import { Label } from '@/components/ui/label'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/Settings/Profile.vue
git commit -m "feat: migrate Profile.vue to shadcn components"
```

---

### Task 7: Migrate GroupSettings.vue

**Files:**
- Modify: `src/views/Settings/GroupSettings.vue`

**Interfaces:**
- Consumes: shadcn Button, Card, AlertDialog
- Produces: GroupSettings page using shadcn components

- [ ] **Step 1: Read current file**

Read `src/views/Settings/GroupSettings.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `class="btn-primary"` → `<Button>`
- `class="btn-primary w-full"` → `<Button class="w-full">`
- `class="btn-danger"` → `<Button variant="destructive">`
- Add imports: `import { Button } from '@/components/ui/button'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/Settings/GroupSettings.vue
git commit -m "feat: migrate GroupSettings.vue to shadcn components"
```

---

### Task 8: Migrate EventModal.vue

**Files:**
- Modify: `src/components/EventModal.vue`

**Interfaces:**
- Consumes: shadcn Button
- Produces: EventModal using shadcn components

- [ ] **Step 1: Read current file**

Read `src/components/EventModal.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `class="btn-primary w-full"` → `<Button class="w-full">`
- `class="btn-danger w-full"` → `<Button variant="destructive" class="w-full">`
- `class="btn-secondary flex-1"` → `<Button variant="secondary" class="flex-1">`
- `class="btn-primary flex-1"` → `<Button class="flex-1">`
- Add imports: `import { Button } from '@/components/ui/button'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/EventModal.vue
git commit -m "feat: migrate EventModal.vue to shadcn components"
```

---

### Task 9: Migrate Calendar.vue

**Files:**
- Modify: `src/components/Calendar.vue`

**Interfaces:**
- Consumes: shadcn Card
- Produces: Calendar using shadcn components

- [ ] **Step 1: Read current file**

Read `src/components/Calendar.vue` to understand current structure.

- [ ] **Step 2: Replace custom classes with shadcn imports**

Replace:
- `<div class="card p-4 ...">` → `<Card class="p-4 ..."><CardContent>`
- Add imports: `import { Card, CardContent } from '@/components/ui/card'`

- [ ] **Step 3: Verify component renders**

Run: `yarn build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/Calendar.vue
git commit -m "feat: migrate Calendar.vue to shadcn components"
```

---

### Task 10: Final verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working application with shadcn components

- [ ] **Step 1: Run full build**

Run: `yarn build`
Expected: No errors

- [ ] **Step 2: Run dev server**

Run: `yarn watch`
Expected: Application starts, pages load correctly

- [ ] **Step 3: Test dark mode toggle**

Navigate to settings, toggle dark mode
Expected: Accent color persists, all components render correctly

- [ ] **Step 4: Commit any fixes**

If any issues found, fix and commit.
