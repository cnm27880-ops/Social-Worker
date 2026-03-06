import { useState, useMemo, useEffect } from 'react';
import BadgeGroup from './BadgeGroup';
import { getRelativeTitle, formatKidsText, G2_LABELS } from '../utils/helpers';

const DEFAULT_TAGS = {
  identity: ['一般民眾', '就養榮民', '非就養榮民', '榮眷', '遺眷'],
  edu: ['不詳', '不識字',  '自學識字', '國小', '初中', '高中職', '大學以上'],
  lang: ['國語', '台語', '國台語', '客家語'],
  religion: ['無宗教', '民間信仰', '佛教', '道教', '基督教', '天主教', '回教'],
  disability: ['無身心障礙手冊', '有身心障礙手冊']
};

const RecordTab = ({
  gen2Cfg, indexId, g1Status, cohabMembers, deceasedIds, customLinks
}) => {
  /* --- 自訂標籤狀態 --- */
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
  const [savedNotes, setSavedNotes] = useState(() => {
    try { const saved = localStorage.getItem('genogram-savedNotes'); if (saved) return JSON.parse(saved); } catch {}
    return [''];
  });
  useEffect(() => { try { localStorage.setItem('genogram-savedNotes', JSON.stringify(savedNotes)); } catch {} }, [savedNotes]);

  /* --- 共用工具函數 --- */
  const getIndexGender = (id) => {
    if (id === 'fa') return 'M';
    if (id === 'mo') return 'F';
    if (id?.startsWith('c')) return gen2Cfg[parseInt(id.replace('c', ''))]?.gender;
    return null;
  };
  const getRankStr = (rank, total) => {
    if (total === 1 || rank === 1) return '長';
    if (rank === 2) return '次';
    if (rank === total && rank > 2) return '么';
    const nums = ['', '', '', '三', '四', '五', '六', '七', '八', '九', '十'];
    return nums[rank] || String(rank);
  };

  /* ===== 紀錄產生器邏輯 ===== */
  const generatedText = useMemo(() => {
    let txt = `案主為${subjInfo.identity}`;
    if (subjInfo.job) txt += `，${subjInfo.job}`;
    if (subjInfo.edu) txt += `，${subjInfo.edu}${['不識字', '自學識字'].includes(subjInfo.edu) ? '' : '學歷'}`;
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
          if (idx >= 0 && idx < gen2Cfg.length) return getRelativeTitle(gen2Cfg[idx].gender, idx, gen2Cfg);
          return '';
        }
        if (id.startsWith('s')) return '案子女配偶';
        if (id.startsWith('g')) return '案孫輩';
        return '';
      }).filter(Boolean);
      if (others.length > 0) cohabText = `與${others.join('、')}同住`;
    }
    txt += `，${cohabText}。`;
    if (subjInfo.note) txt += `${subjInfo.note}；\n`;
    else txt += `；\n`;

    // 統計原生家庭的子代總數
    if (gen2Cfg.length > 0) {
      const m = gen2Cfg.filter(c => c.gender === 'M').length;
      const f = gen2Cfg.filter(c => c.gender === 'F').length;
      let res = '育有';
      if (m > 0 && f > 0) res += `${m}子${f}女`;
      else if (m > 0) res += `${m}子`;
      else if (f > 0) res += `${f}女`;
      txt += `${res}，`;
    }

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

      fTxt += `，${G2_LABELS[c.partner] || '未婚'}`;

      if (c.g3Str) fTxt += `，${formatKidsText(c.g3Str)}`;
      if (ext.isPrimary) fTxt += `，為主要聯絡人及同意書填寫人`;
      if (ext.note) fTxt += `，${ext.note}`;
      txt += `${fTxt}；\n`;
    });

    /* --- 擴充連線 (customLinks) → 案主相關連線與擴充子代 --- */
    if (indexId && customLinks && customLinks.length > 0) {
      const indexGender = getIndexGender(indexId);
      customLinks.forEach(lnk => {
        if (lnk.type === 'eco') return; // 生態圖連線不納入個案紀錄
        if (lnk.sourceId !== indexId && lnk.targetId !== indexId) return;
        const otherId = lnk.sourceId === indexId ? lnk.targetId : lnk.sourceId;
        if (/^c\d+$/.test(otherId)) return;
        const spouseLabel = indexGender === 'M' ? '前妻' : '前夫';
        const remarryLabel = indexGender === 'M' ? '案妻' : '案夫';
        const partnerLabel = lnk.status === 'divorced' ? spouseLabel : remarryLabel;
        if (lnk.status === 'divorced') {
          let line = `與${spouseLabel}`;
          if (lnk.kidsStr) line += `，${formatKidsText(lnk.kidsStr)}`;
          txt += `${line}；\n`;
        } else if (lnk.status === 'married') {
          let line = `再婚，與${remarryLabel}`;
          if (lnk.kidsStr) line += `，${formatKidsText(lnk.kidsStr)}`;
          txt += `${line}；\n`;
        }
        // 遍歷 kidsCfg，輸出與原生第二代相同的文案邏輯
        if (lnk.kidsCfg && lnk.kidsCfg.length > 0) {
          const sameGenderCount = {};
          lnk.kidsCfg.forEach(kc => { sameGenderCount[kc.gender] = (sameGenderCount[kc.gender] || 0) + 1; });
          const rankCount = { M: 0, F: 0 };
          lnk.kidsCfg.forEach((kc, ki) => {
            rankCount[kc.gender]++;
            const type = kc.gender === 'M' ? '子' : '女';
            const title = `${partnerLabel}之${getRankStr(rankCount[kc.gender], sameGenderCount[kc.gender])}${type}`;
            const kidKey = `${lnk.id}_c${ki}`;
            const isDeceased = deceasedIds.includes(kidKey);
            if (isDeceased) { txt += `${title}已歿；\n`; return; }
            const ext = famExtras[kidKey] || {};
            let fTxt = title;
            if (ext.location) fTxt += `居${ext.location}`;
            if (ext.job) fTxt += `，為${ext.job}`;
            fTxt += `，${G2_LABELS[kc.partner] || '未婚'}`;
            if (kc.g3Str) fTxt += `，${formatKidsText(kc.g3Str)}`;
            if (ext.isPrimary) fTxt += `，為主要聯絡人及同意書填寫人`;
            if (ext.note) fTxt += `，${ext.note}`;
            txt += `${fTxt}；\n`;
          });
        }
      });
    }

    return txt;
  }, [subjInfo, gen2Cfg, g1Status, cohabMembers, deceasedIds, famExtras, indexId, customLinks]);

  const handleFamExtra = (idx, field, val) => {
    setFamExtras(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), [field]: val } }));
  };

  const exportBackup = () => {
    const data = JSON.stringify({ tagOptions, savedNotes }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'social-worker-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.tagOptions) {
          setTagOptions(parsed.tagOptions);
        }
        if (parsed.savedNotes) {
          setSavedNotes(parsed.savedNotes);
        }
        alert('✅ 設定檔匯入成功！');
      } catch {
        alert('❌ 檔案格式錯誤，請確認是否為有效的 JSON 設定檔。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

        <div className="section section-inline">
          <label>身分別</label>
          <BadgeGroup options={tagOptions.identity} value={subjInfo.identity} onChange={v => setSubjInfo({...subjInfo, identity: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('identity', t)} onRemove={t => handleRemoveTag('identity', t)} />
        </div>

        <div className="section section-inline">
          <label>教育程度</label>
          <BadgeGroup options={tagOptions.edu} value={subjInfo.edu} onChange={v => setSubjInfo({...subjInfo, edu: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('edu', t)} onRemove={t => handleRemoveTag('edu', t)} />
        </div>

        <div className="section section-inline">
          <label>溝通語言</label>
          <BadgeGroup options={tagOptions.lang} value={subjInfo.lang} onChange={v => setSubjInfo({...subjInfo, lang: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('lang', t)} onRemove={t => handleRemoveTag('lang', t)} />
        </div>

        <div className="section section-inline">
          <label>宗教信仰</label>
          <BadgeGroup options={tagOptions.religion} value={subjInfo.religion} onChange={v => setSubjInfo({...subjInfo, religion: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('religion', t)} onRemove={t => handleRemoveTag('religion', t)} />
        </div>

        <div className="section section-inline">
          <label>身障證明</label>
          <BadgeGroup options={tagOptions.disability} value={subjInfo.disability} onChange={v => setSubjInfo({...subjInfo, disability: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('disability', t)} onRemove={t => handleRemoveTag('disability', t)} />
        </div>

        <div className="section">
          <label>職業 / 經歷 (可自填)</label>
          <input type="text" value={subjInfo.job} onChange={e => setSubjInfo({...subjInfo, job: e.target.value})} placeholder="例：家管、務農、退休人員" />
        </div>

        <div className="section">
          <label>案主特殊備註</label>
          <input type="text" value={subjInfo.note} onChange={e => setSubjInfo({...subjInfo, note: e.target.value})} placeholder="例：每月領取相關補助，或具其他特殊背景" />
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

        {/* 擴充連線子代動態卡片 */}
        {(() => {
          if (!indexId || !customLinks || customLinks.length === 0) return null;
          const indexGender = getIndexGender(indexId);
          const allCards = [];
          customLinks.forEach(lnk => {
            if (lnk.type === 'eco') return; // 生態圖連線不納入動態卡片
            if (!((lnk.sourceId === indexId || lnk.targetId === indexId) && lnk.kidsCfg && lnk.kidsCfg.length > 0)) return;
            const otherId = lnk.sourceId === indexId ? lnk.targetId : lnk.sourceId;
            if (/^c\d+$/.test(otherId)) return;
            const spouseLabel = indexGender === 'M' ? '前妻' : '前夫';
            const remarryLabel = indexGender === 'M' ? '案妻' : '案夫';
            const partnerLabel = lnk.status === 'divorced' ? spouseLabel : remarryLabel;
            const sameGenderCount = {};
            lnk.kidsCfg.forEach(kc => { sameGenderCount[kc.gender] = (sameGenderCount[kc.gender] || 0) + 1; });
            const rankCount = { M: 0, F: 0 };
            lnk.kidsCfg.forEach((kc, ki) => {
              rankCount[kc.gender]++;
              const type = kc.gender === 'M' ? '子' : '女';
              const title = `${partnerLabel}之${getRankStr(rankCount[kc.gender], sameGenderCount[kc.gender])}${type}`;
              const kidKey = `${lnk.id}_c${ki}`;
              const isDeceased = deceasedIds.includes(kidKey);
              const ext = famExtras[kidKey] || { location: '', job: '', isPrimary: false, note: '' };
              allCards.push(
                <div key={kidKey} className="fam-card" style={{ opacity: isDeceased ? 0.6 : 1, borderLeft: '3px solid #8b5cf6' }}>
                  <div className="fam-title">
                    <span>{title} {isDeceased && <span style={{color: '#ef4444'}}>(已歿)</span>}</span>
                    <label style={{fontSize: '12px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                      <input type="checkbox" checked={ext.isPrimary || false} onChange={e => handleFamExtra(kidKey, 'isPrimary', e.target.checked)} disabled={isDeceased} /> 主要聯絡人
                    </label>
                  </div>
                  {!isDeceased && (
                    <div className="fam-grid">
                      <div>
                        <div className="hint" style={{marginBottom: '2px'}}>居住地</div>
                        <input type="text" value={ext.location || ''} onChange={e => handleFamExtra(kidKey, 'location', e.target.value)} placeholder="例：台南" />
                      </div>
                      <div>
                        <div className="hint" style={{marginBottom: '2px'}}>職業</div>
                        <input type="text" value={ext.job || ''} onChange={e => handleFamExtra(kidKey, 'job', e.target.value)} placeholder="例：家管、從商" />
                      </div>
                      <div style={{gridColumn: '1 / -1'}}>
                        <div className="hint" style={{marginBottom: '2px'}}>特殊備註</div>
                        <input type="text" value={ext.note || ''} onChange={e => handleFamExtra(kidKey, 'note', e.target.value)} placeholder="例：拒絕回答孫輩狀況" />
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          });
          if (allCards.length === 0) return null;
          return (
            <>
              <h2 style={{ marginTop: '20px' }}>擴充連線子代動態</h2>
              {allCards}
            </>
          );
        })()}

        <div className="section">
          <label>💾 系統資料備份與還原</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={exportBackup} style={{ flex: 1, padding: '8px', fontSize: '13px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>📥 匯出設定檔</button>
            <label style={{ flex: 1, padding: '8px', fontSize: '13px', background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>
              📤 匯入設定檔
              <input type="file" accept=".json" onChange={importBackup} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="hint" style={{ marginTop: '6px' }}>可將自訂標籤與常用短語下載備份；更換電腦或清除瀏覽器資料後可重新匯入還原。</div>
        </div>

      </div>

      {/* 右側即時預覽區 */}
      <div className="record-preview">
        <h2 style={{ margin: 0, border: 'none', padding: 0, color: '#1e293b', fontSize: '18px', marginBottom: '14px' }}>✨ 個案紀錄即時預覽</h2>
        <textarea value={generatedText} readOnly style={{ minHeight: '250px' }} />
        <button onClick={copyRecord} style={{ padding: '12px', fontSize: '16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)' }}>
          📋 一鍵複製至剪貼簿
        </button>

        {/* 自由保存區 */}
        <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#1e293b' }}>📝 自由保存區</h3>
          {savedNotes.map((note, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
              <textarea
                value={note}
                onChange={e => {
                  const updated = [...savedNotes];
                  updated[idx] = e.target.value;
                  setSavedNotes(updated);
                }}
                placeholder={`備註 ${idx + 1}`}
                style={{ flex: 1, minHeight: '40px', resize: 'vertical', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit' }}
              />
              {savedNotes.length > 1 && (
                <button
                  onClick={() => setSavedNotes(prev => prev.filter((_, i) => i !== idx))}
                  style={{ padding: '4px 8px', fontSize: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setSavedNotes(prev => [...prev, ''])}
            style={{ padding: '8px 16px', fontSize: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >➕ 新增一行</button>
        </div>
      </div>
    </div>
  );
};

export default RecordTab;
