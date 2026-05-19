# 學習進度記錄

---

## 2026-05-19

### 完成項目
- 在 DigitalOcean 建立 Droplet（Ubuntu 24.04，$6/mo，1GB RAM）
- 在 Mac 生成 SSH key，設定 Droplet 連線
- 在 Droplet 安裝 Docker，clone repo，`docker compose up -d --build` 成功啟動三服務
- 修改前端 API 網址指向 Droplet IP，重新部署後確認新增事件功能正常
- 專案成功上線：`http://137.184.65.172`
- 用 Vite 環境變數（`VITE_API_URL`）取代寫死的 IP，開發與部署自動切換
- 建立 GitHub Actions `deploy.yml`，push 到 main 自動 SSH 進 Droplet 部署
- 將 GitHub repo 改為 public，讓 log.md 截圖能在 HackMD 正常顯示
- 將 log.md 所有圖片路徑改為 GitHub raw URL 格式
- 建立 `/update-log` Claude Code skill，自動根據對話內容更新學習日誌

### 遇到的問題與解決

**問題 1：Railway 只部署 FastAPI，沒有跑完整 Compose**
- 原因：Railway 看到根目錄有 `Dockerfile` 就直接用它部署，不讀 `docker-compose.yml`；Railway 是「一個服務對應一個 repo」的邏輯
- 解決：改用 DigitalOcean Droplet（VPS），自己管伺服器，直接跑 `docker compose up`
- 學到：`docker-compose.yml` 適合本機開發或 VPS 部署，Railway/Render 等 PaaS 有自己的管理方式

**問題 2：Droplet git clone private repo 失敗（credential 問題）**
- 原因：VS Code 的 git credential helper 干擾，HTTPS clone 需要 PAT，但用 Google 登入的 GitHub 帳號沒有密碼
- 解決：在 Droplet 生成新的 SSH key，加到 GitHub SSH keys，改用 SSH clone（`git clone git@github.com:...`）

**問題 3：Droplet build 時記憶體不足，Image 下載失敗**
- 原因：1GB RAM 同時 build 兩個大 Image（node:22-slim 50MB + python:3.12-slim 12MB），記憶體撐不住，出現 TLS handshake timeout 和 context deadline exceeded
- 解決：加 1GB swap 空間讓系統有更多可用記憶體
  ```bash
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  ```

![記憶體不足錯誤](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260519/Memory-lacked.png)

**問題 4：前端打開有資料，但 Droplet 資料庫是空的**
- 原因：前端程式碼寫死 `http://localhost:8000`，瀏覽器的 JS 打的是 Mac 本機的 FastAPI，不是 Droplet 的
- 解決：把 `App.jsx` 的 API 網址改成 `http://137.184.65.172:8000`，commit + push，Droplet 重新 build

### 學到的概念

**VPS vs PaaS**
- VPS（如 DigitalOcean Droplet）：你拿到一台 Linux 主機，自己裝軟體、自己跑 docker-compose，彈性大、學到真實操作
- PaaS（如 Railway、Render）：平台幫你管伺服器，你只推程式碼，但有自己的部署邏輯，不一定支援 docker-compose

**Swap 空間**
- 把硬碟一部分當備用記憶體，RAM 不夠時系統把暫時用不到的資料移到 swap
- 速度比 RAM 慢，但可以避免程式因記憶體不足被 kill
- `fallocate` 建立檔案、`mkswap` 格式化、`swapon` 啟用

**前端 API 網址的問題**
- 前端 JS 是在使用者的瀏覽器上執行的，`localhost` 是使用者的電腦，不是伺服器
- 部署時 API 網址要改成伺服器的公開 IP 或網域
- 正確做法：用環境變數控制，開發時用 localhost，部署時用真實網址

**部署後的手動更新流程**
```
VM 改 code → git push → Droplet: git pull && docker compose up -d --build
```

### 學到的概念
**GitHub Raw URL 與 HackMD 圖片顯示**
- HackMD 顯示圖片需要圖片 URL 可公開存取，private repo 的路徑無法被外部載入
- GitHub raw URL 格式：`https://raw.githubusercontent.com/<user>/<repo>/<branch>/<path>`
- 只要 repo 是 public，raw URL 就可以直接被 HackMD 等外部網站載入

