import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useViewPrefs } from './hooks/useViewPrefs'
import { addItem, deleteItems, fetchItems, subscribeItems, updateItem, updateItems } from './data/items'
import { filterItems } from './lib/filtering'
import { addCategory, fetchCategories } from './data/categories'
import { addDepartment, fetchDepartments } from './data/departments'
import { DEPARTMENTS } from './lib/departments'
import { ensureMyProfile, fetchProfiles, setMyPassword, updateMyProfile } from './data/profiles'
import { fetchAttachments, removeLink, signedUrl, uploadFiles } from './data/attachments'
import { DEFAULT_COLUMN_ORDER } from './lib/constants'
import { displayName } from './lib/people'
import Auth from './components/Auth'
import Header from './components/Header'
import Metrics from './components/Metrics'
import OrdersTable from './components/OrdersTable'
import Summary from './components/Summary'
import ProfileModal from './components/ProfileModal'
import InviteModal from './components/InviteModal'
import ServicesTab from './components/services/ServicesTab'
import {
  fetchServiceLines, fetchServiceEntries, fetchServiceCloses,
  addServiceEntry, updateServiceEntry, deleteServiceEntry, uploadServiceFile, serviceSignedUrl,
  setMonthClose, clearMonthClose,
} from './data/services'
import { SERVICE_MONTHS, computeLine } from './lib/serviceCalc'
import { formatMoney } from './lib/format'

