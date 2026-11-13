import React, { useState, useEffect } from 'react';
import { bitable, FieldType } from '@lark-base-open/js-sdk';

export default function App() {
  const [fields, setFields] = useState([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [template, setTemplate] = useState('');
  const [placeholder, setPlaceholder] = useState('{N}');
  const [mode, setMode] = useState('extract'); // 智能提取模式：extract 或 calc
  const [calcExpr, setCalcExpr] = useState('x'); // 计算表达式
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('');

  // 🔍 新增：搜索过滤相关的状态
  const [searchText, setSearchText] = useState('');
  const [matchType, setMatchType] = useState('fuzzy'); // fuzzy: 模糊匹配, exact: 精确匹配

  // 初始化获取所有公式字段
  useEffect(() => {
    async function loadFields() {
      try {
        const table = await bitable.base.getActiveTable();
        const metaList = await table.getFieldMetaList();
        // 筛选公式列
        const formulaFields = metaList.filter(f => f.type === FieldType.Formula);
        setFields(formulaFields);
        // 默认全选所有公式列
        setSelectedFieldIds(formulaFields.map(f => f.id));
      } catch (err) {
        setLog(`加载字段失败: ${err.message}`);
      }
    }
    loadFields();
  }, []);

  // 🔍 根据搜索词和匹配模式过滤后的字段列表
  const filteredFields = fields.filter(f => {
    const keyword = searchText.trim();
    if (!keyword) return true; // 如果没输入搜索词，显示全部

    if (matchType === 'exact') {
      // 精确匹配（列名必须和输入完全一致）
      return f.name === keyword;
    } else {
      // 模糊匹配（列名中包含输入的内容，不区分大小写）
      return f.name.toLowerCase().includes(keyword.toLowerCase());
    }
  });

  // 全选 / 取消全选（针对当前筛选出来的可见字段进行全选操作）
  const handleSelectAllFiltered = (e) => {
    const filteredIds = filteredFields.map(f => f.id);
    if (e.target.checked) {
      // 将当前筛选出的字段合并进已选列表（避免漏掉之前勾选的）
      const newSelected = Array.from(new Set([...selectedFieldIds, ...filteredIds]));
      setSelectedFieldIds(newSelected);
    } else {
      // 移除当前筛选出来的字段
      setSelectedFieldIds(selectedFieldIds.filter(id => !filteredIds.includes(id)));
    }
  };

  const handleFieldToggle = (id) => {
    if (selectedFieldIds.includes(id)) {
      setSelectedFieldIds(selectedFieldIds.filter(i => i !== id));
    } else {
      setSelectedFieldIds([...selectedFieldIds, id]);
    }
  };

  // 核心批量更新方法
  const handleBatchUpdate = async () => {
    if (!template.trim()) {
      alert('请先粘贴公式模板！');
      return;
    }
    setLoading(true);
    setLog('⌛ 开始批量更新，请稍候...\n');

    try {
      const table = await bitable.base.getActiveTable();
      let successCount = 0;

      for (const fieldId of selectedFieldIds) {
        const fieldMeta = fields.find(f => f.id === fieldId);
        if (!fieldMeta) continue;

        const fieldName = fieldMeta.name.trim();

        // 🔍 智能正则：从字段名称中提取数字（例如从 "活动1销量" 中提取出数字 1）
        const numMatch = fieldName.match(/\d+/);
        if (!numMatch) {
          setLog(prev => prev + `⚠️ 列【${fieldName}】名称中未找到任何数字，无法解析 {N}，跳过。\n`);
          continue;
        }

        const rawNum = parseFloat(numMatch[0]);
        let finalN = rawNum;

        // 如果设置了计算表达式（例如输入 x - 1 或者 x * 2）
        if (mode === 'calc' && calcExpr.trim()) {
          try {
            const calcFunc = new Function('x', `return ${calcExpr};`);
            finalN = calcFunc(rawNum);
          } catch (err) {
            setLog(prev => prev + `❌ 计算表达式 [${calcExpr}] 错误，跳过字段【${fieldName}】\n`);
            continue;
          }
        }

        // 替换模板中的占位符
        let newFormula = template.replaceAll(placeholder, finalN);

        // 自动修正全角中文引号为英文半角引号
        newFormula = newFormula.replace(/“/g, '"').replace(/”/g, '"').replace(/’/g, "'").replace(/‘/g, "'");

        try {
          const formulaField = await table.getField(fieldId);
          await formulaField.setFormula(newFormula);

          successCount++;
          setLog(prev => prev + `✅ 成功写入列【${fieldName}】 ➔ 提取数字: ${rawNum} ➔ N = ${finalN}\n`);
        } catch (fieldErr) {
          setLog(prev => prev + `❌ 列【${fieldName}】更新失败！飞书拒绝了该公式，原因: ${fieldErr.message}\n`);
        }
      }

      setLog(prev => prev + `\n🎉 运行完成，成功更新 ${successCount} 个字段！`);
    } catch (err) {
      setLog(prev => prev + `\n💥 全局错误: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 检查当前筛选出的所有项是否全部被勾选
  const isAllFilteredSelected = filteredFields.length > 0 && filteredFields.every(f => selectedFieldIds.includes(f.id));

  return (
    <div style={{ padding: '14px', fontFamily: 'sans-serif', fontSize: '13px', color: '#333' }}>
      <h3 style={{ margin: '0 0 10px 0', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>⚡ 中文列名公式批量生成器</h3>

      {/* 1. 选择并搜索公式列 */}
      <div style={{ marginBottom: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '6px' }}>
        <strong>1. 选择要更新的公式列：</strong>
        
        {/* 🔍 搜索输入框与模式切换 */}
        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="输入关键字搜索列名..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <select
            value={matchType}
            onChange={e => setMatchType(e.target.value)}
            style={{ padding: '4px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff' }}
          >
            <option value="fuzzy">模糊匹配</option>
            <option value="exact">精确匹配</option>
          </select>
        </div>

        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={isAllFilteredSelected}
              onChange={handleSelectAllFiltered}
            /> 全选当前筛选结果 ({filteredFields.length}/{fields.length})
          </label>
          <span style={{ color: '#666', fontSize: '11px' }}>已选: {selectedFieldIds.length} 列</span>
        </div>

        {/* 字段复选框网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginTop: '6px', maxHeight: '100px', overflowY: 'auto', background: '#fff', padding: '4px', border: '1px solid #eee', borderRadius: '4px' }}>
          {filteredFields.length > 0 ? (
            filteredFields.map(f => (
              <label key={f.id} style={{ fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.name}>
                <input
                  type="checkbox"
                  checked={selectedFieldIds.includes(f.id)}
                  onChange={() => handleFieldToggle(f.id)}
                /> {f.name}
              </label>
            ))
          ) : (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#999', fontSize: '11px', padding: '6px' }}>
              没有找到匹配的字段
            </div>
          )}
        </div>
      </div>

      {/* 2. 智能数字提取与计算规则 */}
      <div style={{ marginBottom: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '6px' }}>
        <strong>2. 占位符 {placeholder} 提取规则：</strong>
        <div style={{ margin: '4px 0' }}>
          占位符文本：
          <input
            type="text"
            value={placeholder}
            onChange={e => setPlaceholder(e.target.value)}
            style={{ width: '45px', padding: '2px', marginLeft: '4px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', margin: '3px 0', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mode"
              value="extract"
              checked={mode === 'extract'}
              onChange={() => setMode('extract')}
            /> 直接使用名字里的数字 (如 "活动1销量" ➔ N = 1)
          </label>
          <label style={{ display: 'block', margin: '3px 0', cursor: 'pointer' }}>
            <input
              type="radio"
              name="mode"
              value="calc"
              checked={mode === 'calc'}
              onChange={() => setMode('calc')}
            /> 对提取的数字进行运算 (例如 x * 7)
          </label>
          {mode === 'calc' && (
            <div style={{ marginLeft: '18px', marginTop: '2px' }}>
              计算表达式 (x代表提取出的数字): 
              <input
                type="text"
                value={calcExpr}
                onChange={e => setCalcExpr(e.target.value)}
                style={{ width: '70px', padding: '2px', marginLeft: '4px' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. 公式模板 */}
      <div style={{ marginBottom: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '6px' }}>
        <strong>3. 粘贴带有 {placeholder} 的公式模板：</strong>
        <textarea
          rows={5}
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder={`例如模板：\nSWITCH({N}, 1, [销量A], 2, [销量B])`}
          style={{ width: '100%', marginTop: '4px', boxSizing: 'border-box', fontFamily: 'monospace', fontSize: '11px' }}
        />
      </div>

      {/* 4. 执行按钮 */}
      <button
        onClick={handleBatchUpdate}
        disabled={loading || selectedFieldIds.length === 0}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: loading ? '#ccc' : '#3370ff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {loading ? '更新中...' : `🚀 批量更新选中的 ${selectedFieldIds.length} 个公式字段`}
      </button>

      {/* 运行日志 */}
      {log && (
        <pre style={{
          marginTop: '8px',
          padding: '6px',
          background: '#1e1e1e',
          color: '#00ff00',
          borderRadius: '4px',
          fontSize: '11px',
          maxHeight: '100px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {log}
        </pre>
      )}
    </div>
  );
}