**Claude Code Skill**
- 在 `~/.claude/commands/` 建立 `.md` 檔，可定義自訂 slash command
- 檔名就是指令名稱（如 `update-log.md` → `/update-log`）
- Skill 的 Markdown 內容成為 Claude 執行該指令時遵循的規則

**GitHub Actions CI/CD**
- 在 `.github/workflows/deploy.yml` 定義自動化流程
- push 到 main 觸發，GitHub Actions 用 SSH 私鑰連進 Droplet，執行 `git pull && docker compose up -d --build`
- 敏感資訊（IP、SSH key）存在 GitHub Secrets，不寫在程式碼裡

**Vite 環境變數**
- `VITE_` 開頭的變數才會被 Vite 打包進前端
- `.env.production` — `npm run build` 時使用
- 開發時不設定就走 `||` 後的 fallback（`localhost:8000`）
- 用 `import.meta.env.VITE_API_URL` 讀取

### 下次待辦
- [ ] 設定防火牆，只開放 port 80 和 8000
- [ ] 新增使用者註冊、登入、登出功能
- [ ] events 資料表加 user_id，讓每個使用者有自己的日曆

---

## 2026-05-18

### 遇到的問題與解決

**問題：同時出現 port :5173 和 :5174，:5174 是空的（CORS 問題）**

![VS Code 同時出現四個 port](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/ports.png)

- 起因：Claude 之前用背景指令（`&`）啟動了 Vite，`pkill` 沒有完全停掉，:5173 仍被佔用
- 當自己再啟動一次 Vite，偵測到 :5173 被佔用，自動改用 :5174
- :5174 是空的，原本以為是後端沒開或資料庫限制，但其實都不是
- **真正原因：CORS**，後端 `main.py` 的白名單只有 `"http://localhost:5173"`，來自 :5174 的請求被擋掉，fetch 失敗，畫面空白

| :5173（CORS 通過，有資料） | :5174（CORS 被擋，空白） |
|---|---|
| ![cors-pass](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/cors-pass.png) | ![cors-block](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/cors-block.png) |

- 這正是之前學到的概念的實際體驗：origin 不在白名單就拿不到資料，瀏覽器 Console 會出現 CORS 錯誤
- 解決：`pkill -f vite` 殺掉舊實例，再重新 `npm run dev` 回到 :5173；或將後端 `allow_origins` 加入 `:5174`
- 補充：開發時可改成 `"*"` 允許所有來源，但上線時必須改回真實網址

### 完成項目
- 手動建立 Docker 自訂網路、Volume、PostgreSQL 容器、FastAPI 容器
- 修改 `main.py` 讓 `DATABASE_URL` 從環境變數讀取，開發與容器環境共用同一份程式碼
- 建立 `Dockerfile`，用 `uv` 安裝依賴並啟動 FastAPI
- 擴充 LVM，將根目錄從 23GB 擴充至 46GB
- 確認容器間網路連線正常，前端可透過容器化後端新增事件並持久化至 Volume

![容器資料庫驗證](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/Database-check.png)

### 遇到的問題與解決

**問題 1：Docker 指令 permission denied**
- 原因：使用者不在 `docker` 群組，無法存取 `/var/run/docker.sock`
- 解決：`sudo usermod -aG docker $USER` 加入群組；短期用 `sudo` 繞過

**問題 2：PostgreSQL 容器啟動失敗（版本格式不相容）**
- 原因：`mit-db-data` Volume 是 3 週前 postgres:15 初始化的格式，現在的 `postgres:latest` 已升級到 v18，格式不相容，啟動時報格式錯誤
- 解決：改用 `postgres:15` 明確指定版本，與 Volume 格式一致；同時學到正式環境不應使用 `latest` tag

![postgres version 問題](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/docker-image-version.png)

