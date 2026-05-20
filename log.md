# 學習進度記錄

## 專案目標

| 目標 | 狀態 |
|---|---|
| 三層架構（React + FastAPI + PostgreSQL） | ✅ 完成 |
| Docker 容器化 | ✅ 完成 |
| 雲端部署（DigitalOcean Droplet） | ✅ 完成 |
| CI/CD 自動部署（GitHub Actions） | ✅ 完成 |
| 使用者功能 | ✅ 完成 |

---

## 2026-05-20

### 完成項目
- 將 CORS `allow_origins` 從寫死的 `"*"` 改為環境變數 `FRONTEND_ORIGIN`，docker-compose.yml 注入 Droplet IP，本地開發自動 fallback 到 localhost:5173
- 建立 .gitignore，排除 `__pycache__/` 和 `.pyc` 檔案
- 設定 Alembic migration 系統，建立三個版本：`create_events_table`、`create_users_table`、`add_user_id_to_events`
- 實作後端使用者認證：`POST /register`（bcrypt hash 密碼）、`POST /login`（回傳 JWT token）
- 所有 events 端點加上 JWT middleware，只能存取自己的資料
- 新增前端登入/註冊頁面（`Login.jsx`），登入後儲存 token 到 localStorage
- 成功部署認證功能到 Droplet，第一個使用者建立成功
- 將 `SECRET_KEY` 等機密從 `docker-compose.yml` 移除，改用 `env_file: .env`，並更新 `.gitignore`
- 將使用者帳號欄位從 `email` 改為 `username`（前端 label、後端 model、SQL、Alembic migration 四處同步修改）
- 修復 `fetchEvents()` 缺參數 bug，改為直接使用 `authHeaders`
- `deploy.yml` 加入 `paths` 過濾，只有程式碼變動才觸發部署，改 log.md 不再觸發

![第一個使用者建立成功](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260519/first-user-create.png)

### 遇到的問題與解決

**問題 1：部署後 Alembic 嘗試建立已存在的 events 表**
- 原因：Droplet 上的 events 表是舊的 `initdb/01_create_tables.sql` 建的，Alembic 不知道它已存在，啟動時嘗試 `CREATE TABLE events` 報錯
- 解決：用 `alembic stamp b61ec4551e40` 告訴 Alembic 第一個 migration 已完成，之後只跑剩下兩個新的 migration

**問題 2：passlib 與新版 bcrypt 相容性錯誤**
- 原因：`passlib` 初始化時會用 `detect_wrap_bug` 測試 bcrypt 行為，但 bcrypt 4.x 改了內部規則，測試直接拋出 `ValueError`，導致 `/register` 請求失敗
- 解決：移除 `passlib`，改為直接使用 `bcrypt` 套件（`bcrypt.hashpw` / `bcrypt.checkpw`）

![passlib bcrypt 相容性錯誤](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260519/passlib-bcrypt-compatibility-error.png)

**問題 3：推送後 GitHub Actions 自動部署失敗（Droplet 找不到 .env）**
- 原因：`docker-compose.yml` 改用 `env_file: .env` 後，Docker 啟動時去找 `/root/MIT_Project/.env`，但這個檔案從來沒有被建立過（`.env` 在 `.gitignore` 裡，不會跟著 git 走）
- 解決：SSH 進 Droplet，手動建立 `.env` 填入生產環境的機密，再重新執行 `docker compose up -d --build`
- 學到：`.env` 需要在每台機器上**手動建立一次**，不會自動同步

**問題 5：新增/編輯/刪除事件後自動登出**
- 原因：`fetchEvents(currentToken)` 需要外部傳入 JWT token，但新增/編輯/刪除操作完成後呼叫的是 `fetchEvents()`（沒有傳參數）。`currentToken` 變成 `undefined`，導致 Authorization header 變成 `Bearer undefined`，伺服器收到無效 token 回 401，觸發自動登出
- 根本問題：同一份 JWT token 存在兩個地方（component state 的 `token` 和函式參數的 `currentToken`），兩者沒有同步，呼叫時容易漏傳
- 解決：移除 `currentToken` 參數，改為直接使用 component 範圍內已有的 `authHeaders`（它內含 `token` state）。函式透過 closure 直接讀取外層變數，不需要外部傳入，任何地方呼叫都不會出錯
- 原則：同一份資料只存一個地方，不要在函式參數和外層 state 之間重複傳遞

