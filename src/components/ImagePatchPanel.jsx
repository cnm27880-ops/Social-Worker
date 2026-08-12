import { useRef, useState } from 'react';
import InfoTip from './InfoTip';
import {
  loadBgImage, bgZoomPct, bgScaleFromPct, bgImageBox,
  MAX_EDGE, MAX_EDGE_SELF, DEFAULT_OPACITY, BG_X, BG_Y,
} from '../utils/bgImage';

const TIP = '把手邊已經畫好的家系圖（掃描或拍照）匯入當底圖，在上面直接疊符號、'
  + '關係線與文字方塊；用橡皮擦抹掉不要的舊線條。下載時會自動合併成一張新圖。'
  + '匯入本站下載過的圖時，位置與大小會自動對回原稿。';

/**
 * 舊圖修補：底圖上傳、定位與橡皮擦控制。
 *
 * 只負責「設定」，實際的搬動、縮放與擦除筆跡都是在畫布上操作的
 * （見 GenogramTab 的 bgAdjust 與 erase 兩個模式）。底圖與筆跡都在案件
 * 文件裡，所以兩者都能 Ctrl+Z 復原、都會跟著案件存檔與匯出。
 */
const ImagePatchPanel = ({
  bgImage, setBgImage, importBgImage,
  bgErase, setBgErase,
  eraseMode, setEraseMode,
  eraseWidth, setEraseWidth,
  bgAdjust, setBgAdjust,
  mainFamily, setMainFamily,
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
      // importBgImage 會順便判斷要不要收起主家系，並算成同一筆歷史
      importBgImage(await loadBgImage(file));
    } catch (err) {
      setError(err.message || '匯入圖片失敗。');
    } finally {
      setBusy(false);
    }
  };

  const patch = (fields) => setBgImage(prev => (prev ? { ...prev, ...fields } : prev));

  /* 兩個模式共用畫布上的拖曳，同時開著會互相搶事件，所以互斥。 */
  const toggleAdjust = () => { setBgAdjust(v => !v); setEraseMode(false); };
  const toggleErase = () => { setEraseMode(v => !v); setBgAdjust(false); };

  /** 回到匯入當下算出來的位置與大小（本站下載圖＝原稿的位置與大小）。 */
  const resetPlacement = () => patch({
    x: bgImage.baseX ?? BG_X,
    y: bgImage.baseY ?? BG_Y,
    scale: bgImage.baseScale || bgImage.scale || 1,
  });

  const removeImage = () => {
    if (!window.confirm('移除底圖？擦除筆跡也會一併清掉（可用「復原」還原）。')) return;
    setBgImage(null);
    setBgErase([]);
    setEraseMode(false);
    setBgAdjust(false);
  };

  const box = bgImageBox(bgImage);
  const zoom = bgImage ? bgZoomPct(bgImage) : 100;
  const placed = bgImage
    && Math.round(bgImage.x ?? BG_X) === Math.round(bgImage.baseX ?? BG_X)
    && Math.round(bgImage.y ?? BG_Y) === Math.round(bgImage.baseY ?? BG_Y)
    && zoom === 100;

  return (
    <div className="section">
      <div className="section-title-row">
        <label>🖼️ 舊圖修補</label>
        <InfoTip text={TIP} />

        {/* 尚未上傳圖片時，把「＋ 上傳舊圖」按鈕放到標題列右側 */}
        {!bgImage && (
          <button
            className="btn-soft tone-dust"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{ marginLeft: 'auto' }}
          >
            {busy ? '處理中…' : '＋ 上傳舊圖'}
          </button>
        )}
      </div>

      {!bgImage ? (
        <div className="hint">
          支援 JPG／PNG／WebP，長邊超過 {MAX_EDGE}px 會自動縮圖
          （本站下載的圖放寬到 {MAX_EDGE_SELF}px）。
        </div>
      ) : (
        <>
          {/* 匯入後最常問的就是「它為什麼是這個大小」，所以直接講清楚 */}
          <div className={`bg-origin ${bgImage.fromApp ? 'is-self' : ''}`}>
            {bgImage.fromApp ? '✓ 這是本站下載的圖，已對回原稿的位置與大小'
              : (bgImage.baseScale || 1) < 1 ? '已自動縮到適合畫布的大小，可按「定位」再微調'
                : '已依原尺寸放上畫布，可按「定位」搬動與縮放'}
          </div>

          {/* 主家系還在的話，那兩個預設符號就壓在舊圖上。匯入時已經動過手腳
              （使用者自己建過家庭）才會走到這裡，所以只給按鈕、不自動收。 */}
          {mainFamily && (
            <div className="bg-origin bg-origin-warn">
              畫布上還有自動排版的主家系，會壓在舊圖上。
              <button className="btn-soft tone-dust btn-soft-xs" style={{ marginLeft: '6px' }}
                      onClick={() => setMainFamily(false)}>隱藏主家系</button>
            </div>
          )}

          <div className="btn-row bg-tools">
            <button
              className={`btn-toggle ${bgAdjust ? 'on' : ''}`}
              onClick={toggleAdjust}
              aria-pressed={bgAdjust}
              title="在畫布上拖曳底圖搬位置，拖四角縮放；方向鍵可微調（按住 Shift 一次 10 格）"
            >✥ 定位</button>
            <button
              className={`btn-toggle ${eraseMode ? 'on' : ''}`}
              onClick={toggleErase}
              aria-pressed={eraseMode}
              title="在底圖上拖曳即可抹除舊線條"
            >🧽 橡皮擦</button>
            <button
              className="btn-soft tone-muted"
              onClick={resetPlacement}
              disabled={placed}
              title="回到匯入時的位置與大小"
            >重設</button>
          </div>

          {bgAdjust && (
            <div className="hint">
              拖曳底圖搬位置、拖四角縮放；方向鍵微調一格，Shift＋方向鍵一次 10 格，Esc 結束。
              游標上的虛線圈是新符號的實際大小，可以拿來比對舊圖上的人物該縮到多大。
            </div>
          )}

          <div className="bg-slider">
            <span>大小</span>
            <input
              type="range" min="25" max="300" step="5"
              value={Math.min(300, Math.max(25, zoom))}
              onChange={e => patch({ scale: bgScaleFromPct(bgImage, Number(e.target.value)) })}
            />
            <b>{zoom}%</b>
          </div>

          <div className="bg-slider">
            <span>透明度</span>
            <input
              type="range" min="10" max="100" step="5"
              value={Math.round((bgImage.opacity ?? DEFAULT_OPACITY) * 100)}
              onChange={e => patch({ opacity: Number(e.target.value) / 100 })}
            />
            <b>{Math.round((bgImage.opacity ?? DEFAULT_OPACITY) * 100)}%</b>
          </div>

          {eraseMode && (
            <div className="bg-slider">
              <span>筆刷</span>
              <input
                type="range" min="6" max="80" step="2"
                value={eraseWidth}
                onChange={e => setEraseWidth(Number(e.target.value))}
              />
              <b>{eraseWidth}px</b>
            </div>
          )}

          <div className="bg-erase-row">
            <span className="hint" style={{ margin: 0 }}>
              畫布上 {Math.round(box.w)}×{Math.round(box.h)}
              {bgErase.length > 0 && `．擦除 ${bgErase.length} 筆`}
            </span>
            {bgErase.length > 0 && (
              <button className="btn-soft tone-muted btn-soft-xs" onClick={() => setBgErase([])}>清除筆跡</button>
            )}
          </div>

          <div className="btn-row bg-tools">
            <button className="btn-soft tone-dust" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? '處理中…' : '換圖'}
            </button>
            <button className="btn-soft tone-clay" onClick={removeImage}>移除底圖</button>
          </div>
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
