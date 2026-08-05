import { useEffect, useMemo, useState } from 'react';
import GenogramTab from './components/GenogramTab';
import HelpDrawer from './components/HelpDrawer';
import RecordTab from './components/RecordTab';
import { useCaseDoc } from './hooks/useCaseDoc';
import { idsWithAttr } from './utils/caseDoc';
import './styles.css';

const App = () => {
  /* --- 頁籤狀態（純 UI，不屬於案件文件） --- */
  const [activeTab, setActiveTab] = useState('genogram');
  const [helpOpen, setHelpOpen] = useState(false);

  /* 「?」開啟說明書；輸入框內不攔截 */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* --- 案件文件：自動存檔 + 復原/重做的單一資料來源 --- */
  const {
    doc, setField, patchDoc, toggleNodeAttr, toggleLineAttr,
    cases, activeCaseId, activeCase, isSaved,
    switchCase, saveCase, renameCase, deleteCase, exportCase, importCase,
    snapshots, takeSnapshot, restoreSnapshot, removeSnapshot,
  } = useCaseDoc();

  /* 節點標記以 nodeAttrs 為單一真相；這兩個陣列是給既有元件用的衍生值 */
  const deceasedIds = useMemo(() => idsWithAttr(doc.nodeAttrs, 'deceased'), [doc.nodeAttrs]);
  const disabledIds = useMemo(() => idsWithAttr(doc.nodeAttrs, 'disabled'), [doc.nodeAttrs]);

  return (
    <div>
      {/* 網站標頭：唯一的 <h1>，畫面上維持低調的標語列，但把「這是什麼、給誰用」
          講清楚——SEO 需要語意化的主標題，新用戶也需要一眼知道自己找對地方了。 */}
      <header className="site-header">
        <h1>Geno-Link<span className="site-tagline">社工、護理、諮商、個管等第一線工作者都適用的線上家系圖與個案紀錄產生器</span></h1>
      </header>

      {/* 頁籤列 */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'genogram' ? 'active' : ''}`} onClick={() => setActiveTab('genogram')}>📊 家系圖繪製</button>
        <button className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`} onClick={() => setActiveTab('record')}>📝 個案紀錄產生</button>

        <span className="tab-nav-spacer" />
        <button
          className="help-btn"
          onClick={() => setHelpOpen(true)}
          title="使用說明（按 ? 也可開啟）"
          aria-label="使用說明"
        >?</button>
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* 頁籤一：家系圖（用 CSS display 控制，避免 unmount 丟失狀態） */}
      <div style={{ display: activeTab === 'genogram' ? 'block' : 'none' }}>
        <GenogramTab
          doc={doc}
          setField={setField}
          patchDoc={patchDoc}
          toggleNodeAttr={toggleNodeAttr}
          toggleLineAttr={toggleLineAttr}

          cases={cases} activeCaseId={activeCaseId} activeCase={activeCase} isSaved={isSaved}
          switchCase={switchCase} saveCase={saveCase} renameCase={renameCase}
          deleteCase={deleteCase} exportCase={exportCase} importCase={importCase}

          snapshots={snapshots} takeSnapshot={takeSnapshot}
          restoreSnapshot={restoreSnapshot} removeSnapshot={removeSnapshot}

          gen2Str={doc.gen2Str} setGen2Str={setField('gen2Str')}
          gen2Cfg={doc.gen2Cfg} setGen2Cfg={setField('gen2Cfg')}
          indexId={doc.indexId} setIndexId={setField('indexId')}
          cohabMembers={doc.cohabMembers} setCohabMembers={setField('cohabMembers')}
          deceasedIds={deceasedIds}
          disabledIds={disabledIds}
          g1Status={doc.g1Status} setG1Status={setField('g1Status')}
          freeNodes={doc.freeNodes} setFreeNodes={setField('freeNodes')}
          customLinks={doc.customLinks} setCustomLinks={setField('customLinks')}
        />
      </div>

      {/* 頁籤二：個案紀錄產生器（同樣用 CSS display 控制） */}
      <div style={{ display: activeTab === 'record' ? 'block' : 'none' }}>
        <RecordTab
          gen2Cfg={doc.gen2Cfg}
          indexId={doc.indexId}
          g1Status={doc.g1Status}
          cohabMembers={doc.cohabMembers}
          deceasedIds={deceasedIds}
          disabledIds={disabledIds}
          customLinks={doc.customLinks}
        />
      </div>
    </div>
  );
};

export default App;