**問題 6：每次 push log.md 都觸發不必要的部署**
- 原因：`deploy.yml` 只要 push 到 main 就觸發，不管改的是什麼檔案
- 解決：加入 `paths` 過濾，只有 `main.py`、`Dockerfile`、`docker-compose.yml`、`pyproject.toml`、`alembic/`、`frontend/` 變動才觸發部署

**問題 7：登入或登出後頁面變空白，重新整理才正常**
- 原因：`useEffect` 寫在 `if (!token) return <Login />` 之後，違反 React Hooks 規則——hooks 必須在所有 return 之前被呼叫，順序不一致導致 React 狀態混亂
- 解決：將 `useEffect` 移到條件判斷之前，並讓 `useEffect` 依賴 `token`，登入後自動 fetch 資料

### 學到的概念

**Alembic Migration**
- 每次改 schema 寫一個版本檔（如 `0001_create_users.py`），記錄這次加了什麼
- 部署時跑 `alembic upgrade head`，自動套用還沒跑過的版本
- `alembic stamp <revision_id>`：把指定版本標記為已完成，不實際執行 SQL——用於已存在資料庫的第一次接入
- 只做加法（`ADD COLUMN`、`CREATE TABLE`）是安全的；刪欄位、改名是破壞性操作，要謹慎

**JWT（JSON Web Token）**
- 登入成功後 server 發一張「票」，內含 `user_id` 和到期時間
- 票用 `SECRET_KEY` 簽名，防止被偽造或篡改
- 之後每次請求帶上票，server 驗證簽名 → 讀出 `user_id` → 只回傳該使用者資料
- `SECRET_KEY` 只有 server 知道，洩漏後攻擊者可偽造任何人的票

**bcrypt 密碼 hash（深入）**
- 密碼不能存明文，bcrypt 把密碼變成不可逆的 hash，存進資料庫
- bcrypt 演算法是公開的，任何人都能呼叫，但它是**單向的**：正向可算，反向不可能
- 驗證時不是「解開 hash 還原密碼」，而是「把輸入的密碼重新 hash 一次，比對結果是否相同」
- 就算資料庫被偷，攻擊者拿到的只有 hash，無法還原原始密碼，只能暴力逐一猜測（bcrypt 故意設計很慢以提高破解成本）
- 明文密碼只存在 `register` 那一瞬間，用完即丟，永遠不會進資料庫

**bcrypt hash vs JWT token 的本質差異**

| | bcrypt hash | JWT token |
|---|---|---|
| 用途 | 驗證你是誰（密碼） | 驗證你已登入（通行證） |
| 存放位置 | 資料庫 `users` 表 | 瀏覽器 `localStorage` |
| 何時產生 | 註冊時 | 登入成功後 |
| 永久性 | 永久（除非改密碼） | 暫時（7 天過期） |
| 用到的 key | 無（bcrypt 本身的演算法） | `SECRET_KEY`（簽名用） |

- 換掉 `SECRET_KEY` 只讓舊 token 失效（用戶需重新登入），資料庫的密碼 hash 完全不受影響
- 兩者混淆的常見原因：都叫 hash/key，但作用完全不同

**機密管理：.env 不進 git**
- `SECRET_KEY`、資料庫密碼等機密不應寫在 `docker-compose.yml`（此檔被 git 追蹤，public repo 就等於公開）
- 正確做法：在伺服器上手動建立 `.env`，加入 `.gitignore`，`docker-compose.yml` 改用 `env_file: .env`
- `.env` 只存在伺服器本機，`git pull` 不會刪它，`git push` 也不會上傳它
- git 的「無視」是雙向的：不追蹤的檔案，push 不上去、pull 不會刪掉、`git status` 也不顯示

**Linux 隱藏檔**
- 檔名以 `.` 開頭的檔案是隱藏檔（如 `.env`、`.gitignore`）
- `ls` 預設不顯示隱藏檔，要加 `-a` 參數才看得到：`ls -la`

**React Hooks 規則**
- Hooks（`useState`、`useEffect` 等）必須在 component 頂層呼叫
- 不能放在條件判斷（`if`）或提前 `return` 之後
- 違反規則會導致 React 在不同 render 間 hooks 順序不一致，產生難以預期的 bug

**`docker compose down` vs `docker compose down -v`**
- `docker compose down`：停止並移除容器，Volume 保留（資料安全）
- `docker compose down -v`：同上，但額外刪除 Volume（資料永久消失）
- 正常重新部署用前者，想完全重置才用後者

### 今日小結
完成完整使用者認證流程——Alembic migration、JWT、bcrypt 到前端整合——並成功部署；事後進行安全審查，修復機密洩漏、fetchEvents bug、CI/CD 過度觸發等多個問題。

