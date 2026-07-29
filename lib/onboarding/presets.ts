export type ShoppingPreset = {
  id: string;
  label: string;
  categorySlugs: string[];
};

// Maps "how you shop" presets onto the top-level category slugs seeded in
// S-02. Selecting a preset flips is_staple = true on every catalog_item in
// its mapped categories (working spec F1 — "seeds is_staple flags... silently
// underneath", no jargon exposed in the wizard copy itself).
export const SHOPPING_PRESETS: ShoppingPreset[] = [
  { id: 'weekly-grocery-run', label: 'Weekly grocery run', categorySlugs: ['groceries-staples', 'fresh', 'dairy-eggs', 'bakery-breakfast'] },
  { id: 'daily-milk-dairy', label: 'Daily milk & dairy', categorySlugs: ['dairy-eggs'] },
  { id: 'monthly-bulk-staples', label: 'Monthly bulk staples', categorySlugs: ['groceries-staples', 'utilities-refills'] },
  { id: 'household-personal-care', label: 'Household & personal care restock', categorySlugs: ['home-care', 'personal-care'] },
  { id: 'snacks-beverages', label: 'Snacks & beverages top-ups', categorySlugs: ['snacks-confectionery', 'beverages'] },
  { id: 'baby-health', label: 'Baby & health essentials', categorySlugs: ['baby-kids', 'health'] },
];
