Tabular data for Insights (top spend items, price history) on web. `TableRowMobile` is the collapsed equivalent — one stacked row per record instead of columns — for the same data on phone widths.

```jsx
<Table columns={[{key:'name',header:'Item'},{key:'spend',header:'Spend',numeric:true,align:'right'}]} rows={items} />
<TableRowMobile primary="Basmati rice" secondary="₹640.00" meta="Trailing 90 days" />
```
