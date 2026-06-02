import { useState } from 'react'
import { Button, Space, Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import './App.css'
import Login from './Login'

const { Dragger } = Upload
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [preview, setPreview] = useState(null)
  const [resultUrl, setResultUrl] = useState(null)
  const [resultFilename, setResultFilename] = useState('')
  const [loading, setLoading] = useState(false)

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
        // 後端正常時會回 JSON 錯誤;若是 nginx 502/413 等非 JSON 回應則給通用訊息
        const detail = await res.json().then(e => e.detail).catch(() => null)
        message.error(detail || `轉換失敗(伺服器回應 ${res.status})`)
        return
      }
      const blob = await res.blob()
      // 下載檔名直接由原檔名推算,保留中文等字元,不依賴 HTTP header
      const base = file.name.replace(/\.[^.]+$/, '')
      setResultUrl(URL.createObjectURL(blob))
      setResultFilename(`${base}_bw.png`)
    } catch {
      message.error('連線失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div className="shell">
      <div className="container">
        <div className="topbar">
          <div>
            <span className="eyebrow">Grayscale Converter</span>
            <h1 className="brand-title">彩色轉黑白</h1>
          </div>
          <Button onClick={handleLogout}>登出</Button>
        </div>

        <Dragger
          accept={ACCEPTED.join(',')}
          showUploadList={false}
          beforeUpload={handleFile}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">點擊或拖曳圖片至此</p>
          <p className="ant-upload-hint">支援 JPEG、PNG、WebP、GIF、BMP，單檔最大 10 MB</p>
        </Dragger>

        {(preview || resultUrl) && (
          <div className="result-grid">
            {preview && (
              <div className="panel">
                <span className="panel-label">原圖</span>
                <img className="panel-img" src={preview} alt="原圖" />
              </div>
            )}
            <div className="panel">
              <span className="panel-label">黑白結果</span>
              {loading ? (
                <div className="panel-loading">轉換中…</div>
              ) : resultUrl ? (
                <>
                  <img className="panel-img" src={resultUrl} alt="黑白" />
                  <div className="panel-actions">
                    <Space>
                      <a href={resultUrl} download={resultFilename}>
                        <Button type="primary">下載黑白圖片</Button>
                      </a>
                      <Button onClick={reset}>清除</Button>
                    </Space>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
