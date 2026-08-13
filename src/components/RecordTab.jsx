import { useState, useMemo, useEffect, useRef } from 'react';
import BadgeGroup from './BadgeGroup';
import InfoTip from './InfoTip';
import { getGen2Title, getIndexGen2Idx, formatKidsText, G2_LABELS, G1_LABELS } from '../utils/helpers';

const DEFAULT_TAGS = {
  identity: ['一般民眾', '就養榮民', '非就養榮民', '榮眷', '遺眷'],
  edu: ['不詳', '不識字',  '自學識字', '國小', '初中', '高中職', '大學以上'],
  lang: ['國語', '台語', '國台語', '客家語'],
  religion: ['無宗教', '民間信仰', '佛教', '道教', '基督教', '天主教', '回教'],
  disability: ['無身心障礙手冊', '有身心障礙手冊']
};

/* 教育程度接不接「學歷」兩個字：「不識字」「自學識字」本身已是完整敘述，
   「不詳」要寫成「學歷不詳」才通順，其餘一律加後綴（國小學歷、大學以上學歷）。 */
const eduText = (edu) => {
  if (['不識字', '自學識字'].includes(edu)) return edu;
  if (edu === '不詳') return '學歷不詳';
  return `${edu}學歷`;
};

const getRankStr = (rank, total) => {
  if (total === 1 || rank === 1) return '長';
  if (rank === 2) return '次';
  if (rank === total && rank > 2) return '么';
  const nums = ['', '', '', '三', '四', '五', '六', '七', '八', '九', '十'];
  return nums[rank] || String(rank);
};

