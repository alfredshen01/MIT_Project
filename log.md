# 學習進度記錄

---

## 2026-05-17

### 完成項目
- 完成前端 CRUD：新增編輯事件 modal、點月曆格子自動帶入日期、串接後端 PUT API
- 套用 Ant Design（antd）UI 元件庫，改用 Modal、Form、Button、DatePicker、TimePicker
- 修正 CSS 衝突問題（詳見下方）
- 新增自訂 toolbar，檢視按鈕改為日→週→月→議程順序
- 將套件管理從 `requirements.txt` 遷移至 `uv init`（pyproject.toml + uv.lock）

### 學到的概念

**Port 與三層架構**
- 前端 :5173、後端 :8000 需要對外暴露，出現在 VS Code port 列表
- PostgreSQL :5432 只在 VM 內部被 FastAPI 連線，不需要對外，不會出現在列表
- VS Code 會自己開隨機 port（如 :39619）供內部擴充功能使用，與專案無關

**npm 套件管理**
- `package.json` = 套件清單（對應 Python 的 `pyproject.toml`）
- `package-lock.json` = 鎖定版本（對應 `uv.lock`）
- `npm install <套件>` = 安裝並自動更新 `package.json`
- `node_modules/` = 虛擬環境（對應 `.venv/`）
- `npm install` 執行時不會影響正在跑的 dev server，Vite 會自動偵測新套件

**uv 套件管理遷移**
- `uv init` 建立 `pyproject.toml` 與 `.python-version`
- `uv add <套件>` 自動更新 `pyproject.toml` 並產生 `uv.lock`
- 比 `requirements.txt` 方便：不用手動維護，有鎖定檔確保版本一致
- 遷移步驟：`uv init` → `uv add fastapi uvicorn sqlalchemy psycopg2-binary`

**react-big-calendar vs antd Calendar**
- antd 的 `Calendar` 只是選日期用的元件，無法顯示多個事件、無法切換週/日/議程
- react-big-calendar 專為行事曆 app 設計，支援事件顯示、多種檢視、點擊互動
- 兩者並用：antd 負責按鈕/modal/表單，react-big-calendar 負責月曆本體

**React 受控元件（Controlled Component）**
- react-big-calendar 預設自己管理 view 狀態（uncontrolled）
- 換成自訂 toolbar 後，需要自己用 `useState` 管理 `currentView`
- 傳入 `view={currentView}` 和 `onView={setCurrentView}` 才能讓按鈕切換生效
- 原則：自訂子元件替換預設後，原本內部的狀態需要由外部接管

### 遇到的問題與解決

**問題 1：非當月日期變白色、導覽按鈕消失**
- 原因 A：Vite 建立專案時自動產生的 `index.css` 含有 `color-scheme: light dark`，系統深色模式下會把頁面背景變黑，蓋掉月曆顏色
- 原因 B：`index.css` 的 `#root { text-align: center }` 影響月曆排版
- 解決：清除 `index.css` 的模板內容，只保留 `body { margin: 0 }`
- 補充：安裝 antd 後也會有 CSS 衝突，在 `App.css` 加 override 修正 `.rbc-off-range` 和 toolbar 按鈕樣式

**問題 2：自訂 toolbar 按鈕點下去沒反應**
- 原因：月曆的 view 狀態沒有被外部控制，換成自訂 toolbar 後按鈕觸發的 `onView` 無法更新畫面
- 解決：加入 `const [currentView, setCurrentView] = useState('month')`，並傳給 Calendar

**問題 3：`git push` 從我的 shell 執行失敗**
- 原因：我的 shell 是非互動模式，沒有 TTY，git 無法提示輸入帳號密碼
- VS Code 的終端機有存取 credential cache 的權限，所以從終端機 push 正常
- 結論：git push 需要由使用者自己在終端機執行

### 下次待辦
- [ ] Docker 容器化（FastAPI + PostgreSQL）
- [ ] Docker 自訂網路連接容器
- [ ] 部署至雲端平台（Render / Railway）

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
