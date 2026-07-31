Web left rail. An intentional addition — the source app has no nav yet ("no global nav exists" per code comments) — built to cover the 9 documented screens: Today, Add, Review, Inventory, Plan, Shopping list, Insights, Catalog, Settings.

```jsx
<Sidebar active="inventory" onNavigate={(key) => router.push(`/${key}`)} />
```
