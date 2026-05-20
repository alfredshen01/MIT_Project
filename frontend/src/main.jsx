import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#5a9a5a',
        colorBorder: '#a0c8a0',
        colorBorderSecondary: '#b8d8b0',
      }
    }}>
      <App />
    </ConfigProvider>
  </StrictMode>,
)
