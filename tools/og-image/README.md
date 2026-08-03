# 搜尋預覽圖（og:image）產生說明

`public/` 底下三張預覽圖都是由這個資料夾的 HTML 樣板截圖產生的：

| 輸出檔案                   | 尺寸        | 用途                                        | 樣板                        |
| -------------------------- | ----------- | ------------------------------------------- | --------------------------- |
| `public/og-image.png`      | 1200 × 630  | `og:image`、Twitter Card、社群分享縮圖      | `og-image-1200x630.html`    |
| `public/preview-4x3.png`   | 1200 × 900  | JSON-LD `image`（4:3，Google 搜尋縮圖候選） | `og-image-vertical.html`    |
| `public/preview-1x1.png`   | 1200 × 1200 | JSON-LD `image`（1:1，Google 搜尋縮圖候選） | `og-image-vertical.html`    |

## 重新產生

樣板的高度由 CSS 變數 `--stage-h` / `--card-h` 控制（在檔案最上方的 `:root`）。
直高版本兩種比例的建議值：

* 4:3 → `--stage-h: 900px; --card-h: 400px;`
* 1:1 → `--stage-h: 1200px; --card-h: 680px;`

用任何 Chromium 核心瀏覽器的無頭模式截圖即可（`--window-size` 要和樣板高度一致）：

```bash
chrome --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot=../../public/og-image.png og-image-1200x630.html
```

> 注意：請使用舊版 headless（或 `headless_shell`）。`--headless=new` 會保留視窗邊框高度，
> 截圖底部會被裁掉約 70px。

## 想換成自己的圖？

直接用同名檔案覆蓋 `public/og-image.png` 就好，`index.html` 不用改。條件：

* 尺寸 1200 × 630（1.91:1），至少 600 × 315
* 檔案小於 1MB（LINE 的上限）
* 重點內容集中在中央：Google 手機搜尋的縮圖是**正方形裁切**，左右兩側會被切掉

換圖後 `index.html` 裡的 `og:image:width` / `og:image:height` 與 JSON-LD 的
`width` / `height` 要一起改成新尺寸。
