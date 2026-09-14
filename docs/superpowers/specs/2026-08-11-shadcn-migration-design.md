# shadcn Migration Design

## Overview
Replace all custom CSS component classes with shadcn-vue components while keeping the rose/pink accent color as the primary theme color.

## Accent Color
- **Primary**: `oklch(0.586 0.253 17.585)` (rose-600 equivalent)
- **Hover**: `#be123c`
- **Active**: `#9f1239`
- **Light**: `#fff1f2`

## What Gets Removed

### Custom CSS Classes
| Class | Replacement |
|-------|-------------|
| `.btn-primary` | shadcn `Button` with `default` variant |
| `.btn-secondary` | shadcn `Button` with `secondary` variant |
| `.btn-danger` | shadcn `Button` with `destructive` variant |
| `.card` | shadcn `Card` component |
| `.input-base` | shadcn `Input` component |
| `.list-row` | Minimal custom pattern or shadcn list |
| `.section-label` | shadcn `Badge` or utility classes |
| `.row-icon` | Keep as minimal utility |

### CSS Variables to Remove
- `--radius-*` (shadcn handles via `--radius`)
- `--shadow-*` (shadcn handles via component styles)
- `--ease-*`, `--duration-*` (shadcn provides animation tokens)
- `--nav-h`, `--sidebar-w`, `--sidebar-collapsed` (move to component-specific)

## What Stays

### shadcn Base
- All shadcn CSS variables (`--background`, `--foreground`, `--card`, etc.)
- `@theme inline` block
- Dark mode `.dark` overrides

### Accent Override
```css
:root {
  --primary: oklch(0.586 0.253 17.585);
  --primary-foreground: oklch(0.985 0 0);
}
```

## Component Mapping

### Buttons
```vue
<!-- Before -->
<button class="btn-primary">Save</button>

<!-- After -->
<Button>Save</Button>
```

### Cards
```vue
<!-- Before -->
<div class="card">...</div>

<!-- After -->
<Card>
  <CardContent>...</CardContent>
</Card>
```

### Inputs
```vue
<!-- Before -->
<input class="input-base" />

<!-- After -->
<Input />
```

## Files to Modify
1. `src/assets/main.css` - strip to shadcn base + accent
2. Vue components using custom classes - swap to shadcn imports
3. `components.json` - ensure proper shadcn config

## Testing
- Verify all components render correctly
- Test dark mode toggle
- Check accent color persists
- Validate responsive behavior
