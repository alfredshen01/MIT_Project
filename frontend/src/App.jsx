import { useEffect, useState } from 'react'
import { Calendar, dayjsLocalizer } from 'react-big-calendar'
import dayjs from 'dayjs'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const localizer = dayjsLocalizer(dayjs)

function App() {
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', date: '', start_time: '', end_time: '' })

  const fetchEvents = () => {
    fetch('http://localhost:8000/events')
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(e => ({
          id: e.id,
          title: e.title,
          start: new Date(`${e.date}T${e.start_time || '00:00:00'}`),
          end: new Date(`${e.date}T${e.end_time || '23:59:00'}`),
        }))
        setEvents(formatted)
      })
  }

  useEffect(() => { fetchEvents() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    fetch('http://localhost:8000/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(() => {
      fetchEvents()
      setShowForm(false)
      setForm({ title: '', description: '', date: '', start_time: '', end_time: '' })
    })
  }

  const handleDelete = (event) => {
    if (!confirm(`刪除「${event.title}」？`)) return
    fetch(`http://localhost:8000/events/${event.id}`, { method: 'DELETE' })
      .then(() => fetchEvents())
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>MIT Project 日曆</h1>
      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: '1rem' }}>
        {showForm ? '取消' : '+ 新增事件'}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="標題" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input placeholder="描述" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          <button type="submit">新增</button>
        </form>
      )}

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        onSelectEvent={handleDelete}
      />
    </div>
  )
}

export default App
