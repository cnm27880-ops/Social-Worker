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
            <span style={{marginLeft: '6px', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', lineHeight: '1'}}
                  onClick={(e) => { e.stopPropagation(); onRemove(opt); }}>×</span>
          )}
        </div>
      ))}
      {isEditing && (
        <div style={{display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '4px'}}>
          <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)}
                 style={{width: '80px', padding: '2px 6px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none'}}
                 placeholder="新增標籤"
                 onKeyDown={e => { if(e.key === 'Enter' && newTag.trim()) { onAdd(newTag.trim()); setNewTag(''); } }} />
          <button onClick={() => { if(newTag.trim()) { onAdd(newTag.trim()); setNewTag(''); } }}
                  style={{padding: '3px 8px', fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
            加
          </button>
        </div>
      )}
    </div>
  );
};

export default BadgeGroup;
