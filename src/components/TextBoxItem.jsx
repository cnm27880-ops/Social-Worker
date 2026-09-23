import { TEXT_FONT } from '../utils/helpers';
import { textBoxSize, verticalGlyphs } from '../utils/textBox';
import { NO_EXPORT } from '../utils/exportImage';

/* ===========================================================================
 * 畫布上的一個文字方塊（含選取框、刪除／複製／縮放把手、編輯中的輸入框）
 *
 * t 是「已經算好吸附位置」的方塊（見 utils/textBox.js 的 resolveText），
 * 這裡只管畫，不管它為什麼在這個位置。anchorPt 是綁定節點的中心，
 * 選取時畫一條淡淡的虛線連過去，讓人知道它吸在誰身上；這條線掛了
 * NO_EXPORT，下載的圖裡不會有。
 * =========================================================================== */

const TextBoxItem = ({
  t, isSel, isEditing, anchorPt,
  onPointerDown, onClick, onDoubleClick, onFinishEdit,
  onDelete, onDuplicate, onResizeDown,
}) => {
  const lines = (t.text || '').split('\n');
  const { left, top, w, h } = textBoxSize(t);
  const bx = left - 4, by = top - 4, bw = w + 8, bh = h + 8;   // 選取框
  const handleX = bx + bw + 8;

  return (
    <g transform={`translate(${t.x},${t.y})`}>
      {isSel && !isEditing && anchorPt && (
        <line className={NO_EXPORT}
              x1={left + w / 2} y1={top + h / 2} x2={anchorPt.x - t.x} y2={anchorPt.y - t.y}
              stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" pointerEvents="none" />
      )}
      {isSel && !isEditing && <rect className={NO_EXPORT} x={bx} y={by} width={bw} height={bh} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" rx="3" />}

      {isEditing ? (
        <foreignObject x={left} y={top} width={Math.max(w, 150) + 20} height={Math.max(h, 60) + 30}>
          <textarea
            autoFocus
            defaultValue={t.text}
            onBlur={(e) => onFinishEdit(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); }}
            style={{ width: '100%', height: '100%', fontSize: `${t.fontSize}px`, fontFamily: TEXT_FONT, border: '2px dashed #3b82f6', outline: 'none', background: 'rgba(255,255,255,0.95)', resize: 'both', borderRadius: '4px', padding: '4px' }}
          />
        </foreignObject>
      ) : (
        <g cursor="move" style={{ touchAction: 'none' }}
           onPointerDown={onPointerDown} onClick={onClick} onDoubleClick={onDoubleClick}>
          {/* 透明底板：直式的字之間有空隙，沒有它就只能剛好點在筆畫上才抓得到 */}
          <rect x={left} y={top} width={w} height={h} fill="transparent" />
          {t.vertical ? (
            <text style={{ fontFamily: TEXT_FONT, fontSize: t.fontSize }} fill="#333" textAnchor="middle">
              {verticalGlyphs(t).map(g => (
                <tspan key={g.key} x={g.x} y={g.y}>{g.text}</tspan>
              ))}
            </text>
          ) : (
            <text style={{ fontFamily: TEXT_FONT, fontSize: t.fontSize }} fill="#333">
              {lines.map((line, idx) => (
                <tspan key={idx} x="0" dy={idx === 0 ? 0 : '1.3em'}>{line}</tspan>
              ))}
            </text>
          )}
        </g>
      )}

      {isSel && !isEditing && (
        <g className={NO_EXPORT}>
          <g transform={`translate(${handleX},${by})`} style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDelete(); }}>
            <title>刪除</title>
            <circle r="10" fill="white" stroke="#ef4444" strokeWidth="1.5" />
            <text y="4" textAnchor="middle" fontSize="11" fill="#ef4444" style={{ fontFamily: TEXT_FONT }}>✕</text>
          </g>
          <g transform={`translate(${handleX + 24},${by})`} style={{ cursor: 'copy' }} onClick={e => { e.stopPropagation(); onDuplicate(); }}>
            <title>複製一份（Ctrl+D）</title>
            <circle r="10" fill="white" stroke="#0d9488" strokeWidth="1.5" />
            <text y="4" textAnchor="middle" fontSize="11" fill="#0d9488" style={{ fontFamily: TEXT_FONT }}>⧉</text>
          </g>
          <g transform={`translate(${handleX},${by + bh})`} style={{ cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={onResizeDown}>
            <title>拖曳縮放字級</title>
            <circle r="8" fill="#3b82f6" />
            <text y="3.5" textAnchor="middle" fontSize="9" fill="white" style={{ fontFamily: TEXT_FONT }}>↘</text>
          </g>
        </g>
      )}
    </g>
  );
};

export default TextBoxItem;
