import React, { useState, useEffect } from 'react';
import { bitable, FieldType } from '@lark-base-open/js-sdk';

export default function App() {
  const [fields, setFields] = useState([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [template, setTemplate] = useState('');
  const [placeholder, setPlaceholder] = useState('{N}');
  const [mode, setMode] = useState('extract'); // 默认智能提取模式：extract 或 calc
  const [calcExpr, setCalcExpr] = useState('x'); // 默认直接使用提取出的数字
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState('');

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

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedFieldIds(fields.map(f => f.id));
    } else {
      setSelectedFieldIds([]);
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
          // 获取公式字段并调用飞书官方 setFormula 写入
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

  return (
    <div style={{ padding: '14px', fontFamily: 'sans-serif', fontSize: '13px', color: '#333' }}>
      <h3 style={{ margin: '0 0 10px 0', paddingBottom: '6px', borderBottom: '1px solid #eee' }}>⚡ 中文列名公式批量生成器</h3>

      {/* 1. 选择要操作的公式列 */}
      <div style={{ marginBottom: '10px', background: '#f8f9fa', padding: '8px', borderRadius: '6px' }}>
        <strong>1. 选择要更新的公式列：</strong>
        <div style={{ marginTop: '4px' }}>
          <label style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            <input
              type="checkbox"
              checked={fields.length > 0 && selectedFieldIds.length === fields.length}
              onChange={handleSelectAll}
            /> 全选 ({fields.length})
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginTop: '6px', maxHeight: '100px', overflowY: 'auto' }}>
          {fields.map(f => (
            <label key={f.id} style={{ fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedFieldIds.includes(f.id)}
                onChange={() => handleFieldToggle(f.id)}
              /> {f.name}
            </label>
          ))}
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
          rows={6}
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