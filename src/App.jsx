import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useViewPrefs } from './hooks/useViewPrefs'
import { addItem, deleteItems, fetchItems, subscribeItems, updateItem, updateItems } from './data/items'
import { filterItems } from './lib/filtering'
import { addCategory, fetchCategories } from './data/categories'
import { addDepartment, fetchDepartments } from './data/departments'
import { DEPARTMENTS } from './lib/departments'
import { ensureMyProfile, fetchProfiles, setMyPassword, updateMyProfile, setAdmin } from './data/profiles'
import { fetchAttachments, removeLink, signedUrl, uploadFiles } from './data/attachments'
import { COLUMNS_VERSION, DEFAULT_COLUMN_ORDER } from './lib/constants'
import { displayName } from './lib/people'
import Auth from './components/Auth'
import Header from './components/Header'
import Metrics from './components/Metrics'
import OrdersTable from './components/OrdersTable'
import ProfileModal from './components/ProfileModal'
import InviteModal from './components/InviteModal'
import ServicesTab from './components/services/ServicesTab'
import TeamModal from './components/TeamModal'
import {
  fetchServiceLines, fetchServiceEntries, fetchServiceCloses,
  addServiceEntry, updateServiceEntry, deleteServiceEntry, uploadServiceFile, serviceSignedUrl,
  setMonthClose, clearMonthClose, updateServiceLine, deleteAutoEntries,
} from './data/services'
import { SERVICE_MONTHS } from './lib/serviceCalc'

const DEFAULT_VIEW = {
  sorting: [],
  columnFilters: [],
  columnSizing: {},
  columnOrder: DEFAULT_COLUMN_ORDER,
  columnsVersion: COLUMNS_VERSION,
  globalFilter: '',
  pagination: { pageIndex: 0, pageSize: 50 },
  zoom: 1,
  metricsOpen: false, // Metrics panel collapsed by default
}

const TABS = [
  { id: 'orders', label: 'OS&E Orders' },
  { id: 'services', label: 'Overview' },
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
  const [showTeam, setShowTeam] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [tab, setTabState] = useState(() => localStorage.getItem('florence.tab') || 'orders')
  const setTab = useCallback((t) => {
    localStorage.setItem('florence.tab', t)
    setTabState(t)
  }, [])

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
  const onServiceLineUpdate = useCallback(
    async (id, patch) => {
      const prev = serviceLines
      setServiceLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
      try {
        await updateServiceLine(id, patch)
      } catch (e) {
        console.error('Line update failed', e)
        setServiceLines(prev)
        alert('Could not save. Admins only — or try again.')
      }
    },
    [serviceLines],
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

  // Commit a month's buffered edits in one transaction: adds/updates/deletes
  // (files uploaded here, on commit — so a cancelled modal leaves no orphans),
  // plus an optional month-close plan. ops = { adds, updates, deletes }.
  const onServiceCommit = useCallback(
    async (lineId, month, ops, closePlan) => {
      const label = SERVICE_MONTHS.find((m) => m.key === month)?.label || month
      try {
        for (const a of ops.adds || []) {
          let file_path = null
          let file_name = null
          if (a._file) {
            const up = await uploadServiceFile(a._file)
            file_path = up.path
            file_name = up.name
          }
          await addServiceEntry({
            line_id: lineId, month, type: a.type, title: a.title || '',
            amount_ex_vat: Number(a.amount_ex_vat) || 0, vat_pct: Number(a.vat_pct) || 0, file_path, file_name,
          })
        }
        for (const u of ops.updates || []) {
          const patch = { ...u.patch }
          if (u._file) {
            const up = await uploadServiceFile(u._file)
            patch.file_path = up.path
            patch.file_name = up.name
          }
          if (Object.keys(patch).length) await updateServiceEntry(u.id, patch)
        }
        for (const d of ops.deletes || []) await deleteServiceEntry(d.id, d.file_path)

        if (closePlan) {
          if (closePlan.roll && closePlan.roll.month && Math.round(closePlan.roll.amount) !== 0) {
            await addServiceEntry({
              line_id: lineId, month: closePlan.roll.month, type: 'forecast',
              title: `Rolled forward from ${label}`, amount_ex_vat: Math.round(closePlan.roll.amount), vat_pct: 22, auto_from: month,
            })
          }
          for (const adj of closePlan.adjustments || []) {
            if (Math.round(adj.amount) === 0) continue
            await addServiceEntry({
              line_id: lineId, month: adj.month, type: 'forecast',
              title: `Adjustment from ${label}`, amount_ex_vat: Math.round(adj.amount), vat_pct: 22, auto_from: month,
            })
          }
          await setMonthClose(lineId, month, closePlan.disposition || 'closed')
        }
        await Promise.all([refreshServiceEntries(), refreshServiceCloses()])
      } catch (e) {
        console.error('Commit failed', e)
        alert('Could not save your changes. Please try again.')
      }
    },
    [refreshServiceEntries, refreshServiceCloses],
  )

  const onServiceMonthReopen = useCallback(
    async (lineId, month) => {
      try {
        await deleteAutoEntries(lineId, month)
        await clearMonthClose(lineId, month)
        await Promise.all([refreshServiceEntries(), refreshServiceCloses()])
      } catch (e) {
        console.error('Reopen failed', e)
        alert('Could not reopen the month.')
      }
    },
    [refreshServiceEntries, refreshServiceCloses],
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

  const onSetAdmin = useCallback(async (userId, isAdmin) => {
    try {
      const updated = await setAdmin(userId, isAdmin)
      if (updated) setProfiles((cur) => cur.map((p) => (p.user_id === userId ? updated : p)))
    } catch (e) {
      console.error('Set admin failed', e)
      alert('Could not update admin status (admins only).')
    }
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
        isAdmin={!!myProfile?.is_admin}
        onEditName={() => setShowProfile(true)}
        onInvite={() => setShowInvite(true)}
        onTeam={() => setShowTeam(true)}
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
      ) : (
        <ServicesTab
          lines={serviceLines}
          entriesByLine={serviceEntries}
          closesByLine={serviceCloses}
          items={items}
          isAdmin={!!myProfile?.is_admin}
          people={people}
          onLineUpdate={onServiceLineUpdate}
          onCommit={onServiceCommit}
          onDownload={onServiceDownload}
          onReopen={onServiceMonthReopen}
        />
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
      {showTeam && (
        <TeamModal
          profiles={profiles}
          myUserId={user.id}
          onSetAdmin={onSetAdmin}
          onClose={() => setShowTeam(false)}
        />
      )}
    </div>
  )
}
