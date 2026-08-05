import { useState } from 'react'
import { Receipt } from 'lucide-react'
import InvoicesModal from '../InvoicesModal'

// Invoices column cell: a receipt icon + count. Clicking opens a viewport-level
// modal (so it isn't clipped by the table) to add/edit invoices and their
// evidence for this line item.
export default function InvoicesCell({ item, invoices = [], onCommit, onDownload }) {
  const [open, setOpen] = useState(false)
  const count = invoices.length
  return (
    <span className="att-cell">
      <button
        type="button"
        className={`att-btn ${count ? 'has' : ''}`}
        onClick={() => setOpen(true)}
        title={count ? `${count} invoice(s)` : 'Add invoice'}
      >
        <Receipt size={14} />
        {count > 0 && <span className="att-count">{count}</span>}
      </button>
      {open && (
        <InvoicesModal
          item={item}
          invoices={invoices}
          onCommit={onCommit}
          onDownload={onDownload}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  )
}
