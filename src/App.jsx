import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useViewPrefs } from './hooks/useViewPrefs'
import { fetchItems, subscribeItems, updateItem } from './data/items'
import { addCategory, fetchCategories } from './data/categories'
import { DEFAULT_COLUMN_ORDER } from './lib/constants'
import Auth from './components/Auth'
import Header from './components/Header'
import Kpis from './components/Kpis'
import OrdersTable from './components/OrdersTable'
import Summary from './components/Summary'

const DEFAULT_VIEW = {
  sorting: [],
  columnFilters: [],
  columnSizing: {},
  columnOrder: DEFAULT_COLUMN_ORDER,
  globalFilter: '',
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
  const [dataLoading, setDataLoading] = useState(true)
  const [tab, setTab] = useState('orders')

  const { prefs: view, update: setView } = useViewPrefs(!!user, DEFAULT_VIEW)

  // Initial load + realtime refresh when a teammate edits.
  useEffect(() => {
    if (!user) return
    let active = true
    const load = () =>
      Promise.all([fetchItems(), fetchCategories()])
        .then(([its, cats]) => {
          if (!active) return
          setItems(its)
          setCategories(cats.map((c) => c.name))
        })
        .catch((err) => console.error('Load failed', err))
        .finally(() => active && setDataLoading(false))
    load()
    const unsub = subscribeItems(() => load())
    return () => {
      active = false
      unsub()
    }
  }, [user])

  const owners = useMemo(
    () => [...new Set(items.map((i) => i.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  )
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

  if (authLoading) return <div className="center-note">Loading…</div>
  if (!user) return <Auth />

  return (
    <div className="page">
      <Header user={user} />
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
            owners={owners}
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
    </div>
  )
}