const RecordTab = ({
  gen2Cfg, indexId, g1Status, cohabMembers, deceasedIds, disabledIds = [], customLinks,
  mainFamily = true,
  /* 案主基本資料與家屬補充資訊住在案件文件裡（見 caseDoc.js），不是這裡的
     本地狀態——這樣「重置」清得到、Ctrl+Z 救得回、切換案件不會殘留上一份。 */
  subjInfo, setSubjInfo, famExtras, setFamExtras, recordEdit, setRecordEdit,
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

  /* --- 個案紀錄產生器專屬狀態 ---
     自由保存區是跨案件共用的常用短語，所以留在 localStorage，不進案件文件。 */
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
  /* 案主是不是第二代其中一人？是的話，其餘第二代要以手足（案兄／案姊／案弟／
     案妹）而非子女稱呼，婚姻狀態與子嗣也要改讀案主自己那一格。 */
  const selfIdx = getIndexGen2Idx(indexId, gen2Cfg);
  const isGen2Index = selfIdx >= 0;
  const titleOf = (i) => getGen2Title(i, gen2Cfg, indexId);

  /* ===== 紀錄產生器邏輯 ===== */
  const generatedText = useMemo(() => {
    let txt = `案主為${subjInfo.identity}`;
    if (subjInfo.job) txt += `，${subjInfo.job}`;
    if (subjInfo.edu) txt += `，${eduText(subjInfo.edu)}`;
    if (subjInfo.lang) txt += `，${subjInfo.lang}溝通`;
    if (subjInfo.religion) txt += `，${subjInfo.religion}信仰`;
    if (subjInfo.disability) txt += `，${subjInfo.disability}`;
    // 案主是第二代時，婚姻狀態要看案主自己的，不是第一代（案父母）的
    txt += `，${isGen2Index ? (G2_LABELS[gen2Cfg[selfIdx].partner] || '未婚') : (g1Status === 'married' ? '已婚' : '離婚')}`;

    /* 沒指定案主就不知道是誰跟誰同住，整句略過。原本無條件預設「獨居」——
       畫布上明明圈了同住範圍，只因為忘了指定案主，紀錄就斷言獨居，
       而且是可以直接複製出去的錯誤敘述。 */
    let cohabText = indexId ? '獨居' : null;
    if (indexId && cohabMembers.includes(indexId)) {
      const others = cohabMembers.filter(id => id !== indexId).map(id => {
        if (id === 'fa') return '案父';
        if (id === 'mo') return '案母';
        if (/^c\d+$/.test(id)) {
          const idx = parseInt(id.replace('c',''));
          if (idx >= 0 && idx < gen2Cfg.length) return titleOf(idx);
          return '';
        }
        if (/^s\d+$/.test(id)) {
          const idx = parseInt(id.replace('s',''));
          if (!isGen2Index) return '案子女配偶';
          if (idx === selfIdx) return getIndexGender(indexId) === 'M' ? '案妻' : '案夫';
          return idx >= 0 && idx < gen2Cfg.length ? `${titleOf(idx)}之配偶` : '';
        }
        if (/^g\d+_\d+$/.test(id)) {
          if (!isGen2Index) return '案孫輩';
          return parseInt(id.slice(1).split('_')[0]) === selfIdx ? '案子女' : '案姪甥輩';
        }
        return '';
      }).filter(Boolean);
      if (others.length > 0) cohabText = `與${others.join('、')}同住`;
    }
    txt += cohabText ? `，${cohabText}。` : `。`;
    // 上一句已經用「。」收尾，沒有備註時直接換行——原本無條件補「；」會寫出「。；」
    if (subjInfo.note) txt += `${subjInfo.note}；\n`;
    else txt += `\n`;

    const countKids = (list) => {
      const m = list.filter(g => g === 'M').length;
      const f = list.filter(g => g === 'F').length;
      let res = '育有';
      if (m > 0 && f > 0) res += `${m}子${f}女`;
      else if (m > 0) res += `${m}子`;
      else if (f > 0) res += `${f}女`;
      return res;
    };

    if (isGen2Index) {
      // 案主自己的子嗣（第三代）
      const own = gen2Cfg[selfIdx].g3Str;
      if (own) txt += `${formatKidsText(own)}；\n`;
      // 原生家庭：案父母的婚姻狀態與子代總數（含案主）
      let originTxt = `案父母${G1_LABELS[g1Status] || '已婚'}`;
      if (gen2Cfg.length > 0) originTxt += `，${countKids(gen2Cfg.map(c => c.gender))}`;
      // 有手足才用逗號接下去，否則自成一句
      txt += gen2Cfg.length > 1 ? `${originTxt}，` : `${originTxt}；\n`;
    } else if (gen2Cfg.length > 0) {
      // 統計原生家庭的子代總數
      txt += `${countKids(gen2Cfg.map(c => c.gender))}，`;
    }

    gen2Cfg.forEach((c, i) => {
      if (i === selfIdx) return; // 案主本人已於上方段落描述
      const title = titleOf(i);
      const isDeceased = deceasedIds.includes(`c${i}`);
      if (isDeceased) {
        txt += `${title}已歿；\n`;   // 其餘分支都是「；\n」，這裡漏了換行會跟下一位擠成同一行
        return;
      }
      const isDisabled = disabledIds.includes(`c${i}`);
      const ext = famExtras[i] || {};
      let fTxt = `${title}`;
      if (ext.location) fTxt += `居${ext.location}`;
      if (ext.job) fTxt += `，為${ext.job}`;

      fTxt += `，${G2_LABELS[c.partner] || '未婚'}`;

      if (c.g3Str) fTxt += `，${formatKidsText(c.g3Str)}`;
      if (ext.isPrimary) fTxt += `，為主要聯絡人及同意書填寫人`;
      if (ext.note) fTxt += `，${ext.note}`;
      if (isDisabled) fTxt += `，領有身心障礙證明`;
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
            const isDisabled = disabledIds.includes(kidKey);
            const ext = famExtras[kidKey] || {};
            let fTxt = title;
            if (ext.location) fTxt += `居${ext.location}`;
            if (ext.job) fTxt += `，為${ext.job}`;
            fTxt += `，${G2_LABELS[kc.partner] || '未婚'}`;
            if (kc.g3Str) fTxt += `，${formatKidsText(kc.g3Str)}`;
            if (ext.isPrimary) fTxt += `，為主要聯絡人及同意書填寫人`;
            if (ext.note) fTxt += `，${ext.note}`;
            if (isDisabled) fTxt += `，領有身心障礙證明`;
            txt += `${fTxt}；\n`;
          });
        }
      });
    }

    return txt;
  }, [subjInfo, gen2Cfg, g1Status, cohabMembers, deceasedIds, disabledIds, famExtras, indexId, customLinks]);

  /* 預覽可以直接改。recordEdit 非空＝使用者動過手，之後家系圖再變動也不會
     覆蓋掉他寫的字（不然改一個節點就把整段心血洗掉）；按「還原」清空它，
     預覽就回到跟著家系圖即時重算。複製與匯出一律拿眼前看到的這份。 */
  const isManual = recordEdit !== '';
  const displayText = isManual ? recordEdit : generatedText;

  const handleFamExtra = (idx, field, val) => {
    setFamExtras(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), [field]: val } }));
  };

  /* 主要聯絡人一份案件只會有一位：勾別人時先把其他人的清掉，
     再勾同一位就是取消（維持 checkbox 的直覺，不必另外做「無」的選項）。 */
  const setPrimaryContact = (idx, checked) => {
    setFamExtras(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) next[k] = { ...v, isPrimary: false };
      if (checked) next[idx] = { ...(next[idx] || {}), isPrimary: true };
      return next;
    });
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

  /* 複製結果直接顯示在按鈕上，兩秒後復原。原本用 alert()——那是個必須用滑鼠
     按掉的模態框，連續作業時每複製一次就被打斷一次。
     writeText 在非 HTTPS 或使用者拒絕權限時會 reject，退回選取 textarea 的
     老方法（execCommand），兩條路都失敗才顯示錯誤。 */
  const [copyState, setCopyState] = useState('idle');
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const flashCopyState = (state) => {
    setCopyState(state);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 2000);
  };

  const copyRecord = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      flashCopyState('done');
      return;
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = displayText;
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      flashCopyState(ok ? 'done' : 'fail');
    } catch {
      flashCopyState('fail');
    }
  };

  return (
    <div className="record-layout">
      <div className="record-form panel">
        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            案主基本資料
            <InfoTip text="填好這裡跟下面的家屬清單，右側會即時整理成一段文字紀錄，按「一鍵複製至剪貼簿」就能直接貼到你原本用的紀錄系統。標籤（身分別、教育程度等）點「編輯標籤」可自行增刪。" />
            {indexId ? <span className="ip-pill">已於家系圖指定案主</span> : <span className="ip-pill warn">尚未指定案主</span>}
          </div>
          <button className={`btn-soft ${isEditingTags ? 'tone-clay' : 'tone-muted'}`} onClick={() => setIsEditingTags(!isEditingTags)}>
            {isEditingTags ? '✅ 完成編輯' : '✏️ 編輯標籤'}
          </button>
        </h2>

        <div className="section section-inline">
          <label>身分別</label>
          <BadgeGroup label="身分別" options={tagOptions.identity} value={subjInfo.identity} onChange={v => setSubjInfo({...subjInfo, identity: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('identity', t)} onRemove={t => handleRemoveTag('identity', t)} />
        </div>

        <div className="section section-inline">
          <label>教育程度</label>
          <BadgeGroup label="教育程度" options={tagOptions.edu} value={subjInfo.edu} onChange={v => setSubjInfo({...subjInfo, edu: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('edu', t)} onRemove={t => handleRemoveTag('edu', t)} />
        </div>

        <div className="section section-inline">
          <label>溝通語言</label>
          <BadgeGroup label="溝通語言" options={tagOptions.lang} value={subjInfo.lang} onChange={v => setSubjInfo({...subjInfo, lang: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('lang', t)} onRemove={t => handleRemoveTag('lang', t)} />
        </div>

        <div className="section section-inline">
          <label>宗教信仰</label>
          <BadgeGroup label="宗教信仰" options={tagOptions.religion} value={subjInfo.religion} onChange={v => setSubjInfo({...subjInfo, religion: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('religion', t)} onRemove={t => handleRemoveTag('religion', t)} />
        </div>

        <div className="section section-inline">
          <label>身障證明</label>
          <BadgeGroup label="身心障礙證明" options={tagOptions.disability} value={subjInfo.disability} onChange={v => setSubjInfo({...subjInfo, disability: v})} isEditing={isEditingTags} onAdd={t => handleAddTag('disability', t)} onRemove={t => handleRemoveTag('disability', t)} />
        </div>

        <div className="section">
          <label>職業 / 經歷 (可自填)</label>
          <input type="text" value={subjInfo.job} onChange={e => setSubjInfo({...subjInfo, job: e.target.value})} placeholder="例：家管、務農、退休人員" />
        </div>

        <div className="section">
          <label>案主特殊備註</label>
          <input type="text" value={subjInfo.note} onChange={e => setSubjInfo({...subjInfo, note: e.target.value})} placeholder="例：每月領取相關補助，或具其他特殊背景" />
        </div>

        <h2 style={{ marginTop: '20px' }}>
          家屬動態清單 (由家系圖連動)
          {isGen2Index && <span className="ip-pill">案主為第二代，其餘第二代以手足稱謂呈現</span>}
        </h2>
        {gen2Cfg.length === 0 && <div className="hint" style={{fontSize: '13px'}}>請先於「家系圖繪製」頁籤輸入第二代子女，這裡會自動產生填寫欄位喔！</div>}
        {isGen2Index && gen2Cfg.length === 1 && <div className="hint" style={{fontSize: '13px'}}>案主本人的資料請填在上方「案主基本資料」，這裡只列出案主的手足。</div>}

        {gen2Cfg.map((c, i) => {
          if (i === selfIdx) return null; // 案主本人的資料填在上方「案主基本資料」
          const title = titleOf(i);
          const isDeceased = deceasedIds.includes(`c${i}`);
          const ext = famExtras[i] || { location: '', job: '', isPrimary: false, note: '' };

          return (
            <div key={i} className="fam-card" style={{ opacity: isDeceased ? 0.6 : 1 }}>
              <div className="fam-title">
                <span>{title} {isDeceased && <span className="tag-warn">(已歿)</span>}</span>
                <label className="primary-contact">
                  <input type="checkbox" tabIndex={-1} checked={ext.isPrimary} onChange={e => setPrimaryContact(i, e.target.checked)} disabled={isDeceased} /> 主要聯絡人
                </label>
              </div>

              {!isDeceased && (
                <div className="fam-grid">
                  <div>
                    <div className="hint" style={{marginBottom: '2px'}}>居住地</div>
                    <input type="text" value={ext.location || ''} onChange={e => handleFamExtra(i, 'location', e.target.value)} placeholder="例：台南" />
                  </div>
                  <div>
                    <div className="hint" style={{marginBottom: '2px'}}>職業</div>
                    <input type="text" value={ext.job || ''} onChange={e => handleFamExtra(i, 'job', e.target.value)} placeholder="例：家管、從商" />
                  </div>
                  <div style={{gridColumn: '1 / -1'}}>
                    <div className="hint" style={{marginBottom: '2px'}}>特殊備註</div>
                    <input type="text" value={ext.note || ''} onChange={e => handleFamExtra(i, 'note', e.target.value)} placeholder="例：拒絕回答孫輩狀況" />
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
                <div key={kidKey} className="fam-card fam-card-g3" style={{ opacity: isDeceased ? 0.6 : 1 }}>
                  <div className="fam-title">
                    <span>{title} {isDeceased && <span className="tag-warn">(已歿)</span>}</span>
                    <label className="primary-contact">
                      <input type="checkbox" tabIndex={-1} checked={ext.isPrimary || false} onChange={e => setPrimaryContact(kidKey, e.target.checked)} disabled={isDeceased} /> 主要聯絡人
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
            <button onClick={exportBackup} className="btn-soft tone-dust btn-soft-wide">📥 匯出設定檔</button>
            <label className="btn-soft tone-sage btn-soft-wide">
              📤 匯入設定檔
              <input type="file" accept=".json" onChange={importBackup} style={{ display: 'none' }} />
            </label>
          </div>
          <div className="hint" style={{ marginTop: '6px' }}>
            這裡存的是「編輯標籤」的選項和「自由保存區」的內容，<b>不含案件本身</b>；
            案件（家系圖與紀錄資料）請到「家系圖繪製」頁籤的案件列另外匯出。
            更換電腦或清除瀏覽器資料前，兩邊都建議先各自備份一次。
          </div>
        </div>

      </div>

      {/* 右側即時預覽區 */}
      <div className="record-preview">
        <h2 className="record-preview-title">
          <span>✨ 個案紀錄{isManual ? '（已手動修改）' : '即時預覽'}</span>
          {isManual && (
            <button type="button" className="btn-restore" onClick={() => setRecordEdit('')}
                    title="捨棄手動修改，回到跟著家系圖即時重算">↻ 還原成自動產生</button>
          )}
        </h2>
        {/* 舊圖修補模式下，畫布上的人物是自由擴充區的個體，沒有結構化的
            親屬關係可讀，自動敘述會是空的或只剩案主一句 —— 與其讓使用者
            以為是壞掉了，不如講清楚這裡要自己寫。 */}
        {!mainFamily && (
          <div className="record-notice">
            目前是舊圖修補模式（主家系已停用）。畫布上的人物是自由擴充區的個體，
            沒有可供推算的親屬結構，因此自動敘述只會帶出基本資料；家庭狀況請直接在下方編輯。
          </div>
        )}
        <textarea
          value={displayText}
          onChange={e => setRecordEdit(e.target.value)}
          style={{ minHeight: '250px' }}
          aria-label="個案紀錄內容，可直接編輯"
        />
        <button onClick={copyRecord} className={`btn-copy ${copyState !== 'idle' ? `is-${copyState}` : ''}`}
                aria-live="polite">
          {copyState === 'done' ? '✅ 已複製到剪貼簿'
            : copyState === 'fail' ? '⚠️ 複製失敗，請手動選取上方文字'
            : '📋 一鍵複製至剪貼簿'}
        </button>

        {/* 自由保存區 */}
        <div className="free-note-box">
          <h3 className="free-note-title">📝 自由保存區</h3>
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
                className="free-note-input"
              />
              {savedNotes.length > 1 && (
                <button
                  onClick={() => setSavedNotes(prev => prev.filter((_, i) => i !== idx))}
                  className="btn-soft tone-clay"
                >✕</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setSavedNotes(prev => [...prev, ''])}
            className="btn-soft tone-dust"
          >➕ 新增一行</button>
        </div>
      </div>
    </div>
  );
};

export default RecordTab;
