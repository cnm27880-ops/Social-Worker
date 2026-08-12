import { useRef, useState } from 'react';

/* ===== 共用元件：可編輯的 BadgeGroup =====
 *
 * 這一組是單選（身分別、教育程度、溝通語言…），所以照 WAI-ARIA 的
 * radiogroup 模式做：整組只佔一個 Tab 站，進去之後用方向鍵在選項之間移動，
 * 移到哪就選到哪。原本是一堆沒有 tabIndex 的 <div onClick>，鍵盤完全到不了
 * ——填表的人 Tab 到職業欄之前，得先伸手去點五組標籤。
 *
 * 焦點採 roving tabindex：整組只有「目前選中的那顆」是 tabIndex=0（沒選過
 * 就是第一顆），其餘為 -1。這樣 Tab 進來會直接落在目前的選擇上。
 */
const BadgeGroup = ({ options, value, onChange, isEditing, onAdd, onRemove, label }) => {
  const [newTag, setNewTag] = useState('');
  const btnRefs = useRef([]);

  const focusIdx = (() => {
    const i = options.indexOf(value);
    return i >= 0 ? i : 0;
  })();

  const moveTo = (i) => {
    const next = (i + options.length) % options.length;
    onChange(options[next]);
    btnRefs.current[next]?.focus();
  };

  const onKeyDown = (e, i) => {
    if (isEditing) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); moveTo(i + 1); break;
      case 'ArrowLeft':  case 'ArrowUp':   e.preventDefault(); moveTo(i - 1); break;
      case 'Home':       e.preventDefault(); moveTo(0); break;
      case 'End':        e.preventDefault(); moveTo(options.length - 1); break;
      case ' ': case 'Enter': e.preventDefault(); onChange(options[i]); break;
      default: break;
    }
  };

  return (
    <div className="badge-wrap" role={isEditing ? undefined : 'radiogroup'} aria-label={label}>
      {options.map((opt, i) => (
        <div
          key={opt}
          ref={el => { btnRefs.current[i] = el; }}
          className={`badge-btn ${value === opt ? 'active' : ''}`}
          role={isEditing ? undefined : 'radio'}
          aria-checked={isEditing ? undefined : value === opt}
          tabIndex={isEditing ? undefined : (i === focusIdx ? 0 : -1)}
          onClick={() => !isEditing && onChange(opt)}
          onKeyDown={e => onKeyDown(e, i)}
        >
          {opt}
          {isEditing && (
            <span className="badge-del"
                  onClick={(e) => { e.stopPropagation(); onRemove(opt); }}>×</span>
          )}
        </div>
      ))}
      {isEditing && (
        <div className="badge-add">
          <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)}
                 placeholder="新增標籤"
                 onKeyDown={e => { if(e.key === 'Enter' && newTag.trim()) { onAdd(newTag.trim()); setNewTag(''); } }} />
          <button className="btn-soft tone-dust btn-soft-xs"
                  onClick={() => { if(newTag.trim()) { onAdd(newTag.trim()); setNewTag(''); } }}>
            加
          </button>
        </div>
      )}
    </div>
  );
};

export default BadgeGroup;
