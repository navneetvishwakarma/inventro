Single-line text field with label, helper text, and error state built in.

```jsx
<Input label="Household name" placeholder="e.g. The Sharmas" />
<Input label="Monthly budget" type="number" error="Enter a positive number" />
```

Focus ring uses `--ring-focus`; error state swaps the border and ring to `--color-error` and shows `error` text instead of `helperText`.
