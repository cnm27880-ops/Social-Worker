import { useState, useMemo, useEffect } from 'react';
import BadgeGroup from './BadgeGroup';
import { getRelativeTitle, formatKidsText } from '../utils/helpers';

const RecordTab = ({
  gen2Cfg, indexId, g1Status, cohabMembers, deceasedIds
}) => {
  /* --- 自訂標籤狀態 --- */
  const DEFAULT_TAGS = {
    identity: ['一般民眾', '自費民眾', '公費就養榮民', '就養榮民', '自費榮民', '榮眷', '遺眷'],
    edu: ['不識字', '自學識字', '國小', '初中', '高中職', '大學以上'],
    lang: ['國語', '台語', '國台語', '客家語'],
    religion: ['無宗教', '佛教', '道教', '基督教', '天主教'],
    disability: ['無身心障礙手冊', '有身障手冊']
  };
  const [tagOptions, setTagOptions] = useState(() => {
    try { const saved = localStorage.getItem('genogram-tags'); if (saved) return { ...DEFAULT_TAGS, ...JSON.parse(saved) }; } catch {}
    return DEFAULT_TAGS;
  });
  useEffect(() => { try { localStorage.setItem('genogram-tags', JSON.stringify(tagOptions)); } catch {} }, [tagOptions]);
  const [isEditingTags, setIsEditingTags] = useState(false);

  const handleAddTag = (category, newTag) => {
    if (!tagOptions[category].includes(newTag)) setTagOptions(p => ({ ...p, [category]: [...p[category], newTag] }));
  };
  const handleRemoveTag = (category, tagToRemove) => {
    setTagOptions(p => ({ ...p, [category]: p[category].filter(t => t !== tagToRemove) }));
  };

  /* --- 個案紀錄產生器專屬狀態 --- */
  const [subjInfo, setSubjInfo] = useState({
    identity: '一般民眾', job: '', edu: '', lang: '', religion: '', disability: '無身心障礙手冊', note: ''
  });
  const [famExtras, setFamExtras] = useState({}); // 儲存家屬的補充資訊 { index: { location, job, isPrimary, note } }

  /* ===== 紀錄產生器邏輯 ===== */
  const generatedText = useMemo(() => {
    let txt = `案主為${subjInfo.identity}`;
    if (subjInfo.job) txt += `，${subjInfo.job}`;
    if (subjInfo.edu) txt += `，${subjInfo.edu}`;
    if (subjInfo.lang) txt += `，${subjInfo.lang}溝通`;
    if (subjInfo.religion) txt += `，${subjInfo.religion}信仰`;
    if (subjInfo.disability) txt += `，${subjInfo.disability}`;
    txt += `，${g1Status === 'married' ? '已婚' : '喪偶'}`;

    let cohabText = '獨居';
    if (indexId && cohabMembers.includes(indexId)) {
      const others = cohabMembers.filter(id => id !== indexId).map(id => {
        if (id === 'fa') return '案父';
        if (id === 'mo') return '案母';
        if (id.startsWith('c')) {
          const idx = parseInt(id.replace('c',''));
          return getRelativeTitle(gen2Cfg[idx].gender, idx, gen2Cfg);
        }
        if (id.startsWith('s')) return '案子女配偶';
        if (id.startsWith('g')) return '案孫輩';
        return '';
      }).filter(Boolean);
      if (others.length > 0) cohabText = `與${others.join('、')}同住`;
    }
    txt += `，${cohabText}。`;
    if (subjInfo.note) txt += `${subjInfo.note}；`;
    else txt += `；\n`;

    gen2Cfg.forEach((c, i) => {
      const title = getRelativeTitle(c.gender, i, gen2Cfg);
      const isDeceased = deceasedIds.includes(`c${i}`);
      if (isDeceased) {
        txt += `${title}已歿；`;
        return;
      }
      const ext = famExtras[i] || {};
      let fTxt = `${title}`;
      if (ext.location) fTxt += `居${ext.location}`;
      if (ext.job) fTxt += `，為${ext.job}`;

      const partnerMap = { none: '未婚', married: '已婚', cohab: '同居', separated: '分居', divorced: '離婚' };
      fTxt += `，${partnerMap[c.partner] || '未婚'}`;

      if (c.g3Str) fTxt += `，${formatKidsText(c.g3Str)}`;
      if (ext.isPrimary) fTxt += `，為主要聯絡人及同意書填寫人`;
      if (ext.note) fTxt += `，${ext.note}`;
      txt += `${fTxt}；\n`;
    });

    return txt;
  }, [subjInfo, gen2Cfg, g1Status, cohabMembers, deceasedIds, famExtras, indexId]);

  const handleFamExtra = (idx, field, val) => {
    setFamExtras(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), [field]: val } }));
  };

  const copyRecord = () => {
    navigator.clipboard.writeText(generatedText).then(() => {
      alert('✅ 個案紀錄已成功複製！');
    });
  };

  return (
    <div className="record-layout">
      <div className="record-form panel">
        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>案主基本資料 {indexId ? <span style={{fontSize: '12px', background:'#1e293b', color:'white', padding:'2px 8px', borderRadius:'10px', marginLeft: '6px', verticalAlign: 'middle'}}>已於家系圖指定案主</span> : <span style={{fontSize: '12px', color:'#ef4444', marginLeft: '6px', verticalAlign: 'middle'}}>尚未指定案主</span>}</div>
          <button onClick={() => setIsEditingTags(!isEditingTags)} style={{ padding: '4px 8px', fontSize: '12px', background: isEditingTags ? '#ef4444' : '#64748b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            {isEditingTags ? '✅ 完成編輯' : '✏️ 編輯標籤'}
          </button>
        </h2>

        <div className="section">
          <label>身分別</label>
          <BadgeGroup options={tagOptions.identity} value={subjInfo.identity} onChange={v => setSubjInfo({...subjInfo, identity: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('identity', t)} onRemove={t => handleRemoveTag('identity', t)} />
        </div>

        <div className="section">
          <label>教育程度</label>
          <BadgeGroup options={tagOptions.edu} value={subjInfo.edu} onChange={v => setSubjInfo({...subjInfo, edu: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('edu', t)} onRemove={t => handleRemoveTag('edu', t)} />
        </div>

        <div className="section">
          <label>溝通語言</label>
          <BadgeGroup options={tagOptions.lang} value={subjInfo.lang} onChange={v => setSubjInfo({...subjInfo, lang: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('lang', t)} onRemove={t => handleRemoveTag('lang', t)} />
        </div>

        <div className="section">
          <label>宗教信仰</label>
          <BadgeGroup options={tagOptions.religion} value={subjInfo.religion} onChange={v => setSubjInfo({...subjInfo, religion: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('religion', t)} onRemove={t => handleRemoveTag('religion', t)} />
        </div>

        <div className="section">
          <label>身障證明</label>
          <BadgeGroup options={tagOptions.disability} value={subjInfo.disability} onChange={v => setSubjInfo({...subjInfo, disability: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('disability', t)} onRemove={t => handleRemoveTag('disability', t)} />
        </div>

        <div className="section">
          <label>職業 / 經歷 (可自填)</label>
          <input type="text" value={subjInfo.job} onChange={e => setSubjInfo({...subjInfo, job: e.target.value})} placeholder="例：家管、務農、裝甲兵退役" />
        </div>

        <div className="section">
          <label>案主特殊備註</label>
          <input type="text" value={subjInfo.note} onChange={e => setSubjInfo({...subjInfo, note: e.target.value})} placeholder="例：安徽省巢縣人，每月有領取就養金" />
        </div>

        <h2 style={{ marginTop: '20px' }}>家屬動態清單 (由家系圖連動)</h2>
        {gen2Cfg.length === 0 && <div className="hint" style={{fontSize: '13px'}}>請先於「家系圖繪製」頁籤輸入第二代子女，這裡會自動產生填寫欄位喔！</div>}

        {gen2Cfg.map((c, i) => {
          const title = getRelativeTitle(c.gender, i, gen2Cfg);
          const isDeceased = deceasedIds.includes(`c${i}`);
          const ext = famExtras[i] || { location: '', job: '', isPrimary: false, note: '' };

          return (
            <div key={i} className="fam-card" style={{ opacity: isDeceased ? 0.6 : 1 }}>
              <div className="fam-title">
                <span>{title} {isDeceased && <span style={{color: '#ef4444'}}>(已歿)</span>}</span>
                <label style={{fontSize: '12px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                  <input type="checkbox" checked={ext.isPrimary} onChange={e => handleFamExtra(i, 'isPrimary', e.target.checked)} disabled={isDeceased} /> 主要聯絡人
                </label>
              </div>

              {!isDeceased && (
                <div className="fam-grid">
                  <div>
                    <div className="hint" style={{marginBottom: '2px'}}>居住地</div>
                    <input type="text" value={ext.location} onChange={e => handleFamExtra(i, 'location', e.target.value)} placeholder="例：台南" />
                  </div>
                  <div>
                    <div className="hint" style={{marginBottom: '2px'}}>職業</div>
                    <input type="text" value={ext.job} onChange={e => handleFamExtra(i, 'job', e.target.value)} placeholder="例：家管、從商" />
                  </div>
                  <div style={{gridColumn: '1 / -1'}}>
                    <div className="hint" style={{marginBottom: '2px'}}>特殊備註</div>
                    <input type="text" value={ext.note} onChange={e => handleFamExtra(i, 'note', e.target.value)} placeholder="例：拒絕回答孫輩狀況" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

      </div>

      {/* 右側即時預覽區 */}
      <div className="record-preview">
        <h2 style={{ margin: 0, border: 'none', padding: 0, color: '#1e293b', fontSize: '18px', marginBottom: '14px' }}>✨ 個案紀錄即時預覽</h2>
        <textarea value={generatedText} readOnly />
        <button onClick={copyRecord} style={{ padding: '12px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}>
          📋 一鍵複製至剪貼簿
        </button>
      </div>
    </div>
  );
};

export default RecordTab;
