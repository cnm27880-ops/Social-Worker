import { useEffect } from 'react';
import { CATEGORIES, SYMBOLS } from '../utils/symbols';
import { SymbolPreview } from './SymbolPreview';

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
                <tr><td><kbd>A</kbd></td><td>開／關快捷列表的符號選取狀態</td></tr>
                <tr><td><kbd>S</kbd></td><td>快捷列表選取狀態下，焦點切到左邊的符號</td></tr>
                <tr><td><kbd>D</kbd></td><td>快捷列表選取狀態下，焦點切到右邊的符號</td></tr>
                <tr><td><kbd>W</kbd></td><td>切換「案主」標記模式</td></tr>
                <tr><td><kbd>E</kbd></td><td>切換「同住」標記模式</td></tr>
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
              <li><b>狀態標籤</b>：點擊即可切到下一個狀態；滑鼠停在上面滾動滾輪也可以（且能雙向切換）。</li>
              <li><b>文字方塊</b>：單擊選取或縮放；雙擊直接打字，可按 Enter 換行。</li>
              <li><b>自由連線</b>：拖曳「🧩 自由擴充區」新增的個體去碰撞目標即產生連線；雙擊關係線可刪除。</li>
              <li><b>自由擴充區</b>：點「男性」「女性」「三角」「生態圖」按鈕即新增一個獨立個體到畫布上，
                  跟快捷列表「點選既有節點套用標記」是兩回事。</li>
              <li><b>生態圖</b>：新增後預設連結案主，雙擊圖形可編輯文字，清空文字即刪除。</li>
            </ul>
            <h4>面板配置</h4>
            <ul>
              <li>卡片標題旁的 <b>ⓘ</b> 滑過即顯示該區塊的操作說明，說明不再常駐佔空間。</li>
              <li><b>⬇ 下載</b>點下去就是直接存一張高解析 PNG（3 倍圖、白底）；
                  旁邊的 <b>▼</b> 才是 JPG、去背 PNG 與列印／A4 PDF。</li>
            </ul>
          </section>

          <section>
            <h3>快捷列表</h3>
            <p className="help-note">
              面板最上方，資料輸入面板下面。只留 6 個最常用的狀態／關係標記：死亡、身障、
              慢性病（套在人物節點上），以及正向親密、衝突、關係惡化（套在婚姻線上）。
              滑鼠停在符號上會顯示簡短名稱；符號依你用過的次數排序，常用的會自己浮到最前面。
              這 6 個都是「套用在既有節點／連線上」的標記，不會在畫布上生出新的個體——
              需要新增獨立個體（男性、女性、三角、生態圖）請用下面「🧩 自由擴充區」的按鈕。
            </p>
            <p>
              兩種套用方式，效果完全一樣：
            </p>
            <ul>
              <li><b>拖曳</b>：直接把符號拖到人物節點或婚姻線上放開即套用；拖曳過程中
                  經過的目標不會被更動，只有放開的位置算數，放開在不適用的地方等於
                  取消。</li>
              <li><b>鍵盤選取</b>：按 <kbd>A</kbd> 開啟選取狀態（再按一次關閉），
                  用 <kbd>S</kbd>／<kbd>D</kbd> 把焦點切到左／右邊的符號（也可以直接
                  點符號本身選取），選中後點畫布上的目標即套用，跟拖曳是同一套邏輯。</li>
            </ul>
            <p className="help-note">
              兩種方式都是<b>套用／再套一次取消（Toggle）</b>：人物標記（死亡、身障、慢性病）
              再套用到同一個已有該標記的節點上就會移除；婚姻線標記（正向親密、衝突、關係惡化）
              再套用同一種樣式到同一條線上，會把該線還原成預設實線，套用不同樣式則直接覆蓋成新樣式。
            </p>
            <p className="help-note">
              「案主」（<kbd>W</kbd>）與「同住」（<kbd>E</kbd>）不在這 6 個裡面——
              它們是畫布模式而不是符號標記，沿用原本點按鈕（或按快捷鍵）進入模式、
              再點人物套用的方式，就在快捷列表的上半段，跟符號列的 <kbd>A</kbd>／
              <kbd>S</kbd>／<kbd>D</kbd> 是各自獨立的開關。
            </p>
            <p>
              所有套用都可以用 <kbd>Ctrl</kbd>＋<kbd>Z</kbd> 復原。
            </p>
          </section>

          <section>
            <h3>符號對照</h3>
            <p className="help-note">
              畫法依 GenoPro 標準符號說明與 McGoldrick, Gerson &amp; Petry
              《Genograms: Assessment and Intervention》所建立的通用符號集。
              各家畫法略有差異，以下為本工具採用的版本。「快捷列表」是套在既有節點／
              婚姻線上的 6 個狀態標記；「自由擴充區」的三角是點按鈕即新增到畫布上的
              獨立個體。其餘標了「舊版，僅供對照」的分類沒有 UI 入口可以新增，只是為了
              讓已經標記過的舊案件還能正確畫出來、查得到畫法出處。
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
              <li><b>儲存</b>（磁碟片圖示）：第一次按會請你命名，之後這份案件才會進案件庫，
                  並開始<b>自動儲存後續變更</b>與<b>記錄時間軸</b>。</li>
              <li>已儲存的案件再按一次「儲存」就是立刻存檔，並在時間軸上留一個節點。</li>
              <li><b>時間軸</b>（案件列的時鐘圖示）：列出每次儲存的節點，可命名、可還原回那個時間點；
                  還原錯了能用 <kbd>Ctrl</kbd>＋<kbd>Z</kbd> 復原這次還原。案件未儲存時是停用的。</li>
              <li>案件列的 <b>▾</b> 可開啟已儲存的案件；名稱點一下即可改名。
                  要開一份新的，重新整理或另開分頁就是乾淨畫布。</li>
              <li><b>匯出／匯入</b> <code>.json</code>（案件列最右邊兩顆）：備份或交接用；匯入一律新增一份，不覆蓋目前的內容。
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
