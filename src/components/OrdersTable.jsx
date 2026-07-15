import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight,
  Download, GripVertical, Minus, Plus, RotateCcw,
} from 'lucide-react'
import { DEFAULT_COLUMN_ORDER, FILTER_COLUMNS, PAGE_SIZES, PINNED_COLUMNS } from '../lib/constants'
import { downloadCsv, itemsToCsv } from '../lib/csv'
import BulkEditBar from './BulkEditBar'
import MultiSelectFilter from './MultiSelectFilter'
import { formatMoney, formatMoney2, lineTotal } from '../lib/format'
import ConfirmModal from './ConfirmModal'
import ConfirmEditCell from './cells/ConfirmEditCell'
import CategoryCell from './cells/CategoryCell'
import InlineTextCell from './cells/InlineTextCell'
import OwnerCell from './cells/OwnerCell'
import QtyCell from './cells/QtyCell'
import StatusCell from './cells/StatusCell'
import DeptCell from './cells/DeptCell'
import DateCell from './cells/DateCell'
import AttachmentsCell from './cells/AttachmentsCell'

// Filter shape: undefined | {type:'text',text} | {type:'set',values:[]}
function columnFilterFn(row, columnId, fv) {
  if (!fv) return true
  const raw = row.getValue(columnId)
  const s = raw == null ? '' : String(raw)
  if (fv.type === 'text') return s.toLowerCase().includes((fv.text || '').toLowerCase())
  if (fv.type === 'set') return fv.values.includes(s)
  return true
}

