import { useMemo, useState } from 'react';
import GenogramTab from './components/GenogramTab';
import RecordTab from './components/RecordTab';
import { useCaseDoc } from './hooks/useCaseDoc';
import { idsWithAttr } from './utils/caseDoc';
import './styles.css';

const App = () => {
  /* --- 頁籤狀態（純 UI，不屬於案件文件） --- */
  const [activeTab, setActiveTab] = useState('genogram');

  /* --- 案件文件：自動存檔 + 復原/重做的單一資料來源 --- */
  const {
    doc, setField, patchDoc, replaceDoc, attrListSetter,
    undo, redo, canUndo, canRedo, savedAt, restored, dismissRestored,
  } = useCaseDoc();

  /* 節點標記以 nodeAttrs 為單一真相；這兩個陣列是給既有元件用的衍生值 */
  const deceasedIds = useMemo(() => idsWithAttr(doc.nodeAttrs, 'deceased'), [doc.nodeAttrs]);
  const disabledIds = useMemo(() => idsWithAttr(doc.nodeAttrs, 'disabled'), [doc.nodeAttrs]);

  return (
    <div>
      {/* 頁籤列 */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'genogram' ? 'active' : ''}`} onClick={() => setActiveTab('genogram')}>📊 家系圖繪製</button>
        <button className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`} onClick={() => setActiveTab('record')}>📝 個案紀錄產生</button>
      </div>

      {/* 頁籤一：家系圖（用 CSS display 控制，避免 unmount 丟失狀態） */}
      <div style={{ display: activeTab === 'genogram' ? 'block' : 'none' }}>
        <GenogramTab
          doc={doc}
          setField={setField}
          patchDoc={patchDoc}
          replaceDoc={replaceDoc}
          undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo}
          savedAt={savedAt} restored={restored} dismissRestored={dismissRestored}

          gen2Str={doc.gen2Str} setGen2Str={setField('gen2Str')}
          gen2Cfg={doc.gen2Cfg} setGen2Cfg={setField('gen2Cfg')}
          indexId={doc.indexId} setIndexId={setField('indexId')}
          cohabMembers={doc.cohabMembers} setCohabMembers={setField('cohabMembers')}
          deceasedIds={deceasedIds} setDeceasedIds={attrListSetter('deceased')}
          disabledIds={disabledIds} setDisabledIds={attrListSetter('disabled')}
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
