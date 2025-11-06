import { useEffect, useMemo, useRef, useState } from 'react'

/** ---------------- Types ---------------- */
type Assignee = 'Me' | 'Partner' | ''
type Card = { id: string; title: string; assignee?: Exclude<Assignee, ''>; dueDate?: string; done?: boolean }
type Column = { id: string; title: string; cardIds: string[] }
type BoardState = { cards: Record<string, Card>; columns: Record<string, Column>; columnOrder: string[] }
type InfoItem = { id: string; label: string; detail: string }

/** ---------------- Storage Keys ---------------- */
const STORAGE_KEY = 'couples-board'
const INFO_KEY = 'couples-important-info'

/** ---------------- Helpers ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9)

function loadState<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function saveState<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data))
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function dueStatus(card: Card) {
  if (!card.dueDate || card.done) return null as 'overdue' | 'soon' | null
  const now = Date.now()
  const ms = new Date(card.dueDate).getTime() - now
  if (ms <= 0) return 'overdue'
  if (ms <= 1000 * 60 * 60 * 24) return 'soon'
  return null
}

/** ---------------- Initial Sample Data ---------------- */
const initialState: BoardState = {
  cards: {
    c1: { id: 'c1', title: 'Book dentist', assignee: 'Partner', dueDate: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString() },
    c2: { id: 'c2', title: 'Plan date night', assignee: 'Me' },
    c3: { id: 'c3', title: 'Order groceries', dueDate: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString() },
  },
  columns: {
    todo: { id: 'todo', title: 'To Do', cardIds: ['c1', 'c3'] },
    doing: { id: 'doing', title: 'Doing', cardIds: ['c2'] },
    done: { id: 'done', title: 'Done', cardIds: [] },
  },
  columnOrder: ['todo', 'doing', 'done'],
}

const initialInfo: InfoItem[] = [
  { id: uid(), label: 'Pediatrician', detail: 'Dr. Brown – 0207 123 4567' },
  { id: uid(), label: 'School Office', detail: 'Greenwich Primary – 0208 222 1111' },
]

