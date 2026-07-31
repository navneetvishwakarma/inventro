The primary call-to-action control, used everywhere from "Commit to inventory" to icon-only row actions.

```jsx
<Button variant="primary" size="md" onClick={commit}>Commit to inventory</Button>
<Button variant="outline" size="sm">Skip</Button>
<Button variant="destructive" size="sm">Archive</Button>
<Button variant="ghost" size="icon" icon={<TrashIcon/>} />
```

Variants: `primary` (red-600 fill — AA-safe over the brand red), `secondary` (gold fill, dark text), `tertiary` (text-only, blue), `outline` (bordered neutral), `ghost` (no border/fill until hover), `destructive` (subtle red wash, for archive/delete). Sizes `sm`/`md`/`lg`/`icon`. Pass `loading` to swap the label for a spinner without changing button width; `disabled` dims to 50% opacity.