const DEFAULT_VIEW = {
  sorting: [],
  columnFilters: [],
  columnSizing: {},
  columnOrder: DEFAULT_COLUMN_ORDER,
  globalFilter: '',
  pagination: { pageIndex: 0, pageSize: 50 },
  zoom: 1,
  metricsOpen: false, // Metrics panel collapsed by default
}

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'services', label: 'Services' },
  { id: 'owner', label: 'Summary by owner' },
  { id: 'supplier', label: 'Summary by supplier' },
]

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState(DEPARTMENTS)
  const [attachments, setAttachments] = useState({})
  const [serviceLines, setServiceLines] = useState([])
  const [serviceEntries, setServiceEntries] = useState({})
  const [serviceCloses, setServiceCloses] = useState({})
  const [profiles, setProfiles] = useState([])
  const [myProfile, setMyProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [tab, setTab] = useState('orders')

  const { prefs: view, update: setView } = useViewPrefs(!!user, DEFAULT_VIEW)

  // Initial load + realtime refresh when a teammate edits.
  useEffect(() => {
    if (!user) return
    let active = true
    const load = () =>
      Promise.all([fetchItems(), fetchCategories(), fetchProfiles(), fetchAttachments(), fetchDepartments()])
        .then(([its, cats, profs, atts, depts]) => {
          if (!active) return
          setItems(its)
          setCategories(cats.map((c) => c.name))
          setProfiles(profs)
          setAttachments(atts)
          if (depts.length) setDepartments(depts.map((d) => d.name))
        })
        .catch((err) => console.error('Load failed', err))
        .finally(() => active && setDataLoading(false))
    load()
    // Make sure this user has a profile; prompt for a name if it's blank.
    ensureMyProfile()
      .then((mine) => {
        if (!active || !mine) return
        setMyProfile(mine)
        // Prompt until they've set both a name and a password.
        if (!mine.first_name || !mine.password_set) setShowProfile(true)
      })
      .catch((err) => console.error('Profile load failed', err))
    const unsub = subscribeItems(() => load())
    return () => {
      active = false
      unsub()
    }
  }, [user])

  // Services data loads separately so a missing 0007 migration never breaks the
  // Orders tab — on error the Services tab just shows its "run migration" note.
  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([fetchServiceLines(), fetchServiceEntries(), fetchServiceCloses()])
      .then(([ls, es, cs]) => {
        if (!active) return
        setServiceLines(ls)
        setServiceEntries(es)
        setServiceCloses(cs)
      })
      .catch((err) => console.error('Services load failed (run migration 0007_services.sql?)', err))
    return () => {
      active = false
    }
  }, [user])

  // Services entry handlers (forecast breakdown + invoices). Refetch entries
  // after each change so figures recompute live.
  const refreshServiceEntries = useCallback(
    () => fetchServiceEntries().then(setServiceEntries).catch((e) => console.error('Entries reload failed', e)),
    [],
  )
  const refreshServiceCloses = useCallback(
    () => fetchServiceCloses().then(setServiceCloses).catch((e) => console.error('Closes reload failed', e)),
    [],
  )
  const onServiceEntryAdd = useCallback(
    async (entry) => {
      try {
        await addServiceEntry(entry)
        await refreshServiceEntries()
      } catch (e) {
        console.error('Add entry failed', e)
        alert('Could not add the entry. Please try again.')
      }
    },
    [refreshServiceEntries],
  )
  // Returns true if saved, false if blocked/failed (the modal reverts on false).
  const onServiceEntryUpdate = useCallback(
    async (id, patch) => {
      // Block a forecast increase that pushes the line's reforecast over budget.
      if ('amount_ex_vat' in patch) {
        const lineEntries = Object.values(serviceEntries).flat()
        const entry = lineEntries.find((e) => e.id === id)
        if (entry && entry.type === 'forecast') {
          const line = serviceLines.find((l) => l.id === entry.line_id)
          const proposed = (serviceEntries[entry.line_id] || []).map((e) => (e.id === id ? { ...e, ...patch } : e))
          const reforecast = computeLine(line, proposed, serviceCloses[entry.line_id], false).reforecast
          if (line && reforecast > (Number(line.budget) || 0) + 0.5) {
            alert(
              `This pushes the reforecast to ${formatMoney(reforecast)}, above the budget of ` +
                `${formatMoney(line.budget)}.\n\nPlease notify the manager before increasing the forecast.`,
            )
            return false
          }
        }
      }
      try {
        await updateServiceEntry(id, patch)
        await refreshServiceEntries()
        return true
      } catch (e) {
        console.error('Update entry failed', e)
        alert('Could not save the change. Please try again.')
        return false
      }
    },
    [serviceEntries, serviceLines, serviceCloses, refreshServiceEntries],
  )
  const onServiceEntryDelete = useCallback(
    async (id, filePath) => {
      try {
        await deleteServiceEntry(id, filePath)
        await refreshServiceEntries()
      } catch (e) {
        console.error('Delete entry failed', e)
        alert('Could not remove the entry. Please try again.')
      }
    },
    [refreshServiceEntries],
  )
  const onServiceEntryAttach = useCallback(
    async (entry, file) => {
      try {
        const up = await uploadServiceFile(file)
        await updateServiceEntry(entry.id, { file_path: up.path, file_name: up.name })
        await refreshServiceEntries()
      } catch (e) {
        console.error('Attach failed', e)
        alert('Could not attach the file. Please try again.')
      }
    },
    [refreshServiceEntries],
  )
  const onServiceDownload = useCallback(async (path) => {
    try {
      const url = await serviceSignedUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      console.error('Download failed', e)
      alert('Could not open the file.')
    }
  }, [])

  // Close a month: 'cancelled' drops the unused (reforecast falls), 'rolled'
  // moves the unused forecast into the next month.
  const onServiceCloseMonth = useCallback(
    async (lineId, month, disposition) => {
      try {
        if (disposition === 'rolled') {
          const rows = (serviceEntries[lineId] || []).filter((e) => e.month === month)
          const fSum = rows.filter((e) => e.type === 'forecast').reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)
          const iSum = rows.filter((e) => e.type === 'invoice').reduce((s, e) => s + (Number(e.amount_ex_vat) || 0), 0)
          const unused = Math.max(0, fSum - iSum)
          const idx = SERVICE_MONTHS.findIndex((m) => m.key === month)
          const next = SERVICE_MONTHS[idx + 1]
          if (unused > 0 && next) {
            await addServiceEntry({
              line_id: lineId, month: next.key, type: 'forecast',
              title: `Rolled forward from ${SERVICE_MONTHS[idx].label}`, amount_ex_vat: unused, vat_pct: 22,
            })
          }
        }
        await setMonthClose(lineId, month, disposition)
        await Promise.all([refreshServiceEntries(), refreshServiceCloses()])
      } catch (e) {
        console.error('Close month failed', e)
        alert('Could not close the month. Please try again.')
      }
    },
    [serviceEntries, refreshServiceEntries, refreshServiceCloses],
  )

  const onServiceReopenMonth = useCallback(
    async (lineId, month) => {
      try {
        await clearMonthClose(lineId, month)
        await refreshServiceCloses()
      } catch (e) {
        console.error('Reopen failed', e)
        alert('Could not reopen the month.')
      }
    },
    [refreshServiceCloses],
  )

  // Team members shown in the Owner dropdown: only signed-up users (by their
  // "First L." display name). A blank owner counts as unassigned.
  const people = useMemo(
    () => [...new Set(profiles.map(displayName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [profiles],
  )

  const suppliers = useMemo(
    () => [...new Set(items.map((i) => i.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  // Items after the Orders filter/search — used to keep the Metrics panel in sync.
  const filteredItems = useMemo(
    () => filterItems(items, view.columnFilters, view.globalFilter),
    [items, view.columnFilters, view.globalFilter],
  )

  // Keep a live ref of items so edits can capture previous values synchronously
  // (for the undo stack) without stale closures.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // Undo stack (last 30 actions). Each entry knows how to reverse itself.
  const undoRef = useRef([])
  const [undoCount, setUndoCount] = useState(0)
  const pushUndo = useCallback((entry) => {
    undoRef.current = [...undoRef.current, entry].slice(-30)
    setUndoCount(undoRef.current.length)
  }, [])

  const pick = (row, keys) => Object.fromEntries(keys.map((k) => [k, row?.[k]]))

  // Optimistic single edit. `record` pushes an undo entry (skipped when the edit
  // IS an undo).
  const onEdit = useCallback(
    async (id, patch, record = true) => {
      const before = itemsRef.current.find((r) => r.id === id)
      const idSet = new Set([id])
      setItems((cur) => cur.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)))
      if (record && before) pushUndo({ type: 'single', id, prev: pick(before, Object.keys(patch)) })
      try {
        await updateItem(id, patch)
      } catch (err) {
        console.error('Save failed', err)
        if (before) setItems((cur) => cur.map((r) => (r.id === id ? before : r)))
        alert('Could not save that change. Please try again.')
      }
    },
    [pushUndo],
  )

  // Optimistic bulk edit (same patch to many items).
  const onBulkEdit = useCallback(
    async (ids, patch, record = true) => {
      const keys = Object.keys(patch)
      const changes = ids.map((id) => ({ id, prev: pick(itemsRef.current.find((r) => r.id === id), keys) }))
      const idSet = new Set(ids)
      const prevAll = itemsRef.current
      setItems((cur) => cur.map((r) => (idSet.has(r.id) ? { ...r, ...patch } : r)))
      if (record) pushUndo({ type: 'bulk', changes })
      try {
        await updateItems(ids, patch)
      } catch (err) {
        console.error('Bulk update failed', err)
        setItems(prevAll)
        alert('Could not apply the bulk change. Please try again.')
      }
    },
    [pushUndo],
  )

  // Undo the most recent action (restore captured previous values).
  const undo = useCallback(() => {
    const entry = undoRef.current[undoRef.current.length - 1]
    if (!entry) return
    undoRef.current = undoRef.current.slice(0, -1)
    setUndoCount(undoRef.current.length)
    if (entry.type === 'single') {
      onEdit(entry.id, entry.prev, false)
    } else if (entry.type === 'bulk') {
      const map = new Map(entry.changes.map((c) => [c.id, c.prev]))
      setItems((cur) => cur.map((r) => (map.has(r.id) ? { ...r, ...map.get(r.id) } : r)))
      Promise.all(entry.changes.map((c) => updateItem(c.id, c.prev))).catch((err) => {
        console.error('Undo failed', err)
        alert('Could not undo. Please refresh.')
      })
    }
  }, [onEdit])

  // Ctrl/Cmd+Z — but let native undo work while editing a field.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  // File attachments (stored in Supabase Storage; grid only shows counts).
  const refreshAttachments = useCallback(() => {
    fetchAttachments().then(setAttachments).catch((err) => console.error('Attachments load failed', err))
  }, [])
  const onUploadFiles = useCallback(
    async (itemIds, files) => {
      try {
        await uploadFiles(files, itemIds)
        refreshAttachments()
      } catch (err) {
        console.error('Upload failed', err)
        alert('Could not upload the file(s). Please try again.')
      }
    },
    [refreshAttachments],
  )
  const onRemoveAttachment = useCallback(
    async (itemId, attachmentId) => {
      try {
        await removeLink(itemId, attachmentId)
        refreshAttachments()
      } catch (err) {
        console.error('Remove attachment failed', err)
        alert('Could not remove the file. Please try again.')
      }
    },
    [refreshAttachments],
  )
  const onDownloadAttachment = useCallback(async (path) => {
    try {
      const url = await signedUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      console.error('Download failed', err)
      alert('Could not open the file. Please try again.')
    }
  }, [])

  // Delete selected line items (optimistic; revert on error).
  const onDeleteItems = useCallback(async (ids) => {
    const idSet = new Set(ids)
    const prev = itemsRef.current
    setItems((cur) => cur.filter((r) => !idSet.has(r.id)))
    try {
      await deleteItems(ids)
    } catch (err) {
      console.error('Delete failed', err)
      setItems(prev)
      alert('Could not delete the selected items. Please try again.')
    }
  }, [])

  // Add a new blank line item at the top of the list.
  const onAddItem = useCallback(async () => {
    const minIdx = itemsRef.current.reduce((m, r) => Math.min(m, r.sort_index ?? 0), 0)
    const blank = {
      package: '', item: 'New item', category: '', department: 'OS&E', owner: '', status: 'Not ordered',
      qty: 0, unit_price: 0, supplier: '', order_date: null, invoice_no: '', order_no: '', est_arrival: null,
      ref: '', sort_index: minIdx - 1,
    }
    try {
      const created = await addItem(blank)
      setItems((cur) => [created, ...cur])
      setView({ pagination: { pageIndex: 0, pageSize: view.pagination?.pageSize || 50 } })
    } catch (err) {
      console.error('Add item failed', err)
      alert('Could not add a new item. Please try again.')
    }
  }, [setView, view.pagination])

  const onAddCategory = useCallback(async (name) => {
    const created = await addCategory(name)
    if (created) setCategories((cur) => (cur.includes(created.name) ? cur : [...cur, created.name].sort()))
    return created
  }, [])

  const onAddDepartment = useCallback(async (name) => {
    const created = await addDepartment(name)
    if (created) setDepartments((cur) => (cur.includes(created.name) ? cur : [...cur, created.name].sort()))
    return created
  }, [])

  const onSaveProfile = useCallback(async ({ first_name, last_name, password }) => {
    let saved = await updateMyProfile({ first_name, last_name })
    if (password) saved = await setMyPassword(password)
    if (saved) {
      setMyProfile(saved)
      setProfiles((cur) => {
        const rest = cur.filter((p) => p.user_id !== saved.user_id)
        return [...rest, saved].sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''))
      })
    }
    return saved
  }, [])

  if (authLoading) return <div className="center-note">Loading…</div>
  if (!user) return <Auth />

  return (
    <div className="page">
      <Header
        user={user}
        profile={myProfile}
        onEditName={() => setShowProfile(true)}
        onInvite={() => setShowInvite(true)}
      />
      {tab === 'orders' && (
        <Metrics
          items={filteredItems}
          open={view.metricsOpen === true}
          onToggle={() => setView({ metricsOpen: !(view.metricsOpen === true) })}
        />
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {dataLoading ? (
        <div className="center-note">Loading items…</div>
      ) : tab === 'orders' ? (
        <>
          <div className="toolbar">
            <span className="ctrl search" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Search size={14} color="#6b7280" />
              <input
                style={{ border: 0, outline: 'none', font: 'inherit', width: '100%', background: 'transparent' }}
                placeholder="Search item, supplier, ref…"
                value={view.globalFilter || ''}
                onChange={(e) => setView({ globalFilter: e.target.value })}
              />
            </span>
            <button className="btn" onClick={() => setView({ columnFilters: [], globalFilter: '' })}>
              Clear filters
            </button>
            <div className="spacer" />
            <button
              className="btn"
              title="Restore default column order and widths"
              onClick={() => setView({ columnSizing: {}, columnOrder: DEFAULT_COLUMN_ORDER })}
            >
              Reset columns
            </button>
          </div>
          <OrdersTable
            items={items}
            categories={categories}
            departments={departments}
            people={people}
            suppliers={suppliers}
            view={view}
            setView={setView}
            onEdit={onEdit}
            onBulkEdit={onBulkEdit}
            onDeleteItems={onDeleteItems}
            onAddItem={onAddItem}
            onAddCategory={onAddCategory}
            onAddDepartment={onAddDepartment}
            onUndo={undo}
            canUndo={undoCount > 0}
            attachmentsByItem={attachments}
            onUploadFiles={onUploadFiles}
            onRemoveAttachment={onRemoveAttachment}
            onDownloadAttachment={onDownloadAttachment}
          />
        </>
      ) : tab === 'services' ? (
        <ServicesTab
          lines={serviceLines}
          entriesByLine={serviceEntries}
          closesByLine={serviceCloses}
          onEntryAdd={onServiceEntryAdd}
          onEntryUpdate={onServiceEntryUpdate}
          onEntryDelete={onServiceEntryDelete}
          onEntryAttach={onServiceEntryAttach}
          onDownload={onServiceDownload}
          onCloseMonth={onServiceCloseMonth}
          onReopenMonth={onServiceReopenMonth}
        />
      ) : tab === 'owner' ? (
        <Summary items={items} departments={departments} groupKey="owner" groupLabel="Owner" blankLabel="Unassigned" />
      ) : (
        <Summary items={items} departments={departments} groupKey="supplier" groupLabel="Supplier" blankLabel="(No supplier)" />
      )}

      {showProfile && (
        <ProfileModal
          profile={myProfile}
          required={!myProfile?.first_name || !myProfile?.password_set}
          passwordSet={!!myProfile?.password_set}
          onSave={onSaveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
