// Shared domain constants.

export const STATUSES = ['Not ordered', 'Order placed', 'Order arrived', 'Returned']

export const STATUS_CLASS = {
  'Not ordered': 'st-not',
  'Order placed': 'st-placed',
  'Order arrived': 'st-arrived',
  Returned: 'st-returned',
}

// Bar-fill / dot colours matching each status: red, yellow, green, blue.
export const STATUS_COLOR = {
  'Not ordered': '#e5484d',
  'Order placed': '#eab308',
  'Order arrived': '#30a46c',
  Returned: '#3b82f6',
}

// Page-size choices for the orders grid.
export const PAGE_SIZES = [25, 50, 100]

// Columns offered as multi-select filters in the Orders filter bar.
export const FILTER_COLUMNS = [
  ['package', 'Package'],
  ['category', 'Category'],
  ['department', 'Department'],
  ['owner', 'Owner'],
  ['status', 'Status'],
  ['supplier', 'Supplier'],
]

// Column ids that require a confirmation dialog before an edit is committed.
export const CONFIRM_EDIT_COLUMNS = new Set(['package', 'item', 'category', 'unit_price'])

// The two leftmost columns stay pinned when scrolling horizontally.
export const PINNED_COLUMNS = ['package', 'item']

// Default left-to-right column order (used on first load and "Reset columns").
export const DEFAULT_COLUMN_ORDER = [
  'package', 'item', 'category', 'department', 'owner', 'status',
  'qty', 'unit_price', 'total', 'supplier', 'order_date', 'invoice_no', 'order_no', 'est_arrival', 'ref',
]