### 下次待辦
- [ ] 設定防火牆，只開放 port 80 和 8000
- [ ] 確認 Droplet 部署正常、以新帳號重新註冊登入

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

### 今日小結
首次在真實 VPS 完成部署，從手動 SSH 到 GitHub Actions 全自動化，建立起完整的 CI/CD 流程；同時理解了 PaaS vs VPS 的本質差異。

### 下次待辦
- [x] 新增使用者註冊、登入、登出功能
- [x] events 資料表加 user_id，讓每個使用者有自己的日曆
- [x] 拿到前端網址後把 CORS 改成真實網址 → 改用環境變數 `FRONTEND_ORIGIN`

---

## 2026-05-18

### 完成項目
- 手動建立 Docker 自訂網路、Volume、PostgreSQL 容器、FastAPI 容器
- 修改 `main.py` 讓 `DATABASE_URL` 從環境變數讀取，開發與容器環境共用同一份程式碼
- 建立 `Dockerfile`，用 `uv` 安裝依賴並啟動 FastAPI
- 擴充 LVM，將根目錄從 23GB 擴充至 46GB
- 確認容器間網路連線正常，前端可透過容器化後端新增事件並持久化至 Volume
- 撰寫 `docker-compose.yml`，整合 db、api、web 三個服務
- 撰寫 `frontend/Dockerfile`（multi-stage build：node build + nginx 提供靜態檔案）
- 建立 `initdb/01_create_tables.sql`，讓 PostgreSQL 第一次啟動時自動建立 events 資料表
- 在 Railway 完成初步部署，FastAPI 成功上線

![容器資料庫驗證](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/Database-check.png)

### 遇到的問題與解決

**問題 1：同時出現 port :5173 和 :5174，:5174 是空的（CORS 問題）**

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

**問題 2：Docker 指令 permission denied**
- 原因：使用者不在 `docker` 群組，無法存取 `/var/run/docker.sock`
- 解決：`sudo usermod -aG docker $USER` 加入群組；短期用 `sudo` 繞過

**問題 3：PostgreSQL 容器啟動失敗（版本格式不相容）**
- 原因：`mit-db-data` Volume 是 3 週前 postgres:15 初始化的格式，現在的 `postgres:latest` 已升級到 v18，格式不相容，啟動時報格式錯誤
- 解決：改用 `postgres:15` 明確指定版本，與 Volume 格式一致；同時學到正式環境不應使用 `latest` tag

![postgres version 問題](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/docker-image-version.png)

**問題 4：磁碟空間不足（根目錄 100% 滿）**
- 原因：Ubuntu 安裝時 LVM 只分配 23GB 給根目錄，剩下 ~24GB 在 Volume Group 中未分配；加上 Docker Image 佔用大量空間（postgres:latest 671MB、postgres:15 654MB、mit_test-web 296MB）
- 解決：
  1. `sudo docker system prune -a` 清除未使用的 Image 與快取，釋放 350MB
  2. `sudo lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv` 擴充 LV
  3. `sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv` 通知檔案系統變大
  4. 根目錄擴充至 46GB，可用空間 24GB

| 空間不足錯誤 | 擴充後恢復 |
|---|---|
| ![vm-nospaceleft](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/vm-nospaceleft.png) | ![vm-nospace-solve](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/vm-nospace-solve.png) |

**問題 5：`docker system prune -a` 把自訂網路和容器一起刪掉**
- 原因：`prune -a` 會刪除所有未使用的資源，`mit-db` 容器當時是 `Exited` 狀態，被判定為未使用，連帶把 `my-network` 也刪了
- 解決：重新建立網路和容器；Volume `mit-db-data` 不受影響，資料保留
- 學到：`docker system prune -a` 是高風險指令，執行前要確認哪些資源會被刪除

**問題 6：容器狀態 `Created` 但沒有啟動（網路找不到）**
- 原因：`my-network` 被 prune 刪除後容器嘗試啟動找不到網路，一直停在 `Created`
- 解決：重建網路後 `docker start mit-db` 成功啟動

**問題 7：Compose 啟動後新增事件失敗（CORS + 500 錯誤）**
- 原因：Compose 建立的是全新 Volume，`events` 資料表不存在，FastAPI 回 500；CORS 設定也需要改成 `"*"`
- 解決：
  1. `main.py` CORS 改為 `allow_origins=["*"]`
  2. 建立 `initdb/01_create_tables.sql` 讓資料庫自動初始化
  3. `docker compose down -v` 刪除舊 Volume 後重新啟動

