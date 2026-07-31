On/off control for settings toggles (e.g. "Send daily digest email"). An intentional addition — the source only had checkboxes, but a binary setting reads clearer as a switch.

```jsx
<Switch id="digest" label="Daily digest email" checked={enabled} onChange={setEnabled} />
```