function globalFilterFn(row, _columnId, query) {
  const q = (query || '').toLowerCase()
  if (!q) return true
  const r = row.original
  return [r.item, r.supplier, r.order_no, r.ref, r.category, r.package, r.department, r.owner]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

const DEFAULT_ORDER = DEFAULT_COLUMN_ORDER

// A two-line column header: a main label with a smaller VAT qualifier beneath.
const twoLine = (main, sub) => (
  <span className="th-2l">
    <span>{main}</span>
    <span className="th-sub">{sub}</span>
  </span>
)

export default function OrdersTable({
  items,
  categories,
  departments,
  people,
  suppliers,
  view,
  setView,
  onEdit,
  onBulkEdit,
  onDeleteItems,
  onAddItem,
  onAddCategory,
  onAddDepartment,
  onUndo,
  canUndo,
  attachmentsByItem = {},
  onUploadFiles,
  onRemoveAttachment,
  onDownloadAttachment,
}) {
  const [pending, setPending] = useState(null) // {id, patch, meta}
  const [bulkPending, setBulkPending] = useState(null) // {ids, patch, summary}
  const [deletePending, setDeletePending] = useState(null) // ids[]
  const [selected, setSelected] = useState(() => new Set()) // selected item ids
  const [dragCol, setDragCol] = useState(null) // column being dragged
  const [dragOverCol, setDragOverCol] = useState(null) // column currently under the cursor

  // A confirmed edit routes through here; edits with no meta commit directly.
  const requestConfirm = (id, patch, meta) => {
    if (!meta) return onEdit(id, patch)
    setPending({ id, patch, meta })
  }

  const columns = useMemo(() => {
    return [
      {
        accessorKey: 'package',
        header: 'Package',
        size: 92,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <ConfirmEditCell
            value={getValue()}
            field="package"
            label="Package"
            onConfirm={(patch, meta) => requestConfirm(row.original.id, patch, meta)}
          />
        ),
      },
      {
        accessorKey: 'item',
        header: 'Item',
        size: 300,
        meta: { filter: 'text' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <ConfirmEditCell
            value={getValue()}
            field="item"
            label="Item"
            onConfirm={(patch, meta) => requestConfirm(row.original.id, patch, meta)}
          />
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        size: 200,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <CategoryCell
            value={getValue()}
            categories={categories}
            onConfirm={(patch, meta) => requestConfirm(row.original.id, patch, meta)}
            onAddCategory={onAddCategory}
          />
        ),
      },
      {
        accessorKey: 'department',
        header: 'Department',
        size: 132,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <DeptCell
            value={getValue()}
            departments={departments}
            onEdit={(patch) => onEdit(row.original.id, patch)}
            onAddDepartment={onAddDepartment}
          />
        ),
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        size: 130,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <OwnerCell value={getValue()} people={people} onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 150,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <StatusCell value={getValue()} onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'qty',
        header: 'Qty',
        size: 70,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ row, getValue }) => (
          <QtyCell value={getValue()} onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'unit_price',
        header: () => twoLine('Unit price', 'ex. VAT'),
        size: 112,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ row, getValue }) => (
          <ConfirmEditCell
            value={getValue()}
            field="unit_price"
            label="Unit price ex. VAT"
            numeric
            parse={(s) => Number(s) || 0}
            formatValue={(v) => formatMoney2(v)}
            editValue={(v) => (v ? String(v) : '')}
            onConfirm={(patch, meta) => requestConfirm(row.original.id, patch, meta)}
          />
        ),
      },
      {
        accessorKey: 'vat_pct',
        header: '% VAT',
        size: 72,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ row, getValue }) => (
          <QtyCell value={getValue()} field="vat_pct" onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        id: 'unit_incl',
        header: () => twoLine('Unit price', 'incl. VAT'),
        accessorFn: (r) => (Number(r.unit_price) || 0) * (1 + (Number(r.vat_pct) || 0) / 100),
        size: 120,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ getValue }) => <span className="cell-pad cell-num">{formatMoney2(getValue())}</span>,
      },
      {
        id: 'total',
        header: () => twoLine('Total', 'ex. VAT'),
        accessorFn: (r) => lineTotal(r),
        size: 120,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ getValue }) => <span className="cell-pad cell-num">{formatMoney2(getValue())}</span>,
      },
      {
        accessorKey: 'budget',
        header: () => twoLine('Budget', 'ex. VAT'),
        size: 120,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ getValue }) => <span className="cell-pad cell-num" title="Locked budget">{formatMoney2(getValue())}</span>,
      },
      {
        accessorKey: 'supplier',
        header: 'Supplier',
        size: 150,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell
            value={getValue()}
            field="supplier"
            options={suppliers}
            onEdit={(patch) => onEdit(row.original.id, patch)}
          />
        ),
      },
      {
        accessorKey: 'order_date',
        header: 'Order date',
        size: 140,
        meta: { filter: 'none' },
        enableColumnFilter: false,
        sortUndefined: 'last',
        cell: ({ row, getValue }) => (
          <DateCell value={getValue()} field="order_date" onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'invoice_no',
        header: 'Invoice #',
        size: 130,
        meta: { filter: 'text' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell value={getValue()} field="invoice_no" onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'order_no',
        header: 'Order #',
        size: 130,
        meta: { filter: 'text' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell value={getValue()} field="order_no" onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'est_arrival',
        header: 'Est. arrival date',
        size: 150,
        meta: { filter: 'none' },
        enableColumnFilter: false,
        sortUndefined: 'last',
        cell: ({ row, getValue }) => (
          <DateCell value={getValue()} field="est_arrival" onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'ref',
        header: 'Description / ref',
        size: 150,
        meta: { filter: 'text' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell
            value={getValue()}
            field="ref"
            onEdit={(patch) => onEdit(row.original.id, patch)}
          />
        ),
      },
      {
        id: 'files',
        header: 'Files & Comments',
        size: 240,
        enableSorting: false,
        enableColumnFilter: false,
        meta: { filter: 'none' },
        cell: ({ row }) => (
          <div className="files-cell">
            <AttachmentsCell
              itemId={row.original.id}
              files={attachmentsByItem[row.original.id]}
              onUpload={onUploadFiles}
              onRemove={onRemoveAttachment}
              onDownload={onDownloadAttachment}
            />
            <InlineTextCell
              value={row.original.comment}
              field="comment"
              placeholder="Comment…"
              onEdit={(patch) => onEdit(row.original.id, patch)}
            />
          </div>
        ),
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, departments, people, suppliers, attachmentsByItem])

  // Reconcile a saved column order with the current columns: keep the user's
  // ordering for known columns and append any new columns (so a schema change
  // never drops or hides a column, and stale ids are ignored).
  const effectiveOrder = useMemo(() => {
    const saved = view.columnOrder?.length ? view.columnOrder : DEFAULT_ORDER
    const known = saved.filter((id) => DEFAULT_ORDER.includes(id))
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id))
    return [...known, ...missing]
  }, [view.columnOrder])

  // Distinct values for the "set" filter popovers.
  const uniqueValues = useMemo(() => {
    const map = {}
    for (const c of ['package', 'category', 'department', 'owner', 'status', 'supplier']) {
      map[c] = [...new Set(items.map((i) => i[c] ?? ''))].sort((a, b) => String(a).localeCompare(String(b)))
    }
    return map
  }, [items])

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting: view.sorting,
      columnFilters: view.columnFilters,
      columnSizing: view.columnSizing,
      columnOrder: effectiveOrder,
      columnPinning: { left: PINNED_COLUMNS },
      globalFilter: view.globalFilter,
      pagination: view.pagination,
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    globalFilterFn,
    onSortingChange: (u) => setView((p) => ({ sorting: typeof u === 'function' ? u(p.sorting) : u })),
    onColumnFiltersChange: (u) =>
      setView((p) => ({ columnFilters: typeof u === 'function' ? u(p.columnFilters) : u })),
    onColumnSizingChange: (u) =>
      setView((p) => ({ columnSizing: typeof u === 'function' ? u(p.columnSizing) : u })),
    onGlobalFilterChange: (u) =>
      setView((p) => ({ globalFilter: typeof u === 'function' ? u(p.globalFilter) : u })),
    onPaginationChange: (u) =>
      setView((p) => ({ pagination: typeof u === 'function' ? u(p.pagination) : u })),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const leafCols = table.getVisibleLeafColumns()
  const filteredRows = table.getFilteredRowModel().rows // all matching rows (across pages)
  const rows = table.getRowModel().rows // just the current page (pagination caps this)

  // Pinned columns are position:sticky, and sticky cells don't reliably adopt
  // <colgroup> widths in a fixed-layout table. So we drive BOTH their width and
  // the item column's left offset from CSS variables on the table element. This
  // makes resizing them reliable AND keeps rows out of the re-render (the body
  // is memoized, widths come from the variables).
  const pkgWidth = table.getColumn('package')?.getSize() ?? 0
  const itemWidth = table.getColumn('item')?.getSize() ?? 0
  const pinVars = { '--sel-w': '42px', '--pkg-w': `${pkgWidth}px`, '--item-w': `${itemWidth}px` }

  // Zoom the table in its frame (persisted per user).
  const zoom = view.zoom || 1
  const setZoom = (z) => setView({ zoom: Math.min(1.5, Math.max(0.6, Math.round(z * 10) / 10)) })

  // Row selection (by id, so it survives paging and filtering).
  const pageIds = rows.map((r) => r.original.id)
  const filteredIds = filteredRows.map((r) => r.original.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = pageIds.some((id) => selected.has(id))
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

  const toggleRow = (id) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAllPage = () =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (allPageSelected) pageIds.forEach((id) => n.delete(id))
      else pageIds.forEach((id) => n.add(id))
      return n
    })
  const selectAllFiltered = () =>
    setSelected((prev) => {
      const n = new Set(prev)
      filteredIds.forEach((id) => n.add(id))
      return n
    })
  const clearSelection = () => setSelected(new Set())

  // Bulk edit: build a human summary + real patch, then confirm.
  const FIELD_LABELS = {
    category: 'Category', owner: 'Owner', department: 'Department', status: 'Status',
    supplier: 'Supplier', order_date: 'Order date', est_arrival: 'Est. arrival',
  }
  const applyBulk = (patch) => {
    const real = { ...patch }
    if (real.owner === '__unassign') real.owner = ''
    const summary = Object.entries(patch)
      .map(([k, v]) => `${FIELD_LABELS[k]} → ${v === '__unassign' ? 'Unassigned' : v}`)
      .join(', ')
    const ids = [...selected]
    setBulkPending({ ids, patch: real, summary })
  }

  // Drag-to-reorder (non-pinned columns only). The two pinned columns stay first.
  const clearDrag = () => {
    setDragCol(null)
    setDragOverCol(null)
  }
  const handleDrop = (targetId) => {
    if (!dragCol || dragCol === targetId) return clearDrag()
    if (PINNED_COLUMNS.includes(dragCol) || PINNED_COLUMNS.includes(targetId)) return clearDrag()
    const order = [...effectiveOrder]
    const from = order.indexOf(dragCol)
    const to = order.indexOf(targetId)
    if (from < 0 || to < 0) return clearDrag()
    order.splice(to, 0, order.splice(from, 1)[0])
    setView({ columnOrder: order })
    clearDrag()
  }

  // Class describing a pinned cell's left offset (0 for package, the CSS var for item).
  const pinClass = (col) => {
    if (col.getIsPinned() !== 'left') return ''
    const last = col.id === PINNED_COLUMNS[PINNED_COLUMNS.length - 1]
    return `pinned ${col.id === 'package' ? 'pin-pkg' : 'pin-item'}${last ? ' pinned-shadow' : ''}`
  }

  const setColumnFilter = (columnId, value) => table.getColumn(columnId)?.setFilterValue(value)

  // The rendered rows are memoized on what actually changes their content
  // (data/sort/filter/page -> `rows`; reorder -> `columnOrder`; selection;
  // dropdown sources & attachments -> `columns`/`attachmentsByItem`). Column
  // *sizing* is deliberately excluded, so resizing only updates the <colgroup>
  // widths + pinned-left CSS variables — rows are not re-rendered.
  const bodyRows = useMemo(
    () =>
      rows.map((row) => {
        const isSel = selected.has(row.original.id)
        // Any status other than "Not ordered" needs invoice #, order # and a file.
        const needsInfo = row.original.status !== 'Not ordered'
        const files = attachmentsByItem[row.original.id]
        return (
          <tr key={row.id} className={isSel ? 'row-selected' : ''}>
            <td className="pinned pin-select select-cell">
              <input type="checkbox" checked={isSel} onChange={() => toggleRow(row.original.id)} />
            </td>
            {row.getVisibleCells().map((cell) => {
              const col = cell.column
              const meta = col.columnDef.meta || {}
              const req =
                needsInfo &&
                ((col.id === 'invoice_no' && !row.original.invoice_no) ||
                  (col.id === 'order_no' && !row.original.order_no) ||
                  (col.id === 'files' && !(files && files.length)))
              return (
                <td
                  key={cell.id}
                  className={`${pinClass(col)} ${meta.align === 'num' ? 'cell-num' : ''} ${req ? 'cell-required' : ''}`}
                >
                  {flexRender(col.columnDef.cell, cell.getContext())}
                </td>
              )
            })}
          </tr>
        )
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, view.columnOrder, columns, selected, attachmentsByItem],
  )

  const rowsData = useMemo(() => filteredRows.map((r) => r.original), [filteredRows])
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const firstShown = filteredRows.length === 0 ? 0 : pageIndex * pageSize + 1
  const lastShown = Math.min((pageIndex + 1) * pageSize, filteredRows.length)

  const exportCsv = () => downloadCsv('florence-pre-opening.csv', itemsToCsv(rowsData))
  const missingCount = rowsData.filter(
    (r) => r.status !== 'Not ordered' && (!r.invoice_no || !r.order_no || !(attachmentsByItem[r.id]?.length)),
  ).length

  return (
    <>
      <div className="filterbar">
        <button className="btn btn-primary" onClick={onAddItem}>
          <Plus size={15} /> Add Item
        </button>
        <span className="filterbar-label">Filter</span>
        {FILTER_COLUMNS.map(([id, label]) => (
          <MultiSelectFilter
            key={id}
            label={label}
            options={uniqueValues[id]}
            selected={table.getColumn(id)?.getFilterValue()?.values ?? []}
            onChange={(vals) => setColumnFilter(id, vals.length ? { type: 'set', values: vals } : undefined)}
          />
        ))}
        {FILTER_COLUMNS.some(([id]) => table.getColumn(id)?.getFilterValue()?.values?.length) && (
          <button className="linkbtn" onClick={() => FILTER_COLUMNS.forEach(([id]) => setColumnFilter(id, undefined))}>
            Clear filters
          </button>
        )}

        <div className="spacer" />

        <button className="btn icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo last change (Ctrl+Z)">
          <RotateCcw size={15} /> Undo
        </button>
        <div className="zoomer" title="Zoom the table">
          <button className="btn icon-btn" onClick={() => setZoom(zoom - 0.1)} disabled={zoom <= 0.6} aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn icon-btn" onClick={() => setZoom(zoom + 0.1)} disabled={zoom >= 1.5} aria-label="Zoom in">
            <Plus size={15} />
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <BulkEditBar
          count={selected.size}
          filteredCount={filteredRows.length}
          allFilteredSelected={allFilteredSelected}
          categories={categories}
          departments={departments}
          people={people}
          suppliers={suppliers}
          onApply={applyBulk}
          onClear={clearSelection}
          onSelectAllFiltered={selectAllFiltered}
          onAttach={(files) => onUploadFiles([...selected], files)}
          onDelete={() => setDeletePending([...selected])}
        />
      )}

      {missingCount > 0 && (
        <div className="warn-banner">
          ⚠ {missingCount} order{missingCount === 1 ? '' : 's'} require additional info (invoice and/or order # and file
          attachment).
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="grid" style={{ ...pinVars, zoom }}>
            <colgroup>
              <col style={{ width: 42 }} />
              {leafCols.map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  <th className="pinned pin-select select-cell">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => el && (el.indeterminate = !allPageSelected && somePageSelected)}
                      onChange={toggleAllPage}
                      title="Select all on this page"
                    />
                  </th>
                  {hg.headers.map((header) => {
                    const col = header.column
                    const pinned = col.getIsPinned() === 'left'
                    const meta = col.columnDef.meta || {}
                    const sorted = col.getIsSorted()
                    const canDrop = dragCol && dragCol !== col.id && !pinned
                    return (
                      <th
                        key={header.id}
                        className={`${pinClass(col)} ${col.id === dragCol ? 'drag-source' : ''} ${
                          col.id === dragOverCol ? 'drag-over' : ''
                        }`}
                        onDragEnter={() => canDrop && setDragOverCol(col.id)}
                        onDragOver={(e) => {
                          if (!canDrop) return
                          e.preventDefault()
                          if (dragOverCol !== col.id) setDragOverCol(col.id)
                        }}
                        onDrop={() => handleDrop(col.id)}
                      >
                        <div className="th-inner">
                          {!pinned && (
                            <span
                              className="th-grip"
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', col.id)
                                setDragCol(col.id)
                              }}
                              onDragEnd={() => setDragCol(null)}
                              title="Drag to reorder"
                            >
                              <GripVertical size={13} />
                            </span>
                          )}
                          <span
                            className={`th-label ${meta.align === 'num' ? 'cell-num' : ''}`}
                            onClick={col.getToggleSortingHandler()}
                            title="Click to sort"
                          >
                            {flexRender(col.columnDef.header, header.getContext())}
                          </span>
                          <span className="th-sort" onClick={col.getToggleSortingHandler()}>
                            {sorted === 'asc' ? (
                              <ArrowUp size={13} />
                            ) : sorted === 'desc' ? (
                              <ArrowDown size={13} />
                            ) : (
                              <ChevronsUpDown size={12} opacity={0.4} />
                            )}
                          </span>
                        </div>
                        {col.getCanResize() && (
                          <span
                            className={`resizer ${col.getIsResizing() ? 'active' : ''}`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {bodyRows}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={leafCols.length + 1} className="center-note">
                    No items match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pager">
        <span className="row-count">
          {filteredRows.length === 0
            ? '0 line items'
            : `Showing ${firstShown}–${lastShown} of ${filteredRows.length}`}
          {filteredRows.length !== items.length ? ` (filtered from ${items.length})` : ''}
          {' · '}
          {formatMoney(rowsData.reduce((s, r) => s + lineTotal(r), 0))}
        </span>
        <div className="spacer" />
        <button className="btn" onClick={exportCsv} title="Export the currently filtered rows to CSV">
          <Download size={14} /> Export CSV
        </button>
        <label className="pager-size">
          Rows
          <select
            className="ctrl"
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={items.length}>All</option>
          </select>
        </label>
        <div className="pager-nav">
          <button className="btn" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft size={15} />
          </button>
          <span className="pager-info">
            Page {pageIndex + 1} of {Math.max(1, pageCount)}
          </span>
          <button className="btn" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <p className="hint">
        Click a header to sort, the funnel to filter, and drag the grip to reorder columns. Drag a header edge to
        resize. Package &amp; Item stay pinned while scrolling. Your sort, filters, layout and page size are saved to
        your account only.
      </p>

      <ConfirmModal
        open={!!pending}
        title={`Change ${pending?.meta.label}?`}
        message="This is a tracked field. Confirm you want to update it."
        change={pending ? { from: pending.meta.from, to: pending.meta.to } : null}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          onEdit(pending.id, pending.patch)
          setPending(null)
        }}
      />

      <ConfirmModal
        open={!!bulkPending}
        title={`Update ${bulkPending?.ids.length} item${bulkPending?.ids.length === 1 ? '' : 's'}?`}
        message={bulkPending ? `Set ${bulkPending.summary}.` : ''}
        confirmLabel="Apply changes"
        onCancel={() => setBulkPending(null)}
        onConfirm={() => {
          onBulkEdit(bulkPending.ids, bulkPending.patch)
          setBulkPending(null)
          clearSelection()
        }}
      />

      <ConfirmModal
        open={!!deletePending}
        title={`Delete ${deletePending?.length} item${deletePending?.length === 1 ? '' : 's'}?`}
        message="This permanently removes the selected line items and their attachment links. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setDeletePending(null)}
        onConfirm={() => {
          onDeleteItems(deletePending)
          setDeletePending(null)
          clearSelection()
        }}
      />
    </>
  )
}
