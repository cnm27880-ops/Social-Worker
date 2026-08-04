import { useState } from 'react';

/* ===== 共用元件：可編輯的 BadgeGroup ===== */
const BadgeGroup = ({ options, value, onChange, isEditing, onAdd, onRemove }) => {
  const [newTag, setNewTag] = useState('');
  return (
    <div className="badge-wrap">
      {options.map(opt => (
        <div key={opt} className={`badge-btn ${value === opt ? 'active' : ''}`} onClick={() => !isEditing && onChange(opt)}>
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
