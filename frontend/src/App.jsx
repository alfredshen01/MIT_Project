import { useRef, useState } from 'react'
import { Button, Space, Typography, Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import './App.css'
import Login from './Login'

const { Title, Text } = Typography
const { Dragger } = Upload
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [preview, setPreview] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  const [resultFilename, setResultFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    reset()
  }

  const reset = () => {
    setPreview(null)
    setResultUrl(null)
    setResultFilename('')
  }

  const handleFile = (file) => {
    if (!ACCEPTED.includes(file.type)) {
      message.error('只接受圖片檔案（JPEG、PNG、WebP、GIF、BMP）')
      return false
    }
    reset()
    setPreview(URL.createObjectURL(file))
    convert(file)
    return false  // 阻止 antd Upload 自動上傳
  }

  const convert = async (file) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API}/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (res.status === 401) {
        handleLogout()
        return
      }
      if (!res.ok) {
        const err = await res.json()
        message.error(err.detail || '轉換失敗')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : 'bw.png'
      setResultUrl(URL.createObjectURL(blob))
      setResultFilename(filename)
    } catch {
      message.error('連線失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '2rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <Title level={2} style={{ margin: 0 }}>彩色轉黑白</Title>
          <Button onClick={handleLogout}>登出</Button>
        </div>

        <Dragger
          accept={ACCEPTED.join(',')}
          showUploadList={false}
          beforeUpload={handleFile}
          style={{ marginBottom: '2rem' }}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">點擊或拖曳圖片至此</p>
          <p className="ant-upload-hint">支援 JPEG、PNG、WebP、GIF、BMP，單檔最大 10 MB</p>
        </Dragger>

        {(preview || resultUrl) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {preview && (
              <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>原圖</Text>
                <img src={preview} alt="原圖" style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ background: '#fff', borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>黑白結果</Text>
              {loading ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  轉換中...
                </div>
              ) : resultUrl ? (
                <>
                  <img src={resultUrl} alt="黑白" style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', display: 'block', margin: '0 auto 1rem' }} />
                  <Space>
                    <a href={resultUrl} download={resultFilename}>
                      <Button type="primary">下載黑白圖片</Button>
                    </a>
                    <Button onClick={reset}>清除</Button>
                  </Space>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
