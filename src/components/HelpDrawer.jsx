import { useEffect } from 'react';
import { CATEGORIES, SYMBOLS } from '../utils/symbols';
import { SymbolPreview } from './SymbolToolbox';

/**
 * 使用說明書。
 *
 * 滑過右上角圖示只顯示一行提示（由 title 屬性負責），點擊才開啟這個面板 ——
 * 一整頁說明需要能捲動、能邊看邊操作，hover 一離開就關掉會不好用。
 */
const HelpDrawer = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="help-overlay" onClick={onClose}>
      <aside className="help-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label="使用說明">
        <header className="help-head">
          <h2>使用說明</h2>
          <button className="help-close" onClick={onClose} aria-label="關閉說明">×</button>
        </header>

        <div className="help-body">
          <section>
            <h3>快捷鍵</h3>
            <table className="help-keys">
              <tbody>
                <tr><td><kbd>Q</kbd></td><td>切換「案主」標記模式</td></tr>
                <tr><td><kbd>W</kbd></td><td>切換「身心障礙」標記模式</td></tr>
                <tr><td><kbd>E</kbd></td><td>切換「同住」標記模式</td></tr>
                <tr><td><kbd>R</kbd></td><td>切換「死亡」標記模式</td></tr>
                <tr><td><kbd>Ctrl</kbd>＋<kbd>Z</kbd></td><td>復原</td></tr>
                <tr><td><kbd>Ctrl</kbd>＋<kbd>Shift</kbd>＋<kbd>Z</kbd></td><td>重做</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>取消目前的拖曳或繪製</td></tr>
                <tr><td><kbd>?</kbd></td><td>開啟這份說明</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h3>基本操作</h3>
            <ul>
              <li><b>節點</b>：單擊依目前模式標記；雙擊可輸入年齡（需先開啟「年齡」）。</li>
              <li><b>狀態標籤</b>：滑鼠停在標籤上滾動滾輪即可切換。</li>
              <li><b>文字方塊</b>：單擊選取或縮放；雙擊直接打字，可按 Enter 換行。</li>
              <li><b>自由連線</b>：拖曳「🧩 擴充個體」去碰撞目標即產生連線；雙擊關係線可刪除。</li>
              <li><b>生態圖</b>：新增後預設連結案主，雙擊圖形可編輯文字，清空文字即刪除。</li>
            </ul>
            <h4>面板配置</h4>
            <ul>
              <li>卡片標題旁的 <b>ⓘ</b> 滑過即顯示該區塊的操作說明，說明不再常駐佔空間。</li>
              <li><b>積木工具箱</b>的符號依你用過的次數排序，常用的會自己浮到分類前面。</li>
              <li><b>⬇ 下載圖片</b>點下去就是直接存一張高解析 PNG（3 倍圖、白底）；
                  旁邊的 <b>▼</b> 才是 JPG、去背 PNG 與列印／A4 PDF。</li>
            </ul>
          </section>

          <section>
            <h3>積木工具箱</h3>
            <p className="help-note">
              工具箱只放<b>進階的臨床標記</b>。「案主」「身心障礙」「死亡」在面板上方的
              快捷工具列（<kbd>Q</kbd>／<kbd>W</kbd>／<kbd>R</kbd>）操作，不重複收在工具箱裡。
            </p>
            <p>
              從左側工具箱<b>拖曳符號放開</b>即可套用：拖到人物上是個人標記，
              拖到婚姻線上是關係品質，拖到空白畫布則新增一個獨立個體
              （懷孕／流產／死產）。拖曳過程中經過的目標不會被更動，只有
              放開的位置算數；放開在不適用的地方等於取消。已經套用過的
              再拖一次就是取消。所有操作都可以用
              <kbd>Ctrl</kbd>＋<kbd>Z</kbd> 復原。
            </p>
          </section>

          <section>
            <h3>符號對照</h3>
            <p className="help-note">
              畫法依 GenoPro 標準符號說明與 McGoldrick, Gerson &amp; Petry
              《Genograms: Assessment and Intervention》所建立的通用符號集。
              各家畫法略有差異，以下為本工具採用的版本。
            </p>
            {CATEGORIES.map(cat => {
              const items = SYMBOLS.filter(s => s.category === cat.key);
              if (!items.length) return null;
              return (
                <div className="help-symgroup" key={cat.key}>
                  <h4>{cat.label}</h4>
                  {items.map(s => (
                    <div className="help-sym" key={s.key}>
                      <span className="help-sym-icon"><SymbolPreview symbol={s} size={28} /></span>
                      <div>
                        <b>{s.label}</b>
                        {s.shortcut && <span className="help-sym-key">快捷鍵 {s.shortcut}</span>}
                        <div className="help-sym-desc">{s.desc}</div>
                        {s.note && <div className="help-sym-note">{s.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>

          <section>
            <h3>舊圖修補</h3>
            <p>
              手邊已經畫好的家系圖（掃描或手機拍的）可以匯入當<b>底圖</b>，
              直接在上面疊新的符號、關係線與文字方塊，不必整張重畫。
            </p>
            <ul>
              <li>左側「🖼️ 舊圖修補」上傳 JPG／PNG／WebP；長邊超過 1600px 會自動縮圖。</li>
              <li><b>透明度</b>調淡一點比較好對位，<b>縮放</b>可讓舊圖對齊你要疊的節點大小。</li>
              <li><b>🧽 橡皮擦</b>：開啟後在畫布上拖曳即可抹掉舊線條。擦除模式下不會誤拖到節點；每一筆都能 <kbd>Ctrl</kbd>＋<kbd>Z</kbd> 復原。</li>
              <li>下載或列印時，底圖與新疊上去的內容會<b>合併成同一張圖</b>。</li>
            </ul>
          </section>

          <section>
            <h3>存檔與案件</h3>
            <p className="help-note">
              這個工具<b>預設不留痕跡</b>：每次開啟網頁都是一張乾淨的空白畫布，
              在你按下「儲存案件」之前，什麼都不會寫進這台電腦。
            </p>
            <ul>
              <li><b>💾 儲存案件</b>：第一次按會請你命名，之後這份案件才會進案件庫，
                  並開始<b>自動儲存後續變更</b>與<b>記錄時間軸</b>。</li>
              <li>已儲存的案件再按 💾 就是立刻存檔，並在時間軸上留一個節點。</li>
              <li><b>🕰️ 時間軸</b>：列出每次儲存的節點，可命名、可還原回那個時間點；
                  還原錯了能用 <kbd>Ctrl</kbd>＋<kbd>Z</kbd> 復原這次還原。案件未儲存時是停用的。</li>
              <li>案件列的 <b>▾</b> 可開啟已儲存的案件；名稱點一下即可改名。
                  要開一份新的，重新整理或另開分頁就是乾淨畫布。</li>
              <li><b>⤓ 匯出／⤒ 匯入</b> <code>.json</code>：備份或交接用；匯入一律新增一份，不覆蓋目前的內容。
                  未儲存的草稿也可以直接匯出。</li>
              <li>資料只存在<b>這台電腦的瀏覽器</b>，不會上傳到任何伺服器；清除瀏覽器資料會一併清掉，
                  重要案件請匯出保存。</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default HelpDrawer;
