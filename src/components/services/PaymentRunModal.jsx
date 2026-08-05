import { useEffect, useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { formatMoney } from '../../lib/format'
import { fetchLastExportRun } from '../../data/services'
import { collectToBePaid, exportPaymentRun, sumEx } from '../../data/paymentRun'

// Bookkeeper's payment-run export: one zip with a summary CSV + every evidence
// file, for invoices marked "To be paid". Offers all of them, or only the ones
// added since this user's last download.
export default function PaymentRunModal({ lines, entriesByLine, items = [], invoicesByItem = {}, onClose }) {
  const [lastTs, setLastTs] = useState(undefined) // undefined = loading, null = never
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    fetchLastExportRun()
      .then((ts) => active && setLastTs(ts))
      .catch(() => active && setLastTs(null))
    return () => { active = false }
  }, [])

  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])
  const all = useMemo(
    () => collectToBePaid(lines, entriesByLine, itemsById, invoicesByItem, null),
    [lines, entriesByLine, itemsById, invoicesByItem],
  )
  const fresh = useMemo(
    () => (lastTs ? collectToBePaid(lines, entriesByLine, itemsById, invoicesByItem, lastTs) : all),
    [lines, entriesByLine, itemsById, invoicesByItem, lastTs, all],
  )

  const run = async (picked, mode) => {
    if (!picked.length || busy) return
    setBusy(true)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      const { failures } = await exportPaymentRun(picked, mode, stamp)
      if (failures.length) {
        alert(`Exported, but ${failures.length} evidence file(s) could not be downloaded:\n` + failures.join('\n'))
      }
      onClose()
    } catch (e) {
      console.error('Payment-run export failed', e)
      alert('Could not build the payment-run export. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const lastLabel = lastTs
    ? new Date(lastTs).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal pr-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="me-close" onClick={() => !busy && onClose()} title="Close"><X size={18} /></button>
        <h3>Payment run</h3>
        <p>Export invoices marked <strong>To be paid</strong> — across services and OS&amp;E orders — as a summary CSV plus every evidence file, bundled in one zip.</p>

        <div className="pr-opts">
          <button className="pr-opt" disabled={busy || !all.length} onClick={() => run(all, 'all')}>
            <span className="pr-opt-body">
              <span className="pr-opt-main">All to be paid</span>
              <span className="pr-opt-sub">{all.length} invoice{all.length === 1 ? '' : 's'} · {formatMoney(sumEx(all))} ex VAT</span>
            </span>
            <Download size={16} />
          </button>

          <button className="pr-opt" disabled={busy || lastTs === undefined || !fresh.length} onClick={() => run(fresh, 'new')}>
            <span className="pr-opt-body">
              <span className="pr-opt-main">Only new since my last download</span>
              <span className="pr-opt-sub">
                {lastTs === undefined ? 'Checking…'
                  : lastTs === null ? 'No previous download — same as all'
                    : `${fresh.length} new · ${formatMoney(sumEx(fresh))} ex VAT · since ${lastLabel}`}
              </span>
            </span>
            <Download size={16} />
          </button>
        </div>

        {busy && <div className="me-status" style={{ marginTop: 12 }}>Building zip…</div>}
      </div>
    </div>
  )
}
