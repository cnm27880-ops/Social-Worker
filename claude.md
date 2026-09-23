# CLAUDE.md - Geno-Link (Social-Worker) 開發指引

## 專案概述
- **專案名稱**：Geno-Link (Social-Worker)
- **定位**：專為台灣社工、心理師及家庭工作者設計的免安裝、純前端個案紀錄與家系圖（Genogram）繪製系統。
- **技術棧**：React (Vite) + 純 CSS + HTML5 Canvas / SVG 混合繪製 + 本地端 LocalStorage。
- **核心原則**：隱私第一（零雲端傳輸、100% 本地儲存）、高實務貼合度、無第三方重量級 UI 框架相依。

---

## 專案架構與目錄責任切分

src/
├── components/          # 視圖層元件
│   ├── CaseBar.jsx         # 頂部個案資訊列（案號、主要案主、換案、匯出）
│   ├── GenogramTab.jsx     # 家系圖核心畫布（畫布操作、節點拖拉、連線、快捷列）
│   ├── RecordTab.jsx       # 個案紀錄編輯器（處遇紀錄、家庭結構摘要轉換）
│   ├── ImagePatchPanel.jsx # 影像貼圖/底圖輔助面板
│   ├── SnapshotMenu.jsx    # 本地歷史快照版本選單
│   ├── BadgeGroup.jsx      # 符號與狀態徽章元件
│   └── InfoTip.jsx         # 浮動提示小工具
├── hooks/               # 自訂商業邏輯 Hooks
│   ├── useCaseDoc.js       # 核心個案文檔狀態管理（整合畫布、紀錄與快照）
│   └── useFullscreen.js    # 全螢幕切換功能
├── utils/               # 工具函式與常數定義
│   ├── symbols.js          # 家系圖/生態圖標準符號、線條型態與渲染常數
│   ├── caseDoc.js          # 個案資料結構驗證、結構轉文字演算法
│   ├── caseStore.js        # LocalStorage 個案持久化儲存管理
│   ├── snapshotStore.js    # 快照歷史儲存機制
│   ├── bgImage.js          # 底圖處理相關公用函式
│   ├── imageMeta.js        # 圖片中繼資料與匯出輔助
│   └── helpers.js          # 幾何運算、坐標吸附、防抖、格式轉換
├── styles.css           # 全域 CSS（色彩變數、畫布網格、響應式斷點）
├── App.jsx              # 應用程式入口（頁籤切換：家系圖 ⇄ 處遇紀錄）
└── main.jsx             # React DOM 掛載點

---

## 核心狀態與資料流架構

1. **單一資料來源（Single Source of Truth）**：
   - 所有的個案狀態由 `hooks/useCaseDoc.js` 統一控管，透過事件/Reducer 模式分發狀態變更。
   - 資料包含：
     - `caseInfo`：案號、個案名稱、主要案主 ID。
     - `genogram`：`nodes`（所有家族成員節點坐標、形狀、年齡、性別、狀態標記）、`lines`（關係線、夫妻線、親子線）、`textBoxes`（獨立文字方塊）。
     - `record`：結構化評估內容與文字紀錄。

2. **座標與磁吸系統**：
   - 由 `utils/helpers.js` 提供網格對齊計算（Grid Snapping），畫布上所有節點拖曳均預設對齊網格點。

3. **個案儲存與快照**：
   - `utils/caseStore.js` 透過 `localStorage` 儲存多個案文件。
   - `utils/snapshotStore.js` 定期或手動產生畫布快照（Undo/Redo 與版本復原）。

---

## 常用指令 (Development & Build)

- **安裝依賴**：`npm install`
- **本機啟動**：`npm run dev`
- **打包建置**：`npm run build`
- **預覽打包**：`npm run preview`

---

## 即將推動的核心更新任務清單 (Roadmap)

在進行功能開發時，請遵循以下方向與設計規範：

1. **民國出生年一鍵批次轉歲數**：
   - 節點肚子裡的文字支援彈性輸入（如 `35`、`82年`、`82年次`、`民82`）。
   - 在工具列或操作面新增「民國生年 ⇄ 實歲」一鍵轉換切換鈕。
   - 計算基準：`當前民國年 (new Date().getFullYear() - 1911) - 輸入生年`。
   - `82y` / `82yo` 視為實歲，不觸發換算。

2. **個案 JSON 備份檔匯入 / 匯出**：
   - 於 `CaseBar.jsx` / `caseStore.js` 擴充「匯出備份 (.json)」與「匯入檔案還原」功能。
   - 必須相容現有 `caseDoc` 資料格式，純前端 FileReader 讀取，不得將資料上傳遠端。

3. **節點標籤自動吸附連動**：
   - 改善原本獨立 `textBoxes` 拖曳時容易與人偶分離的痛點。
   - 支援節點自帶主標籤（稱謂/姓名），並允許方位切換（上、下、左、右），拖曳節點時標籤保持相對偏移連動。

4. **高解析度 PNG 匯出 (High-DPI 2x/3x)**：
   - 在匯出選單中增加「高解析度列印專用 PNG」選項。
   - 於 `helpers.js` 或匯出處理邏輯使用 Offscreen Canvas 放大 scale（2x~3x）重繪，確保貼入 Word / 列印 A4 銳利不模糊。

5. **自由擴充區新增特殊符號**：
   - 在 `utils/symbols.js` 擴充「寵物（菱形符號）」與相應的繪製/匯出邏輯。

---

## 開發守則與注意事項

- **不要隨意引入第三方龐大函式庫**：維持純原生 JS / Canvas / SVG 輕量架構，保持打包體積精簡與秒開速度。
- **嚴守個資隱私安全**：不得在未經使用者授權下將案主姓名、病歷等資料傳送至任何外部 API 或遙測伺服器。
- **CSS 規範**：盡量沿用 `styles.css` 定義的 CSS 變數（如主題色、陰影、邊框半徑、網格大小），維持介面視覺一致性。
- **相容性考量**：台灣社工單位與社福機構經常使用舊版 Windows 或公家限定環境，避免使用過於前沿且未 polyfill 的瀏覽器語法。