**問題 3：磁碟空間不足（根目錄 100% 滿）**
- 原因：Ubuntu 安裝時 LVM 只分配 23GB 給根目錄，剩下 ~24GB 在 Volume Group 中未分配；加上 Docker Image 佔用大量空間（postgres:latest 671MB、postgres:15 654MB、mit_test-web 296MB）
- 解決：
  1. `sudo docker system prune -a` 清除未使用的 Image 與快取，釋放 350MB
  2. `sudo lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv` 擴充 LV
  3. `sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv` 通知檔案系統變大
  4. 根目錄擴充至 46GB，可用空間 24GB

| 空間不足錯誤 | 擴充後恢復 |
|---|---|
| ![vm-nospaceleft](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/vm-nospaceleft.png) | ![vm-nospace-solve](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/vm-nospace-solve.png) |

**問題 4：`docker system prune -a` 把自訂網路和容器一起刪掉**
- 原因：`prune -a` 會刪除所有未使用的資源，`mit-db` 容器當時是 `Exited` 狀態，被判定為未使用，連帶把 `my-network` 也刪了
- 解決：重新建立網路和容器；Volume `mit-db-data` 不受影響，資料保留
- 學到：`docker system prune -a` 是高風險指令，執行前要確認哪些資源會被刪除

**問題 5：容器狀態 `Created` 但沒有啟動（網路找不到）**
- 原因：`my-network` 被 prune 刪除後容器嘗試啟動找不到網路，一直停在 `Created`
- 解決：重建網路後 `docker start mit-db` 成功啟動

### 學到的概念

**Docker 三大核心元素**
- **Image**：唯讀模板，由 Dockerfile build 產生或從 Docker Hub 下載
- **Container**：Image 的執行實例，可隨時刪除重建；建立參數（網路、port、環境變數）一旦設定不能修改，要改就刪掉重建
- **Volume**：獨立於容器生命週期的持久化儲存；容器刪掉資料不消失

**Docker 網路**
- 預設 `bridge` 網路：容器只能用 IP 互訪，不能用名稱（沒有 DNS）
- 自訂網路：Docker 內建 DNS server（`127.0.0.11`），容器名稱自動解析成 IP，可以用名稱互訪
- DNS 是 1983 年就有的技術，Docker 只是在自訂網路才啟用它，預設 bridge 為了向下相容保持舊行為
- 指令：`docker network create <name>`、`docker network ls`、`docker network rm <name>`

**容器化後的架構**
```
前端 React（本地 :5173，開發時不包進 Docker）
      ↓
mit-api 容器（FastAPI :8000，對外暴露）
      ↓
mit-db 容器（PostgreSQL :5432，只在 my-network 內部）
      ↓
mit-db-data Volume（資料持久化）
```

**環境變數控制連線設定**
- `main.py` 改用 `os.getenv("DATABASE_URL", "postgresql://...@localhost...")` 
- 本地開發不傳環境變數，走 fallback 連 localhost
- 容器啟動時用 `-e DATABASE_URL=...@mit-db:...` 覆蓋，連容器名稱

**為什麼不用 latest tag**
- `postgres:latest` 3 週前下載是 v15，現在更新成 v18，Volume 格式不相容導致容器無法啟動
- 正式環境要明確指定版本號（如 `postgres:15`），確保每次跑的都是同一版

**LVM（邏輯卷管理）**
- Ubuntu 安裝時預設只分配一半空間給根目錄，剩下在 VG 中未分配
- `vgdisplay` 查看 VG 可用空間，`lvextend` 擴充，`resize2fs` 通知檔案系統

### 完成項目- 撰寫 `docker-compose.yml`，整合 db、api、web 三個服務
- 撰寫 `frontend/Dockerfile`（multi-stage build：node build + nginx 提供靜態檔案）
- 建立 `initdb/01_create_tables.sql`，讓 PostgreSQL 第一次啟動時自動建立 events 資料表
- 在 Railway 完成初步部署，FastAPI 成功上線

### 遇到的問題與解決
**問題 6：Compose 啟動後新增事件失敗（CORS + 500 錯誤）**
- 原因：Compose 建立的是全新 Volume，`events` 資料表不存在，FastAPI 回 500；CORS 設定也需要改成 `"*"`
- 解決：
  1. `main.py` CORS 改為 `allow_origins=["*"]`
  2. 建立 `initdb/01_create_tables.sql` 讓資料庫自動初始化
  3. `docker compose down -v` 刪除舊 Volume 後重新啟動

