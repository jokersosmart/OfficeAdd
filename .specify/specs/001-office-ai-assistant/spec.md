# Feature Specification: Joker AI 助手增益集

**Feature Branch**: `001-office-ai-assistant`  
**Created**: 2026-02-06  
**Status**: Reverse-Engineered (從既有程式碼反推)  
**Input**: 分析現有 copilot-office-addin 專案，產生規格說明

---

## 概述

本專案是一個 Microsoft Office 增益集（Add-in），讓使用者可以在 Word、Excel、PowerPoint 應用程式中，透過側邊欄與 AI 助理進行對話互動，獲得寫作輔助、資料分析、簡報製作等 AI 功能。

---

## User Scenarios & Testing

### User Story 1 - 在 Office 中啟動 AI 助理 (Priority: P1)

使用者開啟 Word、Excel 或 PowerPoint 後，點擊功能區的「GitHub Copilot」按鈕，即可在側邊欄開啟 AI 聊天介面，開始與 AI 對話。

**Why this priority**: 這是整個產品的核心入口，沒有這個功能，其他一切都無法運作。

**Independent Test**: 開啟任一 Office 應用程式，點擊增益集按鈕，確認側邊欄出現 AI 聊天介面。

**Acceptance Scenarios**:

1. **Given** 使用者已安裝增益集且本地伺服器正在運行, **When** 使用者在 Word 中點擊「GitHub Copilot」按鈕, **Then** 側邊欄顯示 AI 聊天介面
2. **Given** 本地伺服器未啟動, **When** 使用者點擊增益集按鈕, **Then** 顯示連線錯誤提示
3. **Given** 增益集已載入, **When** 使用者關閉側邊欄後再次點擊按鈕, **Then** 側邊欄重新開啟並保留對話記錄

---

### User Story 2 - 使用 GitHub Copilot 進行 AI 對話 (Priority: P1)

擁有 GitHub Copilot 訂閱的使用者，透過設定個人 PAT Token，即可在 Office 中使用 Copilot AI 進行對話，獲得寫作建議、程式碼解釋、資料分析等協助。

**Why this priority**: GitHub Copilot 是主要的 AI 後端，面向個人開發者用戶。

**Independent Test**: 設定 `COPILOT_GITHUB_TOKEN` 環境變數，啟動伺服器，在 Office 中發送訊息並收到 AI 回應。

**Acceptance Scenarios**:

1. **Given** 使用者已設定有效的 GitHub PAT Token, **When** 使用者在聊天框輸入問題並送出, **Then** AI 在數秒內回應相關內容
2. **Given** 使用者的 PAT Token 已過期或無效, **When** 使用者嘗試發送訊息, **Then** 系統顯示認證錯誤訊息
3. **Given** AI 正在回應中, **When** 使用者觀察介面, **Then** 顯示打字指示器或串流文字效果

---

### User Story 3 - 使用 Azure OpenAI 進行 AI 對話 (Priority: P1)

企業用戶透過公司統一部署的 Azure OpenAI 服務，在 Office 中使用 AI 功能，無需個人訂閱 GitHub Copilot。

**Why this priority**: 企業部署是重要的商業場景，與個人用戶並列為核心功能。

**Independent Test**: 設定 `USE_AZURE_BACKEND=true` 及 Azure 相關環境變數，確認 AI 回應來自 Azure OpenAI。

**Acceptance Scenarios**:

1. **Given** 環境變數 `USE_AZURE_BACKEND=true` 且 Azure 設定完整, **When** 使用者發送訊息, **Then** 請求透過 `/api/azure/chat` 路由到 Azure OpenAI
2. **Given** Azure API Key 錯誤, **When** 使用者發送訊息, **Then** 顯示 Azure API 錯誤訊息
3. **Given** Azure 部署名稱未設定, **When** 伺服器啟動, **Then** 終端機顯示「Azure OpenAI not configured」警告

---

