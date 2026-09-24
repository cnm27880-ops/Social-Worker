import { useEffect, useRef, useState } from 'react';
import { subscribeDialog, closeDialog } from '../utils/dialog';

/* 畫面正中央的小卡片（見 utils/dialog.js）。Enter＝確定、Esc＝取消，
 * 點卡片外面也是取消；焦點一打開就放在「確定」上，鍵盤操作不用先找按鈕。 */
const DialogHost = () => {
  const [dlg, setDlg] = useState(null);
  const okRef = useRef(null);

  useEffect(() => subscribeDialog(d => setDlg(d ? d.opts : null)), []);

  useEffect(() => {
    if (!dlg) return;
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(dlg.kind === 'alert'); }
      // 攔在 window 的捕獲階段：畫布那邊的單鍵快捷鍵不會在視窗開著時被觸發
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dlg]);

  if (!dlg) return null;
  const isAlert = dlg.kind === 'alert';
  return (
    <div className="dlg-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog(isAlert); }}>
      <div className="dlg-card" role="alertdialog" aria-modal="true"
           aria-labelledby={dlg.title ? 'dlg-title' : undefined} aria-describedby="dlg-msg">
        {dlg.title && <div className="dlg-title" id="dlg-title">{dlg.title}</div>}
        <div className="dlg-msg" id="dlg-msg">{dlg.message}</div>
        <div className="dlg-actions">
          {!isAlert && (
            <button type="button" className="dlg-btn" onClick={() => closeDialog(false)}>{dlg.cancelText}</button>
          )}
          <button type="button" ref={okRef}
                  className={`dlg-btn primary ${dlg.danger ? 'danger' : ''}`}
                  onClick={() => closeDialog(true)}>{dlg.confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default DialogHost;
