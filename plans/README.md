# Animation plans

Vetted findings from the 2026-09-15 motion audit (improve-animations).
Commit stamp for all plans: `f9b9975`.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 1 | [001-profile-leave-easing](001-profile-leave-easing.md) — ease-in → ease-out on Profile message leave | MEDIUM | DONE (694cef6) |
| 2 | [002-expand-transition-props](002-expand-transition-props.md) — expand off `transition: all` onto max-height + opacity | MEDIUM | DONE (694cef6) |
| 3 | [003-reduced-motion](003-reduced-motion.md) — global prefers-reduced-motion block | MEDIUM | DONE (694cef6) |

## Recommended execution order

001 → 002 → 003. All three are independent (different files, no shared
code); any order works, but 001 and 002 are one-line feel wins while 003
is the accessibility gate.

## Dependencies

None between plans. 003 touches only `src/assets/main.css`; 001 and 002
touch only their component files.

## Deferred (audited, not planned)

- `transition-all` sprawl (~12 sites) — narrow per site as follow-ups.
- Bare `ease` 300ms fades — ease-out 200ms, same treatment.
- Missed opportunities: directional month-slide on calendar swipe;
  fade/stagger on list updates.