### User Story 4 - 上傳圖片進行視覺分析 (Priority: P2)

使用者可以上傳圖片（截圖、照片等），讓 AI 分析圖片內容並給予回應，例如描述圖片、提取文字、解釋圖表等。

**Why this priority**: 視覺理解是進階功能，增強 AI 的實用性，但非核心對話功能。

**Independent Test**: 在聊天介面上傳一張圖片，AI 能正確描述圖片內容。

**Acceptance Scenarios**:

1. **Given** 使用者在聊天介面, **When** 使用者上傳 PNG/JPG 圖片, **Then** 圖片透過 `/api/upload-image` 暫存並傳送給 AI
2. **Given** 使用者上傳 SVG 圖片, **When** 系統處理圖片, **Then** 正確識別為 SVG 格式並處理
3. **Given** 上傳的圖片超過 50MB, **When** 系統接收請求, **Then** 回傳 400 錯誤「Invalid image data」

---

### User Story 5 - 抓取網頁內容供 AI 參考 (Priority: P3)

使用者可以提供網頁 URL，系統代理抓取網頁內容後，讓 AI 分析或摘要該網頁資訊。

**Why this priority**: 輔助功能，擴展 AI 的資訊來源，但並非核心互動流程。

**Independent Test**: 呼叫 `/api/fetch?url=https://example.com`，確認回傳網頁內容。

**Acceptance Scenarios**:

1. **Given** 使用者提供有效的 HTTPS URL, **When** 系統發起抓取請求, **Then** 回傳網頁的純文字內容
2. **Given** URL 指向不存在的網站, **When** 系統嘗試抓取, **Then** 回傳 500 錯誤及錯誤訊息
3. **Given** 未提供 URL 參數, **When** 呼叫 `/api/fetch`, **Then** 回傳 400 錯誤「Missing url parameter」

---

### User Story 6 - 本地 SSL 憑證與安全連線 (Priority: P1)

系統必須透過 HTTPS 提供服務（Office 增益集的安全要求），使用者需產生並信任本地 SSL 憑證。

**Why this priority**: 安全要求，Office 增益集強制要求 HTTPS，否則無法載入。

**Independent Test**: 執行 `gen-certs-windows.ps1` 產生憑證，啟動伺服器後瀏覽器可透過 `https://localhost:52390` 存取。

**Acceptance Scenarios**:

1. **Given** 使用者執行憑證產生腳本, **When** 腳本完成, **Then** `certs/localhost.pem` 和 `certs/localhost-key.pem` 檔案存在
2. **Given** 憑證檔案不存在, **When** 啟動伺服器, **Then** 伺服器終止並顯示「SSL certificates not found!」錯誤
3. **Given** 憑證已產生但未信任, **When** 瀏覽器存取服務, **Then** 顯示憑證不受信任警告

---

### User Story 7 - 增益集註冊與移除 (Priority: P2)

使用者可透過腳本將增益集註冊到 Office，使「GitHub Copilot」按鈕出現在功能區；也可移除增益集恢復原狀。

**Why this priority**: 安裝/移除流程是使用者體驗的一部分，但只需執行一次。

**Independent Test**: 執行 `register.ps1` 後開啟 Word，確認功能區出現增益集按鈕。

**Acceptance Scenarios**:

1. **Given** 使用者執行 `register.ps1`, **When** 腳本完成, **Then** Office 功能區顯示「GitHub Copilot」按鈕
2. **Given** 增益集已註冊, **When** 使用者執行 `unregister.ps1`, **Then** Office 功能區不再顯示該按鈕
3. **Given** Office 正在執行中, **When** 使用者註冊增益集, **Then** 需要重啟 Office 才能看到按鈕

---

### Edge Cases

- 當 WebSocket 連線在對話中途斷開時，系統應如何處理？
- 當 Copilot CLI 子程序崩潰時，是否能自動重連或提示使用者？
- 當使用者同時開啟多個 Office 文件，是否共用同一個 AI session？
- 當網路不穩定導致 Azure API 請求超時時，如何提示使用者？
- 當 PAT Token 的 Copilot Requests 權限不足時，錯誤訊息是否足夠清楚？

