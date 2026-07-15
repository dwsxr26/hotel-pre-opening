// Shared domain constants.

export const STATUSES = ['Not ordered', 'Order placed', 'Order complete']

export const STATUS_CLASS = {
  'Not ordered': 'st-not',
  'Order placed': 'st-placed',
  'Order complete': 'st-arrived',
}

// Bar-fill / dot colours matching each status: red, yellow, green.
export const STATUS_COLOR = {
  'Not ordered': '#e5484d',
  'Order placed': '#eab308',
  'Order complete': '#30a46c',
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
  'qty', 'unit_price', 'vat_pct', 'unit_incl', 'total', 'budget',
  'order_date', 'est_arrival', 'supplier', 'invoice_no', 'order_no', 'ref', 'files',
]

// Bump when DEFAULT_COLUMN_ORDER changes: on load, any saved view with an older
// version has its saved column order/sizing dropped so users pick up the new
// default (they haven't started using the app, so a reset is harmless).
export const COLUMNS_VERSION = 2
