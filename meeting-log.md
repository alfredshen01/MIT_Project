# 會議記錄

## 2026-05-20

**參與者：** 威廷、廷勳、德偉學長

### 討論內容

- **LLM API 應用** — 後端可串接 LLM（如 Gemini、OpenAI）實現 AI 功能（學長提及）
- **Karpathy LLM wiki** — 分享Wiki知識庫/資料庫應用
- **部署架構觀念** — 目前用 VPS（DigitalOcean Droplet）自己管，若改用 PaaS（如 Render、Railway），各服務部署上去後透過 port 連接即可
- **資安** — 敏感檔案（`.env`、API key、claude.md、claude/setting.json等）應加入 `.gitignore`，避免在GitHub公開；secret key 建議改存於 GitHub Secrets，透過 CI/CD 自動注入，不需手動維護 `.env`
- **HTTPS** — 網站上線應將 HTTP 改為 HTTPS，提升安全性（通常用 Let's Encrypt 取得 SSL 憑證）
- **Harness 概念** — 理解 harness 的用途（測試框架或 CI/CD 流程中的執行環境包裝層）
- **論文形式** — 考慮以論文形式完成專案，與現有成品進行比較分析，後續再議
- **學習方向建議** — 學長建議重心放在部署穩定性、資安、架構等基礎建設的完善，不要著墨於介面美化等表象調整
- **專案計劃書** — 學長希望撰寫一份專案計劃書，規劃開發方向與目標
