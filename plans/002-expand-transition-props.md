# 002 — Narrow GroupSettings expand transition off `all` onto max-height + opacity

- **Status**: TODO
- **Commit**: f9b9975
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 1 file, 1 rule

## Problem

The expand/collapse transition animates `all`, which pulls unintended
properties off-GPU and forces layout + paint + composite on every frame.
Per the audit rulebook, `transition: all` is always a finding — animate
named properties only. The element only ever changes `max-height` and
`opacity`, so those are the only two properties the transition needs.

```css
/* src/views/Settings/GroupSettings.vue:720-725 — current */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}
```

Sibling context (`src/views/Settings/GroupSettings.vue:726-730`,
unchanged by this plan):

```css
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
```

## Target

```css
/* target */
.expand-enter-active,
.expand-leave-active {
  transition: max-height 250ms ease-out, opacity 250ms ease-out;
  max-height: 500px;
  overflow: hidden;
}
```

250ms keeps the expand inside the under-300ms UI budget; `ease-out`
matches the repo's enter/exit convention. `max-height: 500px` and
`overflow: hidden` stay exactly as they are — a content-sized expand has
no transform-only equivalent without JS measuring, so the height
animation itself remains; this plan only stops `all` from dragging every
other property through layout with it.

## Repo conventions to follow

- Component transitions live in scoped `<style>` blocks next to their
  template (this file's `.fade` / `.expand` rules are the established
  pattern) — keep the fix in place; do not extract shared CSS.
- No easing tokens exist in this repo (`src/assets/main.css` holds only
  theme tokens), so the values stay literal; do not invent a token file.
- Exemplar for narrow-property transitions done right — the drawer
  shell animates transform only, never `all`
  (`src/components/ui/drawer/DrawerContent.vue:43-44`):
  ```
  'will-change-transform transform-[translate3d(...)]',
  'transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ...',
  ```

## Steps

1. In `src/views/Settings/GroupSettings.vue:722`, replace
   `transition: all 0.3s ease;` with
   `transition: max-height 250ms ease-out, opacity 250ms ease-out;`.

## Boundaries

- Do NOT touch the `.fade` rules, the `max-height` values, the
  `expand-enter-from` / `expand-leave-to` rules, or the template using
  `name="expand"` (`src/views/Settings/GroupSettings.vue:279`).
- Do NOT change markup/structure — motion properties only.
- Do NOT add new dependencies.
- If the rule doesn't match the code above (drift since commit
  f9b9975), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npx eslint src/views/Settings/GroupSettings.vue`
  (clean), `yarn build` (builds clean).
- **Feel check**: run the UI, open the section wrapped in
  `<transition name="expand">` (GroupSettings line 279), and confirm:
  - Expand and collapse still reach full height / fully closed.
  - Spamming the toggle mid-motion retargets smoothly (transitions
    retarget; keyframes would restart) — never stuck half-open.
  - In DevTools at 10% playback, confirm opacity and height move
    together with no snapping.
- **Done when**: no `transition: all` remains in the file's `<style>`
  block and rapid toggling never sticks.