![Compose CORS 500 錯誤](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/compose-cors-500-error.png)

**問題 7：Mac 瀏覽器連不到 nginx（port 80 沒有轉發）**
- 原因：VS Code 自動轉發高位 port（:5173、:8000），但 port 80 需要 root 權限，無法自動偵測
- 解決：在 VS Code Ports 分頁手動加入 port 80，VS Code 自動分配 Mac 上的隨機 port（如 :62178）對應

**問題 8：Railway 只部署 FastAPI，沒有跑完整 Compose**
- 原因：Railway 看到根目錄有 `Dockerfile` 就直接用它部署，不會自動跑 `docker-compose.yml`
- 學到：Railway 是「一個服務對應一個 repo」的邏輯，docker-compose.yml 是給本機開發或自己管理 VPS 用的，Railway 有自己的方式管理多服務

### 學到的概念
**docker-compose.yml 的角色**
- 把手動建立網路、Volume、容器的指令整合成一個 YAML 檔案
- `docker compose up --build` 一鍵啟動，`docker compose down -v` 連 Volume 一起刪除
- `depends_on` 控制啟動順序（db 先啟動，api 再啟動，web 最後）
- `initdb/` 掛進 `/docker-entrypoint-initdb.d/`，只有 Volume 是空的時候才執行（第一次啟動）

**Docker build 快取**
- Image 分層儲存，每一層都有快取
- 只有改變的層和之後的層才會重新 build，沒變的層直接用快取
- Image 存在硬碟上，重開機不會消失，只有程式碼或 Dockerfile 改了才需要重新 build

**nginx 與前端部署**
- 開發時用 Vite dev server（有 HMR）
- 部署時用 `npm run build` 產出靜態檔案，再用 nginx 提供給瀏覽器
- multi-stage build：第一階段 node build，第二階段只保留 nginx + dist，Image 更小

**現在的完整 Compose 架構**
```
Mac 瀏覽器
    ↓ :80
nginx 容器（前端靜態檔案）
    ↓ 瀏覽器直接打
FastAPI 容器（:8000，對外暴露）
    ↓
PostgreSQL 容器（:5432，只在 app-network 內部）
    ↓
db-data Volume（資料持久化）
```

**Railway 部署架構**
- Railway 不跑 docker-compose.yml，改用平台自己的方式管理服務
- PostgreSQL 由 Railway 提供，不需要自己設定
- 每個服務（FastAPI、前端）各自連結 repo 的不同 Dockerfile

### 下次待辦
- [x] ~~確認部署平台並完成三服務部署（PostgreSQL、FastAPI、前端）~~ → 改用 DigitalOcean Droplet，Railway 不支援 docker-compose
- [ ] 拿到前端網址後把 CORS 改成真實網址（目前暫時用 `"*"`）
- [x] 測試完整線上流程

### 學到的概念

**Claude Code 的 shell 限制**
- Claude 只有一個 shell 環境，同一時間只能執行一件事
- 背景執行（指令加 `&`）：程式在後台跑，不佔 shell，但看不到 log，也沒辦法 Ctrl+C
- 前景執行（不加 `&`）：Claude 的工具會卡住，沒辦法繼續回應
- Subagent 也有同樣限制，而且跑完任務就結束，無法維持 server 持續運行
- 結論：啟動 FastAPI 和 React dev server 這類持續運行的程式，應該自己在 VS Code 終端機開分頁執行，才能看到 log 且可以 Ctrl+C 控制

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
- [x] Docker 容器化（FastAPI + PostgreSQL）
- [x] Docker 自訂網路連接容器
- [x] 撰寫 docker-compose.yml
- [x] ~~部署至雲端平台（Render / Railway）~~ → 改用 DigitalOcean Droplet

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
- [x] 前端加入修改事件（Update）介面
- [x] Docker 容器化（FastAPI + PostgreSQL）
- [x] Docker 自訂網路連接容器
- [x] 繼續開發日曆功能

---
