# Joker Office AI 助理

> Microsoft Office AI 增益集（Add-in）— 在 Word、Excel、PowerPoint、OneNote 中使用 GitHub Copilot 或 Azure OpenAI 提供 AI 功能。

---

## 功能特色

- 🤖 **雙 AI 後端支援**：GitHub Copilot（推薦）或 Azure OpenAI（BYOK）
- 📄 **多應用支援**：Word、Excel、PowerPoint、OneNote（Notebook）
- 🔌 **WebSocket LSP Proxy**：透過 WebSocket 將前端請求橋接至 GitHub Copilot CLI（stdio）
- 🔒 **本機 HTTPS**：自簽 SSL 憑證，符合 Office Add-in 安全性要求
- 🛠️ **一鍵安裝 / 移除**：跨平台腳本支援 Windows（PowerShell）與 macOS（Bash）
- 🐞 **Debug 模式**：提供 UI、WebSocket、API 請求與 Copilot Proxy 四層 Debug 開關

---

## 系統需求

| 項目 | 需求 |
|------|------|
| Node.js | 18 或以上 |
| Office | 桌面版（Windows / macOS），不支援網頁版 |
| AI 後端 | GitHub Copilot 訂閱（推薦）**或** Azure OpenAI 服務 |
| 作業系統 | Windows 10+ 或 macOS 10.15+ |

---

## 快速開始

### Step 1：安裝依賴

```bash
npm install
```

### Step 2：設定環境變數

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

