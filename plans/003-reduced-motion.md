# 003 — Add prefers-reduced-motion handling for app motion

- **Status**: TODO
- **Commit**: f9b9975
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, 1 appended block

## Problem

A repo-wide sweep (`prefers-reduced-motion` across `src/`) returns zero
matches: every slide, scale, and keyframe enter/exit in the app plays at
full motion for users who asked the OS for reduced motion. That includes
the shadcn `animate-in` / `animate-out` keyframes (translate + scale +
fade, used by every Dialog/Select/Popover/Drawer via `tw-animate-css`)
and the local Vue transitions (Profile message slide, GroupSettings
expand, login error nudge).

## Target

Append one block at the end of `src/assets/main.css` (after the
`@layer base` block, i.e. after line 128):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Deliberate trade-off, stated so the reviewer doesn't relitigate it: this
collapses the short opacity fades to instant along with the movement,
rather than preserving fades. That is acceptable here because every
entrance in this app pairs opacity with a small (≤8px) slide — there is
no long-distance motion whose comprehension depends on a visible fade,
and content still appears in its final state. No feedback is removed,
only shortened. The loading spinners (`animate-spin`) also freeze to a
static frame under this rule; their adjacent labels ("Creating…",
"Joining…") keep the state indication, so no loading state goes silent.

## Repo conventions to follow

- `src/assets/main.css` is the only global stylesheet and already owns
  cross-cutting concerns (`@custom-variant dark`, `@layer base`); a
  global media query belongs there, not in a component.
- There are no existing media queries and no motion tokens in the repo
  to extend — this block stands alone; do not invent a token file.
- Do not use Tailwind's `motion-reduce:` variant per-site instead: that
  would scatter ~15 call-site edits for the same effect with more drift
  surface.

## Steps

1. Append the exact block from Target above to the end of
   `src/assets/main.css`, after the closing `}` of `@layer base`.
2. Confirm placement: the file must still end with the media query
   block and `yarn build` must pass (Tailwind v4 parses plain CSS media
   queries without issue).

## Boundaries

- Do NOT touch any component file — this plan is main.css only.
- Do NOT change markup/structure.
- Do NOT add new dependencies.
- If the end of main.css doesn't match the `@layer base` block quoted
  in Problem context (drift since commit f9b9975), STOP and report
  instead of improvising.

## Verification

- **Mechanical**: `npx eslint src/assets/main.css` if linted (CSS may
  be lint-exempt — a pass or "no files matched" both count as clean),
  `yarn build` (builds clean).
- **Feel check**: run the UI, open DevTools Rendering panel, enable
  `prefers-reduced-motion: reduce`, and confirm:
  - Opening EventModal (desktop dialog) appears instantly — no slide,
    no scale, no fade ramp.
  - Profile save message appears/disappears instantly.
  - Loading buttons still show their "Creating…" / "Joining…" labels.
  - Disable the emulation and confirm full motion returns (no stuck
    zero-duration state).
- **Done when**: with the emulation on, no translate/scale/fade motion
  is observable on modal open, message show/hide, or expand toggle.
