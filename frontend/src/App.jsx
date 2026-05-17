import { useEffect, useState } from 'react'
import { Calendar, dayjsLocalizer } from 'react-big-calendar'
import dayjs from 'dayjs'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Button, Modal, Form, Input, TimePicker, DatePicker, Space } from 'antd'
import './App.css'

const localizer = dayjsLocalizer(dayjs)
const API = 'http://localhost:8000'

export default function App() {
  const [events, setEvents] = useState([])
  const [formOpen, setFormOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [form] = Form.useForm()

  const fetchEvents = () => {
    fetch(`${API}/events`)
      .then(res => res.json())
      .then(data => {
        setEvents(data.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          date: e.date,
          start_time: e.start_time,
          end_time: e.end_time,
          start: new Date(`${e.date}T${e.start_time || '00:00:00'}`),
          end: new Date(`${e.date}T${e.end_time || '23:59:00'}`),
        })))
      })
  }

  useEffect(() => { fetchEvents() }, [])

  const openCreate = (slotInfo) => {
    setEditingId(null)
    form.setFieldsValue({
      title: '',
      description: '',
      date: dayjs(slotInfo.start),
      start_time: null,
      end_time: null,
    })
    setFormOpen(true)
    setDetailOpen(false)
  }

  const openEdit = () => {
    form.setFieldsValue({
      title: selectedEvent.title,
      description: selectedEvent.description || '',
      date: dayjs(selectedEvent.date),
      start_time: selectedEvent.start_time ? dayjs(selectedEvent.start_time, 'HH:mm:ss') : null,
      end_time: selectedEvent.end_time ? dayjs(selectedEvent.end_time, 'HH:mm:ss') : null,
    })
    setEditingId(selectedEvent.id)
    setDetailOpen(false)
    setFormOpen(true)
  }

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const payload = {
        title: values.title,
        description: values.description || '',
        date: values.date.format('YYYY-MM-DD'),
        start_time: values.start_time ? values.start_time.format('HH:mm:ss') : '',
        end_time: values.end_time ? values.end_time.format('HH:mm:ss') : '',
      }
      const url = editingId ? `${API}/events/${editingId}` : `${API}/events`
      fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(() => {
        fetchEvents()
        setFormOpen(false)
        setEditingId(null)
        form.resetFields()
      })
    })
  }

  const handleDelete = () => {
    Modal.confirm({
      title: `刪除「${selectedEvent.title}」？`,
      okText: '刪除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        fetch(`${API}/events/${selectedEvent.id}`, { method: 'DELETE' })
          .then(() => {
            fetchEvents()
            setDetailOpen(false)
          })
      },
    })
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>MIT Project 日曆</h1>
        <Button type="primary" onClick={() => openCreate({ start: new Date() })}>+ 新增事件</Button>
      </div>

      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        selectable
        onSelectSlot={openCreate}
        onSelectEvent={e => { setSelectedEvent(e); setDetailOpen(true) }}
      />

      {/* 新增 / 編輯 Modal */}
      <Modal
        title={editingId ? '編輯事件' : '新增事件'}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={() => { setFormOpen(false); setEditingId(null); form.resetFields() }}
        okText={editingId ? '儲存' : '新增'}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="標題" rules={[{ required: true, message: '請輸入標題' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true, message: '請選擇日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Form.Item name="start_time" label="開始時間">
              <TimePicker format="HH:mm" />
            </Form.Item>
            <Form.Item name="end_time" label="結束時間">
              <TimePicker format="HH:mm" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 事件詳情 Modal */}
      <Modal
        title={selectedEvent?.title}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          <Space>
            <Button onClick={openEdit}>編輯</Button>
            <Button danger onClick={handleDelete}>刪除</Button>
            <Button onClick={() => setDetailOpen(false)}>關閉</Button>
          </Space>
        }
      >
        {selectedEvent?.description && <p>{selectedEvent.description}</p>}
        <p style={{ color: '#888' }}>
          {selectedEvent?.date}
          {selectedEvent?.start_time && ` ${selectedEvent.start_time}`}
          {selectedEvent?.end_time && ` – ${selectedEvent.end_time}`}
        </p>
      </Modal>
    </div>
  )
}
