// Dark-mode categorical palette (fixed hue order, validated for CVD-safe
// adjacency and contrast on a dark surface). A category's color never depends
// on what else appears in the same chart render - filtering never repaints
// the survivors. Categories beyond this primary set fold into the muted
// "other" bucket rather than generating a 7th+/8th+ hue.
export const CATEGORY_COLORS = {
  groceries: '#3987e5', // blue
  transport: '#199e70', // aqua
  shopping: '#c98500', // yellow
  entertainment: '#008300', // green
  utilities: '#9085e9', // violet
  fuel: '#e66767', // red
};

// Muted, not an identity hue - marks "other" as a residual bucket, not a peer category.
export const OTHER_COLOR = '#898781';

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || OTHER_COLOR;
}

// Income/expense is a polarity (good vs. needs-attention), not arbitrary
// identity, so it wears the fixed status pair rather than categorical slots.
export const INCOME_COLOR = '#0ca30c'; // good
export const EXPENSE_COLOR = '#ec835a'; // serious

// Chart chrome shared across dashboard charts.
export const GRID_COLOR = '#33322f';
export const AXIS_TEXT_COLOR = '#94a3b8';
export const TOOLTIP_BG = '#0f172a';
export const TOOLTIP_BORDER = '#334155';