---

## Requirements

### Functional Requirements

- **FR-001**: 系統 MUST 提供 HTTPS 伺服器，監聽 `localhost:52390`
- **FR-002**: 系統 MUST 支援 GitHub Copilot 作為 AI 後端（透過 WebSocket 代理 Copilot CLI）
- **FR-003**: 系統 MUST 支援 Azure OpenAI 作為替代 AI 後端（透過 REST API 代理）
- **FR-004**: 系統 MUST 透過環境變數 `USE_AZURE_BACKEND` 切換 AI 後端
- **FR-005**: 系統 MUST 提供 `/api/config` 端點，讓前端取得後端設定
- **FR-006**: 系統 MUST 提供 `/api/upload-image` 端點，接受 Base64 圖片並暫存至系統暫存目錄
- **FR-007**: 系統 MUST 提供 `/api/fetch` 端點，代理抓取外部網頁內容
- **FR-008**: 系統 MUST 提供 `/api/copilot` WebSocket 端點，橋接前端與 Copilot CLI
- **FR-009**: 系統 MUST 在 WebSocket 連線建立時，spawn 獨立的 Copilot CLI 子程序
- **FR-010**: 系統 MUST 正確解析 LSP（Language Server Protocol）訊息格式
- **FR-011**: 系統 MUST 在 WebSocket 關閉時，終止對應的 Copilot CLI 子程序
- **FR-012**: 系統 MUST 支援 Electron 環境運行（桌面應用包裝）
- **FR-013**: 系統 MUST 提供靜態檔案服務，載入預編譯的前端 SPA
- **FR-014**: 系統 MUST 支援 Docker 容器化部署
- **FR-015**: 系統 MUST 在缺少 SSL 憑證時，終止啟動並顯示錯誤訊息

### Non-Functional Requirements

- **NFR-001**: 伺服器啟動時間 SHOULD 少於 5 秒
- **NFR-002**: AI 回應首字元延遲 SHOULD 少於 3 秒（網路正常情況下）
- **NFR-003**: 系統 SHOULD 支援 Node.js 18 以上版本
- **NFR-004**: 圖片上傳 MUST 限制在 50MB 以內
- **NFR-005**: 系統 SHOULD 在終端機顯示清晰的啟動狀態資訊（後端類型、Token 狀態等）

### Key Entities

- **Session**: AI 對話 session，包含 model 設定、已註冊的 tools、對話歷史
- **Message**: 使用者或 AI 的單條訊息，可包含文字和圖片
- **Tool**: Copilot SDK 註冊的工具，讓 AI 可呼叫特定功能（如抓取網頁）
- **Image**: 使用者上傳的圖片，暫存於系統暫存目錄，包含路徑和原始檔名

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 使用者可在 3 分鐘內完成從安裝到首次 AI 對話的流程
- **SC-002**: AI 回應準確率達到 Copilot/Azure OpenAI 原生水準（無代理損耗）
- **SC-003**: 系統可持續運行 8 小時以上無需重啟（一般工作日）
- **SC-004**: 支援同時處理 5 個以上的 Office 文件各自的 AI session
- **SC-005**: 錯誤情況下（Token 無效、網路斷線），使用者可在 10 秒內理解問題並知道如何解決

---

## Clarifications (待釐清)

- [ ] 前端 UI 的詳細互動規格（按鈕位置、聊天氣泡樣式、訊息格式等）
- [ ] 是否需要支援對話歷史持久化（目前似乎只在 session 內保留）
- [ ] 是否需要支援多語言介面？
- [ ] Tool calling 的具體支援範圍（目前有哪些 tools 可用？）
- [ ] Rate limiting 機制（避免濫用 API）
- [ ] 錯誤回報機制（使用者如何回報問題？）