以文字編輯器開啟 `.env`，填入 Token 或 Azure 金鑰（詳見下方[環境變數說明](#環境變數說明)）。

### Step 3：生成 SSL 憑證

**Windows（PowerShell，以系統管理員身分執行）：**
```powershell
.\gen-certs-windows.ps1
```

**macOS（Terminal）：**
```bash
./gen-certs-macos.sh
```

> 憑證會產生於 `certs/` 目錄，並自動信任至系統憑證庫（開發用途）。

### Step 4：註冊 Office 增益集

**Windows（PowerShell，以系統管理員身分執行）：**
```powershell
.\register.ps1
```

**macOS（Terminal）：**
```bash
./register.sh
```

### Step 5：啟動 Server

```bash
npm start
```

Server 啟動後會監聽 `https://localhost:52390`。

### Step 6：在 Office 中開啟增益集

1. 開啟 Word / Excel / PowerPoint
2. 點選 **「常用」** 索引標籤
3. 找到 **「Joker AI」** 群組，點選 **「Joker AI 助理」** 按鈕
4. 側邊面板開啟後即可開始使用 AI 功能

---

## 環境變數說明

複製 `.env.example` 為 `.env` 並依需求填入：

### AI 後端選擇

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `USE_AZURE_BACKEND` | `false` | `true` = Azure OpenAI，`false` = GitHub Copilot |


### 方式一：GitHub Copilot（推薦）

| 變數 | 說明 |
|------|------|
| `COPILOT_GITHUB_TOKEN` | GitHub Personal Access Token（優先順序最高） |
| `GH_TOKEN` | GitHub Token（次要選項） |
| `GITHUB_TOKEN` | GitHub Token（次要選項） |

> 💡 **如何取得 GitHub Token：**
> 1. 前往 [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
> 2. 建立 Fine-grained personal access token
> 3. 加入 **"Copilot Requests"** 權限
> 4. 複製 PAT Token 填入上方任一變數

### 方式二：Azure OpenAI

| 變數 | 說明 |
|------|------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 服務端點，例如 `https://your-resource.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API 金鑰 |
| `AZURE_OPENAI_DEPLOYMENT` | 部署名稱（例如 `gpt-4o`） |
| `AZURE_OPENAI_API_VERSION` | API 版本，預設 `2025-01-01-preview` |

### Debug 模式（開發用）

| 變數 | 說明 |
|------|------|
| `DEBUG_UI` | `true` = 在增益集底部顯示 Debug 面板（連線狀態、AI 模型等） |
| `DEBUG_WS` | `true` = 在瀏覽器 Console 輸出 WebSocket 通訊詳細內容 |
| `API_LOG` | `true` = 在後端 Terminal 輸出所有 HTTP 請求/回應（自動遮罩敏感資訊） |
| `COPILOT_PROXY_DEBUG` | `true` = 在後端 Terminal 輸出 Copilot CLI stderr 與 tool call 詳細資訊 |

> ⚠️ Debug 功能**僅適用於桌面版 Office**。網頁版 Office 無法連接本機 localhost。

---

## AI 後端設定說明

### GitHub Copilot（推薦）

1. 確認擁有有效的 GitHub Copilot 訂閱
2. 在 `.env` 中設定（三選一）：
   ```env
   USE_AZURE_BACKEND=false
   COPILOT_GITHUB_TOKEN=github_pat_xxxxxxxxxxxx
   ```
3. 執行 `npm start`，系統會自動透過 WebSocket Proxy 連接至 GitHub Copilot CLI

### Azure OpenAI

1. 在 Azure Portal 建立 Azure OpenAI 資源並部署模型
2. 在 `.env` 中設定：
   ```env
   USE_AZURE_BACKEND=true
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key-here
   AZURE_OPENAI_DEPLOYMENT=your-deployment-name
   AZURE_OPENAI_API_VERSION=2025-01-01-preview
   ```
3. 執行 `npm start`，前端會透過 `/api/azure/chat` 呼叫 Azure OpenAI

---

## 如何移除增益集

**Windows（PowerShell）：**
```powershell
.\unregister.ps1
```

**macOS（Terminal）：**
```bash
./unregister.sh
```

---

## SSL 憑證說明

Office Add-in 要求所有資源必須透過 HTTPS 提供，因此本地開發需要自簽 SSL 憑證。

- 憑證存放於 `certs/` 目錄
  - `localhost.pem`：SSL 憑證
  - `localhost-key.pem`：私鑰
- 憑證由 `gen-certs-windows.ps1` 或 `gen-certs-macos.sh` 自動生成並信任
- **僅供開發使用**，請勿將憑證或私鑰上傳至公開儲存庫（已加入 `.gitignore`）

---

## 專案檔案結構

```
OfficeAdd/
├── server.js              # Node.js + Express + HTTPS 主伺服器（port 52390）
├── copilotProxy.js        # WebSocket Proxy，橋接前端 LSP 請求至 GitHub Copilot CLI
├── manifest.xml           # Office Add-in Manifest（支援 Word、Excel、PPT、OneNote）
├── index.html             # 增益集主頁面（任務面板）
├── commands.html          # 增益集命令頁面
├── package.json           # 專案設定與相依套件
├── .env.example           # 環境變數範本（複製為 .env 使用）
│
├── register.ps1           # Windows：一鍵安裝增益集腳本
├── register.sh            # macOS：一鍵安裝增益集腳本
├── unregister.ps1         # Windows：移除增益集腳本
├── unregister.sh          # macOS：移除增益集腳本
│
├── gen-certs-windows.ps1  # Windows：生成本機 SSL 憑證
├── gen-certs-macos.sh     # macOS：生成本機 SSL 憑證
│
├── assets/                # 增益集圖示（icon-16.png, icon-32.png, icon-64.png, icon-80.png）
└── certs/                 # SSL 憑證目錄（開發用，已加入 .gitignore）
    ├── localhost.pem
    └── localhost-key.pem
```

---

## 技術架構

```
Office 桌面應用
    │
    ▼
增益集前端（index.html）
    │   HTTP API (/api/*)
    │   WebSocket (/api/copilot)
    ▼
Node.js + Express HTTPS Server（port 52390）
    │
    ├── /api/config         → 回傳後端設定
    ├── /api/azure/chat     → Azure OpenAI Proxy（BYOK）
    ├── /api/upload-image   → 圖片上傳暫存
    ├── /api/fetch          → 外部 HTTP 請求 Proxy
    └── WebSocket Proxy
            │
            ▼
        GitHub Copilot CLI（stdio）
```

---

## License

此專案為私有專案。
