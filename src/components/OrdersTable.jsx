import { useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { DEFAULT_COLUMN_ORDER, PAGE_SIZES, PINNED_COLUMNS } from '../lib/constants'
import StatusBars from './StatusBars'
import { formatMoney, lineTotal } from '../lib/format'
import FilterPopover from './FilterPopover'
import ConfirmModal from './ConfirmModal'
import ConfirmEditCell from './cells/ConfirmEditCell'
import CategoryCell from './cells/CategoryCell'
import InlineTextCell from './cells/InlineTextCell'
import QtyCell from './cells/QtyCell'
import StatusCell from './cells/StatusCell'
import DeptCell from './cells/DeptCell'
import DateCell from './cells/DateCell'

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

export default function OrdersTable({
  items,
  categories,
  owners,
  suppliers,
  view,
  setView,
  onEdit,
  onAddCategory,
}) {
  const [pending, setPending] = useState(null) // {id, patch, meta}
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
          <DeptCell value={getValue()} onEdit={(patch) => onEdit(row.original.id, patch)} />
        ),
      },
      {
        accessorKey: 'owner',
        header: 'Owner',
        size: 130,
        meta: { filter: 'set' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell
            value={getValue()}
            field="owner"
            options={owners}
            placeholder="Unassigned"
            onEdit={(patch) => onEdit(row.original.id, patch)}
          />
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
        header: 'Unit price',
        size: 112,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ row, getValue }) => (
          <ConfirmEditCell
            value={getValue()}
            field="unit_price"
            label="Unit price"
            numeric
            parse={(s) => Number(s) || 0}
            formatValue={(v) => formatMoney(v)}
            editValue={(v) => (v ? String(v) : '')}
            onConfirm={(patch, meta) => requestConfirm(row.original.id, patch, meta)}
          />
        ),
      },
      {
        id: 'total',
        header: 'Total',
        accessorFn: (r) => lineTotal(r),
        size: 120,
        meta: { align: 'num', filter: 'none' },
        enableColumnFilter: false,
        cell: ({ getValue }) => <span className="cell-pad cell-num">{formatMoney(getValue())}</span>,
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
        accessorKey: 'order_no',
        header: 'Invoice / order no.',
        size: 150,
        meta: { filter: 'text' },
        filterFn: columnFilterFn,
        cell: ({ row, getValue }) => (
          <InlineTextCell
            value={getValue()}
            field="order_no"
            onEdit={(patch) => onEdit(row.original.id, patch)}
          />
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
          <DateCell value={getValue()} onEdit={(patch) => onEdit(row.original.id, patch)} />
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
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, owners, suppliers])

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
      columnOrder: view.columnOrder?.length ? view.columnOrder : DEFAULT_ORDER,
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
  const rows = table.getRowModel().rows // just the current page

  // Virtualize rows: only the ~visible rows are mounted, so sort/filter/resize/
  // edit/scroll stay fast no matter how many line items there are.
  const scrollRef = useRef(null)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 37, // fixed single-line row height (36px + 1px border)
    overscan: 12,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const padTop = virtualRows.length ? virtualRows[0].start : 0
  const padBottom = virtualRows.length ? totalSize - virtualRows[virtualRows.length - 1].end : 0

  // Left offset for the pinned "item" column = width of the pinned "package"
  // column. Exposed as a CSS variable so resizing does NOT need to re-render
  // every row — the browser repositions the sticky column from the variable.
  const pkgWidth = table.getColumn('package')?.getSize() ?? 0

  // Drag-to-reorder (non-pinned columns only). The two pinned columns stay first.
  const clearDrag = () => {
    setDragCol(null)
    setDragOverCol(null)
  }
  const handleDrop = (targetId) => {
    if (!dragCol || dragCol === targetId) return clearDrag()
    if (PINNED_COLUMNS.includes(dragCol) || PINNED_COLUMNS.includes(targetId)) return clearDrag()
    const order = view.columnOrder?.length ? [...view.columnOrder] : [...DEFAULT_ORDER]
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
  // (data, sort/filter -> `rows`; reorder -> `columnOrder`; scroll -> `rangeKey`;
  // dropdown sources -> `columns`). Column *sizing* is deliberately excluded, so
  // dragging a resizer only updates the <colgroup> widths and the pinned-left CSS
  // variable — the row cells are not re-rendered at all.
  const rangeKey = virtualRows.length
    ? `${virtualRows[0].index}-${virtualRows[virtualRows.length - 1].index}`
    : 'empty'
  const bodyRows = useMemo(
    () =>
      virtualRows.map((vr) => {
        const row = rows[vr.index]
        return (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => {
              const col = cell.column
              const meta = col.columnDef.meta || {}
              return (
                <td key={cell.id} className={`${pinClass(col)} ${meta.align === 'num' ? 'cell-num' : ''}`}>
                  {flexRender(col.columnDef.cell, cell.getContext())}
                </td>
              )
            })}
          </tr>
        )
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, view.columnOrder, columns, rangeKey, padTop, padBottom],
  )

  const rowsData = useMemo(() => filteredRows.map((r) => r.original), [filteredRows])
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const firstShown = filteredRows.length === 0 ? 0 : pageIndex * pageSize + 1
  const lastShown = Math.min((pageIndex + 1) * pageSize, filteredRows.length)

  return (
    <>
      <div className="card summary-pad" style={{ marginBottom: 12 }}>
        <StatusBars rows={rowsData} grid />
      </div>

      <div className="card overflow-hidden">
        <div className="table-scroll" ref={scrollRef}>
          <table className="grid" style={{ '--pin-item-left': `${pkgWidth}px` }}>
            <colgroup>
              {leafCols.map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
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
                          {meta.filter && meta.filter !== 'none' && (
                            <FilterPopover
                              mode={meta.filter}
                              uniqueValues={uniqueValues[col.id]}
                              value={col.getFilterValue()}
                              onChange={(v) => setColumnFilter(col.id, v)}
                            />
                          )}
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
              {padTop > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={leafCols.length} style={{ height: padTop, padding: 0, border: 0 }} />
                </tr>
              )}
              {bodyRows}
              {padBottom > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={leafCols.length} style={{ height: padBottom, padding: 0, border: 0 }} />
                </tr>
              )}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={leafCols.length} className="center-note">
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
    </>
  )
}
