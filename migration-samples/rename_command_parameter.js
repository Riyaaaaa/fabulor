/*
 * @name コマンド引数名変更
 * @description ブロックタイプの引数名を変更します（例：speaker → character_name）
 */

function migrate(block) {
  // ブロックのディープコピーを作成
  const migratedBlock = JSON.parse(JSON.stringify(block));
  
  // 引数名の変更マップ
  const parameterRenamingMap = {
    // 古い引数名 → 新しい引数名
    'speaker': 'character_name',
    'emotion': 'character_emotion',
    'commandType': 'command_type',
    'commandEffect': 'command_effect'
  };
  
  let hasChanges = false;
  
  // 各引数名をチェックして変更
  Object.entries(parameterRenamingMap).forEach(([oldName, newName]) => {
    // 古い引数名のプロパティが存在する場合
    if (migratedBlock.hasOwnProperty(oldName)) {
      // 新しい引数名に値をコピー（新しい名前がまだ存在しない場合のみ）
      if (!migratedBlock.hasOwnProperty(newName)) {
        migratedBlock[newName] = migratedBlock[oldName];
      }
      
      // 古い引数名のプロパティを削除
      delete migratedBlock[oldName];
      hasChanges = true;
      
      console.log(`引数名変更: ${oldName} → ${newName}`);
    }
  });
  
  // 変更があった場合のみupdatedAtを更新
  if (hasChanges) {
    migratedBlock.updatedAt = new Date().toISOString();
  }
  
  return migratedBlock;
}

module.exports = { migrate };