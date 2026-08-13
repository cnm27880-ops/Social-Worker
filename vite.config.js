import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* 把 build 產出的 CSS 直接內嵌進 index.html，取代原本的 <link rel="stylesheet">。
 *
 * 為什麼要這樣做：外部樣式表會阻斷首次算繪（render-blocking），瀏覽器得多跑一趟
 * 來回才能開始畫面。本站的樣式只有 src/styles.css 一份，壓縮後約 7 kB，整份塞進
 * HTML 的成本遠低於多一次請求的延遲。
 *
 * 為什麼不抽 Critical CSS：那需要分析「已渲染的 DOM」來判斷首屏用到哪些規則，但本站
 * 是 React SPA，HTML 裡只有一個空的 <div id="root">，抽取工具在那個階段看不到任何
 * 東西。整份內嵌則不可能漏掉規則，也就不會有無樣式閃爍（FOUC）。
 *
 * 為什麼不怕失去快取：GitHub Pages 對所有檔案一律回 Cache-Control: max-age=600，
 * 且不支援自訂 HTTP 標頭，CSS 本來就享受不到長期快取，內嵌沒有損失。
 * （這條註解在哪天換掉部署平台、能自訂標頭之後就不再成立，屆時值得重新評估。） */
function inlineCss() {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      /* order: 'post' 確保跑在 Vite 內建的 HTML 處理之後——那時候 <link> 標籤才
       * 已經指向帶 hash 的最終檔名，也才能從 bundle 裡撈到對應的內容。 */
      order: 'post',
      handler(html, ctx) {
        /* dev server 沒有 bundle，直接放行走原本的流程 */
        if (!ctx.bundle) return html;

        return html.replace(
          /<link\b[^>]*\brel="stylesheet"[^>]*>/g,
          (tag) => {
            const href = tag.match(/\bhref="([^"]+)"/)?.[1];
            if (!href) return tag;

            /* href 因為 base: './' 會長成 "./assets/index-xxxx.css"，
             * 但 bundle 的 key 是不帶前綴的 "assets/index-xxxx.css"。 */
            const fileName = href.replace(/^\.?\//, '');
            const asset = ctx.bundle[fileName];
            if (!asset || asset.type !== 'asset') return tag;

            const css = String(asset.source);
            /* CSS 內容若含有 "</style"（例如某個 content: 屬性裡的字串），內嵌後會
             * 提早關閉標籤、把後半段樣式當成 HTML 解析。與其產出一個壞掉的頁面，
             * 不如讓 build 直接失敗，這種情況才不會悄悄上線。 */
            if (/<\/style/i.test(css)) {
              throw new Error(
                `[inline-css] ${fileName} 內含 "</style"，無法安全內嵌。` +
                '請改寫該處樣式，或改回外部 CSS 載入。'
              );
            }

            /* 內容已經搬進 HTML，把獨立的 .css 檔從產出中移除，避免 dist 留下
             * 一個沒有人引用的孤兒檔案。 */
            delete ctx.bundle[fileName];
            return `<style>${css}</style>`;
          }
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineCss()],
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
  },
});
