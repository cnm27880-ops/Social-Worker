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
          </section>

          <section>
            <h3>積木工具箱</h3>
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
            <h3>案件與存檔</h3>
            <ul>
              <li>編輯內容會<b>自動儲存在這台電腦的瀏覽器裡</b>，不會上傳到任何伺服器。</li>
              <li>面板最上方可切換、新增、改名、刪除案件。案件名稱預設為化名，點一下即可修改。</li>
              <li>可將案件匯出成 <code>.json</code> 檔備份或交接；匯入時會新增一份，不會覆蓋目前的案件。</li>
              <li>清除瀏覽器資料會一併清掉這些案件，重要案件請記得匯出保存。</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default HelpDrawer;
