// 导入导出工具函数

/**
 * 导出数据为 JSON 文件
 */
export function exportToJSON(data: any, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 导出数据为 CSV 文件
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  
  // 获取所有键
  const keys = Object.keys(data[0]);
  
  // 构建 CSV 内容
  const csvContent = [
    keys.join(','), // 表头
    ...data.map(row => 
      keys.map(key => {
        let value = row[key];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'object') value = JSON.stringify(value);
        // 处理包含逗号或引号的值
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // 添加 BOM 以支持中文
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从文件导入 JSON 数据
 */
export function importFromJSON<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (error) {
        reject(new Error('无效的 JSON 文件'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 从文件导入 CSV 数据
 */
export function importFromCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV 文件格式错误');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.replace(/^"|"$/g, '') || '';
          });
          return obj;
        });
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 导出 Excel 格式（简化版，使用 HTML 表格）
 */
export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  
  const keys = Object.keys(data[0]);
  
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8"></head>
    <body>
    <table border="1">
      <thead>
        <tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${data.map(row => `<tr>${keys.map(k => `<td>${row[k] ?? ''}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
    </body></html>
  `;
  
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
