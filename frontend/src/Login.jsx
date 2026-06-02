import { useState } from 'react'
import { Button, Form, Input, Tabs, message } from 'antd'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const handleSubmit = async (endpoint) => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '發生錯誤')
        return
      }
      if (endpoint === 'login') {
        onLogin(data.token)
      } else {
        message.success('註冊成功，請登入')
        form.resetFields()
      }
    } finally {
      setLoading(false)
    }
  }

  const fields = (
    <Form form={form} layout="vertical">
      <Form.Item name="username" label="帳號" rules={[{ required: true, message: '請輸入帳號' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="password" label="密碼" rules={[{ required: true, message: '請輸入密碼' }]}>
        <Input.Password />
      </Form.Item>
    </Form>
  )

  const items = [
    {
      key: 'login',
      label: '登入',
      children: (
        <div>
          {fields}
          <Button type="primary" block loading={loading} onClick={() => handleSubmit('login')}>登入</Button>
        </div>
      ),
    },
    {
      key: 'register',
      label: '註冊',
      children: (
        <div>
          {fields}
          <Button type="primary" block loading={loading} onClick={() => handleSubmit('register')}>註冊</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="login-shell">
      <div className="login-card">
        <span className="eyebrow">Grayscale Converter</span>
        <h2 className="brand-title">彩色轉黑白</h2>
        <Tabs items={items} onChange={() => form.resetFields()} />
      </div>
    </div>
  )
}
