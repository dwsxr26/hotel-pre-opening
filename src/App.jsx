import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useViewPrefs } from './hooks/useViewPrefs'
import { fetchItems, subscribeItems, updateItem } from './data/items'
import { addCategory, fetchCategories } from './data/categories'
import { ensureMyProfile, fetchProfiles, updateMyProfile } from './data/profiles'
import { DEFAULT_COLUMN_ORDER } from './lib/constants'
import { displayName } from './lib/people'
import Auth from './components/Auth'
import Header from './components/Header'
import Kpis from './components/Kpis'
import OrdersTable from './components/OrdersTable'
import Summary from './components/Summary'
import ProfileModal from './components/ProfileModal'
import InviteModal from './components/InviteModal'

const DEFAULT_VIEW = {
  sorting: [],
  columnFilters: [],
  columnSizing: {},
  columnOrder: DEFAULT_COLUMN_ORDER,
  globalFilter: '',
  pagination: { pageIndex: 0, pageSize: 50 },
  summaryOpen: true,
}

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'owner', label: 'Summary by owner' },
  { id: 'supplier', label: 'Summary by supplier' },
]

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
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
      Promise.all([fetchItems(), fetchCategories(), fetchProfiles()])
        .then(([its, cats, profs]) => {
          if (!active) return
          setItems(its)
          setCategories(cats.map((c) => c.name))
          setProfiles(profs)
        })
        .catch((err) => console.error('Load failed', err))
        .finally(() => active && setDataLoading(false))
    load()
    // Make sure this user has a profile; prompt for a name if it's blank.
    ensureMyProfile()
      .then((mine) => {
        if (!active || !mine) return
        setMyProfile(mine)
        if (!mine.first_name) setShowProfile(true)
      })
      .catch((err) => console.error('Profile load failed', err))
    const unsub = subscribeItems(() => load())
    return () => {
      active = false
      unsub()
    }
  }, [user])

  // Team members shown in the Owner dropdown, as "First L." display names,
  // plus any legacy owner values still present on items (e.g. "Person_1").
  const people = useMemo(() => {
    const fromProfiles = profiles.map(displayName).filter(Boolean)
    const legacy = items.map((i) => i.owner).filter(Boolean)
    return [...new Set([...fromProfiles, ...legacy])].sort((a, b) => a.localeCompare(b))
  }, [profiles, items])

  const suppliers = useMemo(
    () => [...new Set(items.map((i) => i.supplier).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  // Optimistic edit: patch locally, then persist. Revert on failure.
  const onEdit = useCallback(async (id, patch) => {
    let prev
    setItems((cur) =>
      cur.map((r) => {
        if (r.id === id) {
          prev = r
          return { ...r, ...patch }
        }
        return r
      }),
    )
    try {
      await updateItem(id, patch)
    } catch (err) {
      console.error('Save failed', err)
      if (prev) setItems((cur) => cur.map((r) => (r.id === id ? prev : r)))
      alert('Could not save that change. Please try again.')
    }
  }, [])

  const onAddCategory = useCallback(async (name) => {
    const created = await addCategory(name)
    if (created) setCategories((cur) => (cur.includes(created.name) ? cur : [...cur, created.name].sort()))
    return created
  }, [])

  const onSaveProfile = useCallback(async ({ first_name, last_name }) => {
    const updated = await updateMyProfile({ first_name, last_name })
    if (updated) {
      setMyProfile(updated)
      setProfiles((cur) => {
        const rest = cur.filter((p) => p.user_id !== updated.user_id)
        return [...rest, updated].sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''))
      })
    }
    return updated
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
      <Kpis items={items} />

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
            people={people}
            suppliers={suppliers}
            view={view}
            setView={setView}
            onEdit={onEdit}
            onAddCategory={onAddCategory}
          />
        </>
      ) : tab === 'owner' ? (
        <Summary items={items} groupKey="owner" groupLabel="Owner" blankLabel="Unassigned" />
      ) : (
        <Summary items={items} groupKey="supplier" groupLabel="Supplier" blankLabel="(No supplier)" />
      )}

      {showProfile && (
        <ProfileModal
          profile={myProfile}
          required={!myProfile?.first_name}
          onSave={onSaveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
