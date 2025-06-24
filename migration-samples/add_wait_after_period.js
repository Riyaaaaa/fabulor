/*
 * @name 句読点後にwaitタグ挿入
 * @description 句読点「。」の後に[wait]メタタグを挿入します（文末は除く）
 */

function migrate(block) {
  // ブロックのディープコピーを作成
  const migratedBlock = JSON.parse(JSON.stringify(block));
  
  // テキストが存在する場合のみ処理
  if (migratedBlock.text && migratedBlock.text.trim()) {
    let text = migratedBlock.text;
    
    // まず、既存の[wait]タグを一時的に除去（冪等性確保）
    text = text.replace(/。\[wait\]/g, '。');
    
    // 句読点「。」の後に何かしらの文字（改行、空白、文字等）が続く場合に[wait]を挿入
    // ただし、段落の最後（文字列の末尾または改行・空白のみが続く場合）は除外
    // (?=[\s\S]) は改行を含む任意の文字を先読み
    // (?![\s]*$) は文字列の末尾または空白・改行のみが続く場合でないことを確認
    text = text.replace(/。(?=[\s\S])(?![\s]*$)/g, '。[wait]');
    
    // テキストが変更された場合のみ更新
    if (text !== migratedBlock.text) {
      migratedBlock.text = text;
      migratedBlock.updatedAt = new Date().toISOString();
    }
  }
  
  return migratedBlock;
}

module.exports = { migrate };