/** ---------------- App ---------------- */
export default function App() {
  const [tab, setTab] = useState<'board' | 'info'>('board')

  // Board state
  const [board, setBoard] = useState<BoardState>(() => loadState<BoardState>(STORAGE_KEY) ?? initialState)
  useEffect(() => saveState(STORAGE_KEY, board), [board])

  // Important Info state
  const [info, setInfo] = useState<InfoItem[]>(() => loadState<InfoItem[]>(INFO_KEY) ?? initialInfo)
  useEffect(() => saveState(INFO_KEY, info), [info])

  // Add card form
  const [newTitle, setNewTitle] = useState('')
  const [assignee, setAssignee] = useState<Assignee>('')
  const [due, setDue] = useState<string>('')

  // Notifications
  const notifiedIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const tick = setInterval(() => {
      Object.values(board.cards).forEach((card) => {
        if (!card.dueDate || card.done) return
        const status = dueStatus(card)
        if (status && !notifiedIdsRef.current.has(card.id)) {
          if ('Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(status === 'overdue' ? 'Task overdue' : 'Task due soon', {
                body: `${card.title} • ${formatDate(card.dueDate)}`,
              })
            }
          }
          notifiedIdsRef.current.add(card.id)
        }
      })
    }, 60000)
    return () => clearInterval(tick)
  }, [board])

  // Prompt for notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const t = setTimeout(() => Notification.requestPermission().catch(() => {}), 1500)
      return () => clearTimeout(t)
    }
  }, [])

  /** --------- Board handlers --------- */
  const addCard = (columnId: string) => {
    if (!newTitle.trim()) return
    const id = uid()
    const card: Card = { id, title: newTitle.trim(), assignee: assignee || undefined, dueDate: due || undefined }
    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: card },
      columns: { ...prev.columns, [columnId]: { ...prev.columns[columnId], cardIds: [id, ...prev.columns[columnId].cardIds] } },
    }))
    setNewTitle('')
    setAssignee('')
    setDue('')
  }

  const toggleDone = (cardId: string) => {
    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId], done: !prev.cards[cardId].done } },
    }))
  }

  const moveCard = (cardId: string, from: string, direction: 'left' | 'right') => {
    const order = board.columnOrder
    const fromIndex = order.indexOf(from)
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= order.length) return
    const to = order[toIndex]
    setBoard((prev) => {
      const fromIds = prev.columns[from].cardIds.filter((id) => id !== cardId)
      const toIds = [cardId, ...prev.columns[to].cardIds]
      return { ...prev, columns: { ...prev.columns, [from]: { ...prev.columns[from], cardIds: fromIds }, [to]: { ...prev.columns[to], cardIds: toIds } } }
    })
  }

  const clearBoard = () => {
    localStorage.removeItem(STORAGE_KEY)
    setBoard(initialState)
    notifiedIdsRef.current.clear()
  }

  /** --------- Info handlers --------- */
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const addInfo = () => {
    if (!label.trim() || !detail.trim()) return
    setInfo((prev) => [{ id: uid(), label: label.trim(), detail: detail.trim() }, ...prev])
    setLabel('')
    setDetail('')
  }
  const deleteInfo = (id: string) => setInfo((prev) => prev.filter((x) => x.id !== id))
  const resetInfo = () => {
    localStorage.removeItem(INFO_KEY)
    setInfo(initialInfo)
  }

  /** --------- Derived --------- */
  const columns = useMemo(() => board.columnOrder.map((id) => board.columns[id]), [board])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Trello Board for Couples 💞</h1>
          <nav className="flex gap-1 rounded-xl p-1 bg-gray-100">
            <button onClick={() => setTab('board')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'board' ? 'bg-white border shadow-sm' : ''}`}>
              Board
            </button>
            <button onClick={() => setTab('info')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'info' ? 'bg-white border shadow-sm' : ''}`}>
              Important Info
            </button>
          </nav>
        </div>
      </header>

      {tab === 'board' ? (
        <>
          {/* Add card */}
          <div className="mx-auto max-w-6xl px-4 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input className="rounded-lg border px-3 py-2 sm:col-span-2" placeholder="Add a task (e.g., Renew passports)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <select className="rounded-lg border px-3 py-2" value={assignee} onChange={(e) => setAssignee(e.target.value as Assignee)}>
                <option value="">No assignee</option>
                <option value="Me">Me</option>
                <option value="Partner">Partner</option>
              </select>
              <input type="datetime-local" className="rounded-lg border px-3 py-2" value={due} onChange={(e) => setDue(e.target.value)} />
              <div className="sm:col-span-4 flex gap-2">
                <button onClick={() => addCard('todo')} className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90">Add to “To Do”</button>
                <button onClick={clearBoard} className="text-sm rounded-lg border px-3 py-2 hover:bg-gray-100">Reset demo</button>
              </div>
            </div>
          </div>

          {/* Columns */}
          <main className="mx-auto max-w-6xl px-4 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {columns.map((col) => {
                const cards = col.cardIds.map((id) => board.cards[id])
                return (
                  <section key={col.id} className="rounded-2xl bg-white border shadow-sm">
                    <h2 className="px-4 py-3 font-medium border-b">{col.title}</h2>
                    <ul className="p-3 space-y-3">
                      {cards.length === 0 && <li className="text-sm text-gray-400 px-2 py-6 text-center">No cards</li>}
                      {cards.map((card) => {
                        const status = dueStatus(card)
                        return (
                          <li key={card.id} className="rounded-xl border px-3 py-2 bg-white shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`font-medium ${card.done ? 'line-through text-gray-400' : ''}`}>{card.title}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                                  {card.assignee && <span className="rounded-md border px-2 py-0.5 text-gray-600">Assignee: {card.assignee}</span>}
                                  {card.dueDate && (
                                    <span className={`rounded-md px-2 py-0.5 border ${status === 'overdue' ? 'border-red-300 bg-red-50 text-red-700' : status === 'soon' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'text-gray-600'}`}>
                                      Due: {formatDate(card.dueDate)}
                                      {status === 'overdue' ? ' • Overdue' : status === 'soon' ? ' • Due soon' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => moveCard(card.id, col.id, 'left')} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50" title="Move left">◀</button>
                                <button onClick={() => moveCard(card.id, col.id, 'right')} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50" title="Move right">▶</button>
                                <button onClick={() => toggleDone(card.id)} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50" title="Mark done/undone">✓</button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          </main>

          <footer className="text-center text-xs text-gray-400 pb-8">Tasks & info are saved in your browser (localStorage). For background alerts, we’ll add push later.</footer>
        </>
      ) : (
        /* -------- Important Info Tab -------- */
        <main className="mx-auto max-w-4xl px-4 py-6">
          <h2 className="text-lg font-medium mb-3">Important Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input className="rounded-lg border px-3 py-2" placeholder="Label (e.g., Pediatrician)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input className="rounded-lg border px-3 py-2 md:col-span-2" placeholder="Detail (name, phone, notes)" value={detail} onChange={(e) => setDetail(e.target.value)} />
            <div className="md:col-span-3 flex gap-2">
              <button onClick={addInfo} className="rounded-lg bg-black text-white px-4 py-2 hover:opacity-90">Add</button>
              <button onClick={resetInfo} className="text-sm rounded-lg border px-3 py-2 hover:bg-gray-100">Reset demo</button>
            </div>
          </div>

          <ul className="space-y-2">
            {info.length === 0 && <li className="text-sm text-gray-400">No info yet.</li>}
            {info.map((item) => (
              <li key={item.id} className="rounded-xl border bg-white px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-gray-600 break-words">{item.detail}</p>
                </div>
                <button onClick={() => deleteInfo(item.id)} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">Delete</button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mt-4">Tip: For sensitive details, we’ll add encryption + accounts later so it syncs securely across devices.</p>
        </main>
      )}
    </div>
  )
}