![Compose CORS 500 錯誤](https://raw.githubusercontent.com/alfredshen01/MIT_Project/main/log-picture/20260518/compose-cors-500-error.png)

**問題 8：Mac 瀏覽器連不到 nginx（port 80 沒有轉發）**
- 原因：VS Code 自動轉發高位 port（:5173、:8000），但 port 80 需要 root 權限，無法自動偵測
- 解決：在 VS Code Ports 分頁手動加入 port 80，VS Code 自動分配 Mac 上的隨機 port（如 :62178）對應

**問題 9：Railway 只部署 FastAPI，沒有跑完整 Compose**
- 原因：Railway 看到根目錄有 `Dockerfile` 就直接用它部署，不會自動跑 `docker-compose.yml`
- 學到：Railway 是「一個服務對應一個 repo」的邏輯，docker-compose.yml 是給本機開發或自己管理 VPS 用的，Railway 有自己的方式管理多服務

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

**Claude Code 的 shell 限制**
- Claude 只有一個 shell 環境，同一時間只能執行一件事
- 背景執行（指令加 `&`）：程式在後台跑，不佔 shell，但看不到 log，也沒辦法 Ctrl+C
- 前景執行（不加 `&`）：Claude 的工具會卡住，沒辦法繼續回應
- Subagent 也有同樣限制，而且跑完任務就結束，無法維持 server 持續運行
- 結論：啟動 FastAPI 和 React dev server 這類持續運行的程式，應該自己在 VS Code 終端機開分頁執行，才能看到 log 且可以 Ctrl+C 控制

### 今日小結
從手動 `docker run` 進化到 docker-compose 一鍵啟動，掌握 Image / Container / Volume / Network 四大核心元素；過程中遇到版本不相容、磁碟滿、prune 誤刪等問題，都透過調查根本原因解決。

### 下次待辦
- [x] ~~確認部署平台並完成三服務部署（PostgreSQL、FastAPI、前端）~~ → 改用 DigitalOcean Droplet，Railway 不支援 docker-compose
- [x] 拿到前端網址後把 CORS 改成真實網址（目前暫時用 `"*"`）→ 改用環境變數 `FRONTEND_ORIGIN`
- [x] 測試完整線上流程

---

## 2026-05-17

### 完成項目
- 完成前端 CRUD：新增編輯事件 modal、點月曆格子自動帶入日期、串接後端 PUT API
- 套用 Ant Design（antd）UI 元件庫，改用 Modal、Form、Button、DatePicker、TimePicker
- 修正 CSS 衝突問題（詳見下方）
- 新增自訂 toolbar，檢視按鈕改為日→週→月→議程順序
- 將套件管理從 `requirements.txt` 遷移至 `uv init`（pyproject.toml + uv.lock）

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

### 今日小結
完成前端完整 CRUD 介面，antd + react-big-calendar 配合；受控元件的概念從理論變成實際遇到的 bug，印象深刻。

### 下次待辦
- [x] Docker 容器化（FastAPI + PostgreSQL）
- [x] Docker 自訂網路連接容器
- [x] 撰寫 docker-compose.yml
- [x] ~~部署至雲端平台（Render / Railway）~~ → 改用 DigitalOcean Droplet

---

## 2026-05-16

### 完成項目
（本日為概念複習與深化，無新功能實作）

### 遇到的問題與解決
（無）

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

### 今日小結
深入理解 CORS 機制，從理論（CSRF 攻擊場景、Preflight 流程）到操作細節（同源定義、allow_origins 設定），建立完整心理模型。

### 下次待辦
- [x] 前端加入修改事件（Update）介面
- [x] 套用 UI 元件庫（antd）
- [x] Docker 容器化

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

### 遇到的問題與解決
（無記錄）

### 學到的概念
- Docker 網路：`docker network create` 建立自訂子網，容器間用名稱互訪
- HTTP 方法：GET / POST / PUT / DELETE 對應 CRUD
- uv vs npm：Python 套件與 JS 套件是獨立環境
- Vite HMR：程式碼變更後瀏覽器自動更新
- CORS：前後端跨 port 呼叫需要在後端設定允許來源

### 今日小結
從零建立三層架構（React + FastAPI + PostgreSQL），前後端資料庫全部串通，完成基礎日曆 CRUD，整個 stack 第一次跑起來。

### 下次待辦
- [x] 前端加入修改事件（Update）介面
- [x] Docker 容器化（FastAPI + PostgreSQL）
- [x] Docker 自訂網路連接容器
- [x] 繼續開發日曆功能

---
