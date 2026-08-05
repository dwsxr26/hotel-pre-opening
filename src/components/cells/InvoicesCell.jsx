import { useState } from 'react'
import { Check, Receipt } from 'lucide-react'
import InvoicesModal from '../InvoicesModal'

// Invoice column cell: a receipt icon (with a tick once an invoice is attached).
// Each order line carries at most one invoice. Clicking opens a viewport-level
// modal (so it isn't clipped by the table) to add / edit / remove it.
export default function InvoicesCell({ item, invoices = [], onCommit, onDownload }) {
  const [open, setOpen] = useState(false)
  const invoice = invoices[0] || null
  return (
    <span className="att-cell">
      <button
        type="button"
        className={`att-btn ${invoice ? 'has' : ''}`}
        onClick={() => setOpen(true)}
        title={invoice ? 'Invoice attached — click to view/edit' : 'Add invoice'}
      >
        <Receipt size={14} />
        {invoice && <Check size={11} className="att-count" />}
      </button>
      {open && (
        <InvoicesModal
          item={item}
          invoice={invoice}
          onCommit={(ops) => onCommit(item.id, ops)}
          onDownload={onDownload}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  )
}
