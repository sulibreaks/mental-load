import { useEffect, useMemo, useState } from 'react'

// ---- Types
type Card = { id: string; title: string; assignee?: 'Me' | 'Partner' }
type Column = { id: string; title: string; cardIds: string[] }
type BoardState = {
  cards: Record<string, Card>
  columns: Record<string, Column>
  columnOrder: string[]
}

const STORAGE_KEY = 'couples-board'

// ---- Helpers
const uid = () => Math.random().toString(36).slice(2, 9)

function loadState(): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as BoardState) : null
  } catch {
    return null
  }
}

function saveState(state: BoardState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ---- Initial sample data (first run only)
const initialState: BoardState = {
  cards: {
    c1: { id: 'c1', title: 'Book dentist', assignee: 'Partner' },
    c2: { id: 'c2', title: 'Plan date night', assignee: 'Me' },
    c3: { id: 'c3', title: 'Order groceries' },
  },
  columns: {
    todo: { id: 'todo', title: 'To Do', cardIds: ['c1', 'c3'] },
    doing: { id: 'doing', title: 'Doing', cardIds: ['c2'] },
    done: { id: 'done', title: 'Done', cardIds: [] },
  },
  columnOrder: ['todo', 'doing', 'done'],
}

export default function App() {
  const [board, setBoard] = useState<BoardState>(() => loadState() ?? initialState)
  const [newTitleByCol, setNewTitleByCol] = useState<Record<string, string>>({})
  const [assigneeByCol, setAssigneeByCol] = useState<Record<string, Card['assignee']>>({})

  useEffect(() => {
    saveState(board)
  }, [board])

  const columns = useMemo(() => board.columnOrder.map((id) => board.columns[id]), [board])

  function addCard(columnId: string) {
    const title = (newTitleByCol[columnId] || '').trim()
    if (!title) return
    const id = uid()
    const assignee = assigneeByCol[columnId]
    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: { id, title, assignee } },
      columns: {
        ...prev.columns,
        [columnId]: { ...prev.columns[columnId], cardIds: [id, ...prev.columns[columnId].cardIds] },
      },
    }))
    setNewTitleByCol((m) => ({ ...m, [columnId]: '' }))
  }

  function moveCard(cardId: string, fromId: string, toId: string, toIndex: number) {
    if (fromId === toId) return
    setBoard((prev) => {
      const from = prev.columns[fromId]
      const to = prev.columns[toId]
      const nextFromIds = from.cardIds.filter((id) => id !== cardId)
      const nextToIds = [...to.cardIds]
      nextToIds.splice(toIndex, 0, cardId)
      return {
        ...prev,
        columns: {
          ...prev.columns,
          [fromId]: { ...from, cardIds: nextFromIds },
          [toId]: { ...to, cardIds: nextToIds },
        },
      }
    })
  }

  function moveInline(cardId: string, columnId: string, direction: -1 | 1) {
    setBoard((prev) => {
      const col = prev.columns[columnId]
      const idx = col.cardIds.indexOf(cardId)
      const targetIdx = idx + direction
      if (idx < 0 || targetIdx < 0 || targetIdx >= col.cardIds.length) return prev
      const nextIds = [...col.cardIds]
      const [item] = nextIds.splice(idx, 1)
      nextIds.splice(targetIdx, 0, item)
      return { ...prev, columns: { ...prev.columns, [columnId]: { ...col, cardIds: nextIds } } }
    })
  }

  function cycleColumn(cardId: string, fromId: string, direction: -1 | 1) {
    const order = board.columnOrder
    const fromIdx = order.indexOf(fromId)
    const toIdx = fromIdx + direction
    if (toIdx < 0 || toIdx >= order.length) return
    moveCard(cardId, fromId, order[toIdx], 0)
  }

  function setCardAssignee(cardId: string, assignee: Card['assignee']) {
    setBoard((prev) => ({ ...prev, cards: { ...prev.cards, [cardId]: { ...prev.cards[cardId], assignee } } }))
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Couples Board</h1>
          <div className="text-sm text-slate-500">Shared tasks for Me and Partner</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <section key={col.id} className="w-80 shrink-0">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200">
                  <h2 className="font-medium">{col.title}</h2>
                  <span className="text-xs text-slate-500">{col.cardIds.length}</span>
                </div>

                <div className="px-3 py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring focus:ring-slate-200"
                      placeholder="Add a card..."
                      value={newTitleByCol[col.id] || ''}
                      onChange={(e) => setNewTitleByCol((m) => ({ ...m, [col.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addCard(col.id)
                      }}
                    />
                    <select
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={assigneeByCol[col.id] || ''}
                      onChange={(e) =>
                        setAssigneeByCol((m) => ({ ...m, [col.id]: (e.target.value || undefined) as Card['assignee'] }))
                      }
                    >
                      <option value="">Anyone</option>
                      <option value="Me">Me</option>
                      <option value="Partner">Partner</option>
                    </select>
                    <button
                      className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                      onClick={() => addCard(col.id)}
                    >
                      Add
                    </button>
                  </div>

                  <ul className="space-y-2">
                    {col.cardIds.map((cardId) => {
                      const card = board.cards[cardId]
                      return (
                        <li key={card.id} className="rounded border border-slate-200 bg-white shadow-sm">
                          <div className="px-3 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-medium">{card.title}</div>
                                <div className="mt-1">
                                  <label className="text-xs text-slate-500 mr-2">Assignee</label>
                                  <select
                                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                                    value={card.assignee || ''}
                                    onChange={(e) =>
                                      setCardAssignee(card.id, (e.target.value || undefined) as Card['assignee'])
                                    }
                                  >
                                    <option value="">Anyone</option>
                                    <option value="Me">Me</option>
                                    <option value="Partner">Partner</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <button
                                    className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                                    onClick={() => cycleColumn(card.id, col.id, -1)}
                                    title="Move left"
                                  >
                                    ←
                                  </button>
                                  <button
                                    className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                                    onClick={() => cycleColumn(card.id, col.id, 1)}
                                    title="Move right"
                                  >
                                    →
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                                    onClick={() => moveInline(card.id, col.id, -1)}
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                                    onClick={() => moveInline(card.id, col.id, 1)}
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
