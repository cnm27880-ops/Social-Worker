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
│   ├── TextBoxItem.jsx     # 畫布上的單一文字方塊（選取框、刪除／複製／縮放把手）
│   ├── CustomLinkPanel.jsx # 左側「擴充連線設定」卡片（含掛在婚姻線下的子女）
│   ├── CaseMenu.jsx        # 案件清單（搜尋、排序、案號備註、另存、全部備份、空間用量）
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
│   ├── exportImage.js      # 下載 PNG／JPG、列印 A4、裁切範圍計算
│   ├── textBox.js          # 文字方塊尺寸估算、直式排版、吸附到節點
│   ├── age.js              # 民國生年 ⇄ 實歲的判斷與換算
│   ├── standalone.js       # 獨立個體（三角、寵物）的類型與形狀
│   ├── statusBadge.js      # 狀態標籤的點擊／滾輪切換
│   ├── ids.js              # 畫布物件 id 產生器（同一毫秒不撞號）
│   ├── childLinks.js       # 子女放置區、掛在夫妻或單親底下的子女
│   ├── familyLayout.js     # 主家系與擴充子代的排版（畫布與個案紀錄共用）
│   ├── kinship.js          # 從連線推算跟案主的關係與稱謂
│   ├── __tests__/          # Vitest 單元測試（純函式）
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
- **執行測試**：`npm test`（Vitest；`npm run test:watch` 會在存檔時自動重跑）。PR 與部署前 CI 都會跑。

---

## 已完成的功能（勿重做）

- **民國生年 ⇄ 實歲**：`doc.ageDisplay`（'raw' | 'age'）只影響顯示，`ages` 永遠存原字串。換算 = 今年民國年 − 生年；`82y`／`82yo`／純數字視為年齡；已歿成員不換算。見 `utils/age.js`。
- **個案 JSON 匯入／匯出**：`CaseBar.jsx` + `useCaseDoc.js` 的 `exportCase`／`importCase`。
- **標籤吸附**：文字方塊可帶 `anchor: { id, side }`，拖到節點旁自動吸附、拉遠解開、Shift 拖曳不吸附；左右兩側自動直式。第二代索引搬遷時 `remapGen2Keys` 會一起搬標籤。見 `utils/textBox.js`。
- **高解析 PNG**：下載一律 3 倍圖（`EXPORT_SCALE`）。
- **寵物符號（菱形）**：自由擴充區的獨立個體，拖到飼主身上產生註記連線。
- **文字方塊複製**：選取後按 ⧉ 或 Ctrl+D。
- **子女放置區**：拖曳時夫妻婚姻線下方／單身者正下方出現「↓子女」，放進去成為子女（`doc.childLinks`，`lineId` 或單親 `parentId`）。自由擴充成員與主家系中沒有父母的人（配偶、第一代）都能放。見 `utils/childLinks.js`。
- **稱謂推算**：`utils/familyLayout.js` 是畫布與紀錄共用的排版；`utils/kinship.js` 從案主沿婚姻／親子／手足走最短路徑，產生「案岳父」「案妻之弟」這類稱謂，寫進個案紀錄最後幾行（不加任何輸入欄位）。
- **案件庫**：案號／備註、搜尋排序、另存成新案件、一次備份全部（`geno-link-backup` 格式，匯入按鈕通吃）、備份提醒、本機空間用量。見 `utils/caseStore.js`、`components/CaseMenu.jsx`。

---

## 開發守則與注意事項

- **不要隨意引入第三方龐大函式庫**：維持純原生 JS / Canvas / SVG 輕量架構，保持打包體積精簡與秒開速度。
- **嚴守個資隱私安全**：不得在未經使用者授權下將案主姓名、病歷等資料傳送至任何外部 API 或遙測伺服器。
- **CSS 規範**：盡量沿用 `styles.css` 定義的 CSS 變數（如主題色、陰影、邊框半徑、網格大小），維持介面視覺一致性。
- **相容性考量**：台灣社工單位與社福機構經常使用舊版 Windows 或公家限定環境，避免使用過於前沿且未 polyfill 的瀏覽器語法。
