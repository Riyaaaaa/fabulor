// CSV処理ユーティリティモジュール

/**
 * CSV値をエスケープする
 * @param {*} value - エスケープする値
 * @returns {string} - エスケープされた値
 */
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let stringValue = value.toString();

  // 末尾の改行や空行を除去
  stringValue = stringValue.replace(/[\n\r\s]*$/, '');

  // 改行を改行コード文字列に変換
  stringValue = stringValue.replace(/\r\n/g, '\\r\\n')
                           .replace(/\n/g, '\\n')
                           .replace(/\r/g, '\\r');

  // ダブルクォート、カンマが含まれる場合はエスケープ
  if (stringValue.includes('"') || stringValue.includes(',')) {
    stringValue = stringValue.replace(/"/g, '""');
    return `"${stringValue}"`;
  }

  return stringValue;
}

/**
 * CSV値をアンエスケープする
 * @param {string} value - アンエスケープする値
 * @returns {string} - アンエスケープされた値
 */
function unescapeCSV(value) {
  if (!value) return '';

  // 改行コード文字列を実際の改行に変換
  return value.replace(/\\r\\n/g, '\r\n')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r');
}

/**
 * CSV文字列を解析してレコード配列に変換する
 * @param {string} csvContent - CSV文字列
 * @returns {Array<Object>} - レコードの配列
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return []; // ヘッダーのみまたは空

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    records.push(record);
  }

  return records;
}

/**
 * CSV行を解析してフィールド配列に変換する
 * @param {string} line - CSV行
 * @returns {Array<string>} - フィールドの配列
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(unescapeCSV(current));
      current = '';
    } else {
      current += char;
    }
  }

  result.push(unescapeCSV(current));
  return result;
}

/**
 * 行の配列をCSV文字列に変換する
 * @param {Array<Array<string>>} rows - 行の配列（各行はフィールドの配列）
 * @returns {string} - CSV文字列
 */
function rowsToCSV(rows) {
  return rows.map(row => row.join(',')).join('\n');
}

export { escapeCSV, unescapeCSV, parseCSV, parseCSVLine, rowsToCSV };
