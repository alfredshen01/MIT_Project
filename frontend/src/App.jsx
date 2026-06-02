import { useEffect, useState } from 'react'
import { Button, Dropdown, Modal, Space, Upload, message } from 'antd'
import { InboxOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons'
import './App.css'
import Login from './Login'

const { Dragger } = Upload
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']

// 分類系統:目前只有「彩色轉黑白」,日後新功能在這裡加一個項目即可
const CATEGORIES = [
  { key: 'grayscale', label: '彩色轉黑白' },
]

// 下載格式選單(無損 PNG / 有損 JPG)
const DOWNLOAD_FORMATS = [
  { key: 'png', label: '無損 PNG（檔案大、最高畫質）' },
  { key: 'jpeg', label: '有損 JPG（檔案小、下載快）' },
]

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [category, setCategory] = useState('grayscale')
  const [files, setFiles] = useState([])
  const [preview, setPreview] = useState(null)       // 原圖(本機顯示)
  const [resultUrl, setResultUrl] = useState(null)   // 黑白結果預覽(有損 JPEG)
  const [resultId, setResultId] = useState(null)
  const [resultBase, setResultBase] = useState('')   // 下載檔名(不含副檔名)
  const [loading, setLoading] = useState(false)

  const authFetch = (path, opts = {}) =>
    fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    reset()
    setFiles([])
  }

  const reset = () => {
    setPreview(null)
    setResultUrl(null)
    setResultId(null)
    setResultBase('')
  }

  const fetchFiles = () => {
    authFetch(`/files?category=${category}`)
      .then(res => {
        if (res.status === 401) { handleLogout(); return null }
        return res.json()
      })
      .then(data => { if (data) setFiles(data) })
      .catch(() => {})
  }

  useEffect(() => {
    if (token) fetchFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, category])

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
      const res = await authFetch('/convert', { method: 'POST', body: formData })
      if (res.status === 401) { handleLogout(); return }
      if (!res.ok) {
        const detail = await res.json().then(e => e.detail).catch(() => null)
        message.error(detail || `轉換失敗(伺服器回應 ${res.status})`)
        return
      }
      const blob = await res.blob()  // 有損 JPEG 預覽
      setResultUrl(URL.createObjectURL(blob))
      setResultId(res.headers.get('X-File-Id'))
      setResultBase(`${file.name.replace(/\.[^.]+$/, '')}_bw`)
      fetchFiles()  // 轉好後重新載入該分類的檔案清單
    } catch {
      message.error('連線失敗,請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  // 以指定格式下載某個已存檔案
  const downloadById = async (id, format, filename) => {
    const res = await authFetch(`/files/${id}/download?format=${format}`)
    if (!res.ok) { message.error('下載失敗'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteFile = (f) => {
    Modal.confirm({
      title: `刪除「${f.original_name}」?`,
      okText: '刪除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await authFetch(`/files/${f.id}`, { method: 'DELETE' })
        fetchFiles()
      },
    })
  }

  if (!token) return <Login onLogin={handleLogin} />

  const activeLabel = CATEGORIES.find(c => c.key === category)?.label || ''

  // 依檔案與格式產生下載選單
  const downloadMenu = (id, base) => ({
    items: DOWNLOAD_FORMATS,
    onClick: ({ key }) => downloadById(id, key, `${base}.${key === 'png' ? 'png' : 'jpg'}`),
  })

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">Final_Project</div>
        <span className="eyebrow">Folders</span>
        <nav className="folder-list">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`folder-item${c.key === category ? ' active' : ''}`}
              onClick={() => { setCategory(c.key); reset() }}
            >
              {c.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <div className="topbar">
          <div>
            <span className="eyebrow">功能</span>
            <h1 className="brand-title">{activeLabel}</h1>
          </div>
          <Button onClick={handleLogout}>登出</Button>
        </div>

        <Dragger accept={ACCEPTED.join(',')} showUploadList={false} beforeUpload={handleFile}>
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
                      <Button type="primary" onClick={() => downloadById(resultId, 'png', `${resultBase}.png`)}>
                        下載無損 PNG
                      </Button>
                      <Button onClick={() => downloadById(resultId, 'jpeg', `${resultBase}.jpg`)}>
                        下載有損 JPG
                      </Button>
                      <Button onClick={reset}>清除</Button>
                    </Space>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        <section className="files-section">
          <span className="eyebrow">已儲存的檔案 · {files.length}</span>
          {files.length === 0 ? (
            <p className="files-empty">這個資料夾還沒有檔案,轉換一張圖片就會出現在這裡。</p>
          ) : (
            <ul className="file-list">
              {files.map(f => {
                const base = f.original_name.replace(/\.[^.]+$/, '')
                return (
                  <li key={f.id} className="file-row">
                    <div className="file-meta">
                      <span className="file-name">{f.original_name}</span>
                      <span className="file-date">{new Date(f.created_at).toLocaleString()}</span>
                    </div>
                    <Space>
                      <Dropdown menu={downloadMenu(f.id, base)} trigger={['click']}>
                        <Button size="small" icon={<DownloadOutlined />}>下載 ▾</Button>
                      </Dropdown>
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteFile(f)} />
                    </Space>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
