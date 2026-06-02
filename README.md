# Final_Project — 彩色轉黑白圖片轉換網站

上傳彩色照片,自動轉成黑白並提供下載。含使用者註冊／登入、轉換檔案保存與分類,
規劃為可擴充的多功能圖片處理平台。

## 技術棧
- **後端**:Python + FastAPI + SQLAlchemy + Pillow
- **資料庫**:PostgreSQL(資料表由 Alembic migration 管理)
- **前端**:React + Vite + Ant Design
- **套件管理**:後端用 `uv`、前端用 `npm`

## 環境需求
- Python 3.11+
- Node.js 18+
- PostgreSQL 15(建議用 Docker 跑,最省事)
- `uv`(Python 套件管理工具):安裝 → `curl -LsSf https://astral.sh/uv/install.sh | sh`

---

## 本地啟動(開發模式)

需要開三個部分:**資料庫 → 後端 → 前端**。

### 1. 啟動資料庫(用 Docker 最簡單)

```bash
docker run -d --name fp-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=pwd -e POSTGRES_DB=mit_project \
  -p 5432:5432 postgres:15
```

> 若你已有本地 PostgreSQL,自行建立一個名為 `mit_project` 的資料庫即可。

### 2. 後端(在 `backend/` 目錄)

```bash
cd backend
uv sync                         # 安裝 Python 套件
uv run alembic upgrade head     # 建立資料表
uv run uvicorn main:app --reload --port 8000
```

後端會跑在 http://localhost:8000

> 本地開發直接用預設值即可跑(對應上面 Docker 的 postgres)。若要自訂金鑰/連線,
> 複製根目錄的 `.env.example` 為 `.env` 並調整;`.env` 主要供 `docker-compose` 使用。

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

前端會跑在 http://localhost:5173,用瀏覽器開即可。
(開發模式預設會打 `http://localhost:8000` 的後端,不需額外設定。)

---

## 使用流程
1. 開 http://localhost:5173
2. 註冊帳號 → 登入
3. 上傳彩色圖片 → 自動轉黑白 → 下載(可選 **無損 PNG** 或 **有損 JPG**)
4. 轉過的檔案會存在左側「彩色轉黑白」資料夾,可隨時回來下載／刪除

## 專案結構
```
backend/           後端
  main.py            API(FastAPI)
  alembic/           資料庫 migration
  Dockerfile         後端映像檔
  pyproject.toml     Python 套件清單
frontend/          前端(React + Vite)
docker-compose.yml 容器化部署設定(正式環境用)
.env.example       環境變數範本
```

## 如何新增功能(分類系統)
本專案以「分類」組織功能,目前只有 `grayscale`(彩色轉黑白)。要加新功能:
1. 後端寫新 endpoint,存檔時 `files.category` 用新的值(例如 `resize`)
2. 前端 `frontend/src/App.jsx` 的 `CATEGORIES` 陣列加一筆 `{ key, label }`
3. 對應的操作介面
`files` 資料表是通用的,新增功能不需要改資料庫結構。

## 備註
- `docker-compose.yml` 與 `frontend/nginx.conf` 是**正式環境**用的(含 HTTPS／網域設定);
  本地開發請用上面的開發模式,**不要**直接 `docker compose up`(會因為缺少 SSL 憑證而失敗)。
- 轉換後的圖片存在後端的 `uploads/` 目錄(本地)。
