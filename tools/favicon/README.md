# Favicon 產生流程

Geno-Link 的 favicon 全套（6 張 PNG + 1 個多尺寸 ICO）都是從
`favicon-master.png` 這張 2048×2048 主圖用腳本產生的，不要手動修改
`public/` 底下那幾個檔案，改了下次重跑就被蓋掉。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `favicon-master.png` | 2048×2048 主圖：燕麥白底、`#B08968` 圓角方形、白色 G |
| `generate-favicons.py` | 由主圖產出 `public/` 底下所有 favicon |

## 換圖 / 重新產生

把新的方形 PNG 覆蓋成 `tools/favicon/favicon-master.png`，然後：

```bash
pip install Pillow
python3 tools/favicon/generate-favicons.py
```

會重新寫出：

```
public/favicon-16x16.png
public/favicon-32x32.png
public/favicon-48x48.png
public/favicon-96x96.png
public/favicon-192x192.png
public/favicon-512x512.png
public/favicon.ico          # 內含 16x16 / 32x32 / 48x48 三種尺寸
```

`index.html` 的 `<link rel="icon">` 已經寫死這些檔名，換圖不必動 HTML。

不想覆蓋主圖也可以直接指定來源：

```bash
python3 tools/favicon/generate-favicons.py --source ~/Downloads/new-icon.png
```

## 幾個實作上的決定

- **輸出到 `public/` 而不是 repo 根目錄。** 這是 Vite 專案，`public/` 的內容
  在 `npm run build` 時會原封不動複製到 `dist/` 根目錄，也就是網站根目錄；
  現有的 `icon.svg`、`apple-touch-icon.png` 也都放在這裡。放到 repo 根目錄
  反而不會被部署出去。
- **一律壓平成 RGB。** 原圖若是 RGBA/LA/P，會先鋪底色再縮圖（底色預設取原圖
  左上角，角落本身透明時退回 `#F5F4F0`，也可以用 `--background "#F5F4F0"`
  指定）。留著透明通道的話，某些桌面捷徑與工作列會把透明區塊算成黑色。
- **每個尺寸都直接從 2048 縮一次。** 不做 2048→512→96→32 的接力縮圖，避免
  誤差累積讓小尺寸糊掉。縮圖一律用 LANCZOS。
- **ICO 是手工打包的。** Pillow 內建的 ICO writer 會自己用 BICUBIC 重縮，
  16×16 會明顯糊；`generate-favicons.py` 改成先各自 LANCZOS 縮好，再以
  32-bit BGRA 的 BMP(DIB) 格式塞進 ICO 容器，相容性也最廣。

## 主圖

`favicon-master.png` 是原始設計稿的 2048×2048 輸出，未經裁切或重壓，
`public/` 底下所有 favicon 都由它產生。它本身帶 alpha 通道但整張不透明，
產生器會照常壓平成 RGB。
