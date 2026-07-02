import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import AttachmentsModal from '../AttachmentsModal'

// Files column cell: a paperclip + count. Clicking opens a viewport-level modal
// (so it isn't clipped by the table) to upload/download/remove files.
export default function AttachmentsCell({ itemId, files = [], onUpload, onRemove, onDownload }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="att-cell">
      <button
        type="button"
        className={`att-btn ${files.length ? 'has' : ''}`}
        onClick={() => setOpen(true)}
        title={files.length ? `${files.length} file(s)` : 'Add file'}
      >
        <Paperclip size={14} />
        {files.length > 0 && <span className="att-count">{files.length}</span>}
      </button>
      {open && (
        <AttachmentsModal
          title="Attachments"
          subtitle="Invoices, order-confirmation emails, etc. for this line item."
          files={files}
          onUpload={(list) => onUpload(itemId, list)}
          onRemove={(attId) => onRemove(itemId, attId)}
          onDownload={onDownload}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  )
}
