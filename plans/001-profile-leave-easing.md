# 001 — Swap Profile message leave easing from ease-in to ease-out

- **Status**: TODO
- **Commit**: f9b9975
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 line

## Problem

The profile save-message exit uses `ease-in`, which starts slow and delays
the exact moment the user is watching. Per the audit rulebook, `ease-in`
on UI is always a finding; entering or exiting elements use `ease-out`.

```vue
<!-- src/views/Settings/Profile.vue:19 — current -->
leave-active-class="transition duration-200 ease-in"
```

Full transition block for context (`src/views/Settings/Profile.vue:15-22`):

```vue
<transition
  enter-active-class="transition duration-300 ease-out"
  enter-from-class="opacity-0 -translate-y-2"
  enter-to-class="opacity-100 translate-y-0"
  leave-active-class="transition duration-200 ease-in"
  leave-from-class="opacity-100"
  leave-to-class="opacity-0"
>
```

## Target

```vue
<!-- target — one word changes -->
leave-active-class="transition duration-200 ease-out"
```

Duration stays 200ms (inside the under-300ms UI budget). Nothing else in
the block changes.

## Repo conventions to follow

- Motion on Vue transitions is declared inline via Tailwind
  `*-active-class` props — no easing tokens exist in this repo
  (`src/assets/main.css` holds only theme tokens), so the fix stays
  inline; do not invent a token file.
- Exemplar — the login error transition already does this correctly
  (`src/views/Login.vue:4-8`):
  ```vue
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
  >
  ```

## Steps

1. In `src/views/Settings/Profile.vue:19`, replace
   `leave-active-class="transition duration-200 ease-in"` with
   `leave-active-class="transition duration-200 ease-out"`.

## Boundaries

- Do NOT touch the enter classes, the message markup, or any other
  transition in the file.
- Do NOT add new dependencies.
- If line 19 doesn't match the code above (drift since commit
  f9b9975), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npx eslint src/views/Settings/Profile.vue` (clean),
  `yarn build` (builds clean).
- **Feel check**: run the UI, open Edit Profile, trigger a save success
  (and an error) message, let each dismiss, and confirm:
  - The message starts fading immediately on dismiss — no sluggish tail.
  - In DevTools, set playback to 10% (Animations panel) and confirm the
    opacity ramp starts fast.
- **Done when**: no `ease-in` remains in Profile.vue and the dismiss
  feels instant.
