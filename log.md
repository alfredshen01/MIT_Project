# 學習進度記錄

---

## 2026-05-16

### 學到的概念

**專案整體架構複習**
- 三層架構：前端（React :5173）→ 後端（FastAPI :8000）→ 資料庫（PostgreSQL :5432）
- Pydantic BaseModel：自動驗證前端傳來的 JSON，欄位不符直接回 400 錯誤
- SQLAlchemy engine：Python 連線 PostgreSQL 的「連線池」，送 SQL 指令用
- REST 設計風格：用 HTTP 方法（GET/POST/PUT/DELETE）對應 CRUD 操作
- React useState：state 變了畫面自動更新，不用手動操作 DOM
- useEffect + fetch：元件載入時自動從後端拉資料（空依賴 `[]` = 只執行一次）

**CORS 深入理解**
- CORS = Cross-Origin Resource Sharing，跨來源資源共享
- 「來源」定義：協定 + 網域 + port，三者都相同才算同源
- 同源政策是**瀏覽器**內建的安全機制，curl 等非瀏覽器工具不受限制
- 流程：瀏覽器先送 Preflight（OPTIONS）帶 `Origin` header → 後端回應允許的來源 → 瀏覽器比對決定是否放行
- 沒設 CORS 的結果：請求可能有送到後端，但瀏覽器把回應藏起來，JS 拿不到資料
- 簡單請求（GET/POST + 無自訂 header）不需要 Preflight，但回應仍可能被擋
- 上線時 `allow_origins` 要改成真實網址，不能用 `"*"`

**CORS 保護的安全場景（CSRF 攻擊）**
- 攻擊前提：使用者登入銀行後，cookie 留在瀏覽器；此時被騙開了 evil.com
- evil.com 的 JS 在使用者瀏覽器上執行，可以呼叫 fetch() 發送請求
- 瀏覽器送跨來源請求時會自動夾帶目標網站的 cookie（evil.com 讀不到但瀏覽器會帶）
- 同源政策阻止 evil.com 冒充使用者打 bank.com 的 API
- 駭客用 curl 直接打不行，因為沒有使用者的 cookie，後端回 401

**curl**
- 命令列 HTTP 工具，可直接送請求並印出回應，常用來測試 API
- 不是瀏覽器，不受同源政策限制

---

## 2026-05-11

### 完成項目
- Git 初始化，連接 GitHub remote（`main` 分支）
- 安裝 uv，建立 Python 虛擬環境
- 安裝 FastAPI + uvicorn，建立基本 API（`/`、`/db-test`）
- 安裝 PostgreSQL，建立 `mit_project` 資料庫
- 安裝 SQLAlchemy + psycopg2，FastAPI 成功連線 PostgreSQL
- 安裝 Node.js v22，用 Vite 建立 React 前端專案
- 前端透過 fetch 呼叫後端 API，成功串接前後端
- 建立 `events` 資料表，實作日曆應用 CRUD API
- 安裝 react-big-calendar + dayjs，完成月曆 UI
- 測試新增事件、刪除事件功能正常

### 學到的概念
- Docker 網路：`docker network create` 建立自訂子網，容器間用名稱互訪
- HTTP 方法：GET / POST / PUT / DELETE 對應 CRUD
- uv vs npm：Python 套件與 JS 套件是獨立環境
- Vite HMR：程式碼變更後瀏覽器自動更新
- CORS：前後端跨 port 呼叫需要在後端設定允許來源

### 下次待辦
- [ ] 前端加入修改事件（Update）介面
- [ ] Docker 容器化（FastAPI + PostgreSQL）
- [ ] Docker 自訂網路連接容器
- [ ] 繼續開發日曆功能

---
