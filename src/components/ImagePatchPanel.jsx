import { useRef, useState } from 'react';
import InfoTip from './InfoTip';
import { loadBgImage, MAX_EDGE } from '../utils/bgImage';

const TIP = '把手邊已經畫好的家系圖（掃描或拍照）匯入當底圖，在上面直接疊符號、'
  + '關係線與文字方塊；用橡皮擦抹掉不要的舊線條。下載時會自動合併成一張新圖。';

/**
 * 舊圖修補：底圖上傳與橡皮擦控制。
 *
 * 只負責「設定」，實際的擦除筆跡是在畫布上畫的（見 GenogramTab 的 erase 模式）。
 * 底圖與筆跡都在案件文件裡，所以兩者都能 Ctrl+Z 復原、都會跟著案件存檔與匯出。
 */
const ImagePatchPanel = ({
  bgImage, setBgImage,
  bgErase, setBgErase,
  eraseMode, setEraseMode,
  eraseWidth, setEraseWidth,
}) => {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';          // 選同一個檔案也要能再次觸發
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      setBgImage(await loadBgImage(file));
      setBgErase([]);             // 換底圖就不該留著上一張的擦除筆跡
    } catch (err) {
      setError(err.message || '匯入圖片失敗。');
    } finally {
      setBusy(false);
    }
  };

  const patch = (fields) => setBgImage(prev => (prev ? { ...prev, ...fields } : prev));

  const removeImage = () => {
    if (!window.confirm('移除底圖？擦除筆跡也會一併清掉（可用「復原」還原）。')) return;
    setBgImage(null);
    setBgErase([]);
    setEraseMode(false);
  };

  return (
    <div className="section">
      <div className="section-title-row">
        <label>🖼️ 舊圖修補</label>
        <InfoTip text={TIP} />
      </div>

      {!bgImage ? (
        <>
          <button className="btn-soft tone-dust" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? '處理中…' : '＋ 上傳舊圖'}
          </button>
          <div className="hint">支援 JPG／PNG／WebP，長邊超過 {MAX_EDGE}px 會自動縮圖。</div>
        </>
      ) : (
        <>
          <div className="bg-slider">
            <span>透明度</span>
            <input
              type="range" min="10" max="100" step="5"
              value={Math.round((bgImage.opacity ?? 0.55) * 100)}
              onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
            />
            <b>{Math.round((bgImage.opacity ?? 0.55) * 100)}%</b>
          </div>

          <div className="bg-slider">
            <span>縮放</span>
            <input
              type="range" min="25" max="200" step="5"
              value={Math.round((bgImage.scale ?? 1) * 100)}
              onChange={e => patch({ scale: Number(e.target.value) / 100 })}
            />
            <b>{Math.round((bgImage.scale ?? 1) * 100)}%</b>
          </div>

          <div className="btn-row bg-tools">
            <button
              className={`btn-toggle ${eraseMode ? 'on' : ''}`}
              onClick={() => setEraseMode(m => !m)}
              aria-pressed={eraseMode}
              title="在底圖上拖曳即可抹除舊線條"
            >🧽 橡皮擦</button>
            <button className="btn-soft tone-dust" onClick={() => fileRef.current?.click()} disabled={busy}>換圖</button>
            <button className="btn-soft tone-clay" onClick={removeImage}>移除底圖</button>
          </div>

          {eraseMode && (
            <div className="bg-slider">
              <span>筆刷</span>
              <input
                type="range" min="6" max="60" step="2"
                value={eraseWidth}
                onChange={e => setEraseWidth(Number(e.target.value))}
              />
              <b>{eraseWidth}px</b>
            </div>
          )}

          {bgErase.length > 0 && (
            <div className="bg-erase-row">
              <span className="hint" style={{ margin: 0 }}>擦除筆跡 {bgErase.length} 筆</span>
              <button className="btn-soft tone-muted btn-soft-xs" onClick={() => setBgErase([])}>清除筆跡</button>
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
        onChange={onPick} style={{ display: 'none' }}
      />

      {error && (
        <div className="case-error" style={{ marginTop: '8px' }}>
          {error}
          <button onClick={() => setError('')} aria-label="關閉">×</button>
        </div>
      )}
    </div>
  );
};

export default ImagePatchPanel;
