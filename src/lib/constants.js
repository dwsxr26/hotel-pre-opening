// Shared domain constants.

export const STATUSES = ['Not ordered', 'Order placed', 'Order arrived', 'Returned']

export const STATUS_CLASS = {
  'Not ordered': 'st-not',
  'Order placed': 'st-placed',
  'Order arrived': 'st-arrived',
  Returned: 'st-returned',
}

// Bar-fill colours matching each status badge dot (from the original mockup).
export const STATUS_COLOR = {
  'Not ordered': '#C0B0A6',
  'Order placed': '#5D7176',
  'Order arrived': '#8fa08b',
  Returned: '#C18D79',
}

// Page-size choices for the orders grid.
export const PAGE_SIZES = [25, 50, 100]

// Column ids that require a confirmation dialog before an edit is committed.
export const CONFIRM_EDIT_COLUMNS = new Set(['package', 'item', 'category', 'unit_price'])

// The two leftmost columns stay pinned when scrolling horizontally.
export const PINNED_COLUMNS = ['package', 'item']

// Default left-to-right column order (used on first load and "Reset columns").
export const DEFAULT_COLUMN_ORDER = [
  'package', 'item', 'category', 'department', 'owner', 'status',
  'qty', 'unit_price', 'total', 'supplier', 'order_no', 'est_arrival', 'ref',
]
