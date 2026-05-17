import { useEffect, useState } from 'react'
import { Calendar, dayjsLocalizer } from 'react-big-calendar'
import dayjs from 'dayjs'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dayjsLocalizer(dayjs)
const API = 'http://localhost:8000'

function App() {
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', date: '', start_time: '', end_time: '' })
  const [selectedEvent, setSelectedEvent] = useState(null)

  const fetchEvents = () => {
    fetch(`${API}/events`)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          start: new Date(`${e.date}T${e.start_time || '00:00:00'}`),
          end: new Date(`${e.date}T${e.end_time || '23:59:00'}`),
        }))
        setEvents(formatted)
      })
  }

  useEffect(() => { fetchEvents() }, [])

  const openCreateForm = (slotInfo) => {
    setEditingId(null)
    setForm({ title: '', description: '', date: dayjs(slotInfo.start).format('YYYY-MM-DD'), start_time: '', end_time: '' })
    setShowForm(true)
    setSelectedEvent(null)
  }

  const openEditForm = (event) => {
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description || '',
      date: event.date,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
    })
    setShowForm(true)
    setSelectedEvent(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', description: '', date: '', start_time: '', end_time: '' })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const url = editingId ? `${API}/events/${editingId}` : `${API}/events`
    fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(() => {
      fetchEvents()
      closeForm()
    })
  }

  const handleDelete = (event) => {
    if (!confirm(`刪除「${event.title}」？`)) return
    fetch(`${API}/events/${event.id}`, { method: 'DELETE' })
      .then(() => {
        fetchEvents()
        setSelectedEvent(null)
      })
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>MIT Project 日曆</h1>
      <button onClick={() => showForm ? closeForm() : openCreateForm({ start: new Date() })} style={{ marginBottom: '1rem' }}>
        {showForm ? '取消' : '+ 新增事件'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="標題" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input placeholder="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          <button type="submit">{editingId ? '儲存' : '新增'}</button>
          <button type="button" onClick={closeForm}>取消</button>
        </form>
      )}

      {selectedEvent && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', minWidth: '300px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>{selectedEvent.title}</h2>
            {selectedEvent.description && <p>{selectedEvent.description}</p>}
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              {selectedEvent.date}
              {selectedEvent.start_time && ` ${selectedEvent.start_time}`}
              {selectedEvent.end_time && ` – ${selectedEvent.end_time}`}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => openEditForm(selectedEvent)}>編輯</button>
              <button onClick={() => handleDelete(selectedEvent)} style={{ color: 'red' }}>刪除</button>
              <button onClick={() => setSelectedEvent(null)}>關閉</button>
            </div>
          </div>
        </div>
      )}

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        selectable
        onSelectSlot={openCreateForm}
        onSelectEvent={setSelectedEvent}
      />
    </div>
  )
}

export default App
