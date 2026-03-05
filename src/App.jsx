import { useState } from 'react';
import GenogramTab from './components/GenogramTab';
import RecordTab from './components/RecordTab';
import './styles.css';

const App = () => {
  /* --- 頁籤狀態 --- */
  const [activeTab, setActiveTab] = useState('genogram');

  /* --- 共用狀態（狀態提升：供 GenogramTab 與 RecordTab 連動） --- */
  const [gen2Str, setGen2Str] = useState('');
  const [gen2Cfg, setGen2Cfg] = useState([]);
  const [indexId, setIndexId] = useState(null);
  const [cohabMembers, setCohabMembers] = useState([]);
  const [deceasedIds, setDeceasedIds] = useState([]);
  const [g1Status, setG1Status] = useState('married');

  /* --- 自由樂高節點 & 自訂連線 --- */
  const [freeNodes, setFreeNodes] = useState([]);
  const [customLinks, setCustomLinks] = useState([]);

  return (
    <div>
      {/* 頁籤列 */}
      <div className="tab-nav">
        <button className={`tab-btn ${activeTab === 'genogram' ? 'active' : ''}`} onClick={() => setActiveTab('genogram')}>📊 家系圖繪製</button>
        <button className={`tab-btn ${activeTab === 'record' ? 'active' : ''}`} onClick={() => setActiveTab('record')}>📝 個案紀錄產生</button>
      </div>

      {/* 頁籤一：家系圖 */}
      {activeTab === 'genogram' && (
        <GenogramTab
          gen2Str={gen2Str} setGen2Str={setGen2Str}
          gen2Cfg={gen2Cfg} setGen2Cfg={setGen2Cfg}
          indexId={indexId} setIndexId={setIndexId}
          cohabMembers={cohabMembers} setCohabMembers={setCohabMembers}
          deceasedIds={deceasedIds} setDeceasedIds={setDeceasedIds}
          g1Status={g1Status} setG1Status={setG1Status}
          freeNodes={freeNodes} setFreeNodes={setFreeNodes}
          customLinks={customLinks} setCustomLinks={setCustomLinks}
        />
      )}

      {/* 頁籤二：個案紀錄產生器 */}
      {activeTab === 'record' && (
        <RecordTab
          gen2Cfg={gen2Cfg}
          indexId={indexId}
          g1Status={g1Status}
          cohabMembers={cohabMembers}
          deceasedIds={deceasedIds}
          customLinks={customLinks}
        />
      )}
    </div>
  );
};

export default App;
