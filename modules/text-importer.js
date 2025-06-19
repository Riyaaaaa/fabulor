// テキストインポート管理モジュール
class TextImporter {
  constructor(paragraphManager) {
    this.paragraphManager = paragraphManager;
  }

  generateParagraphId() {
    return 'para_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // テキストファイルからブロックを自動生成
  importFromText(textContent) {
    const paragraphs = [];
    
    // 基本的な前処理
    const cleanedText = this.preprocessText(textContent);
    
    // ブロックに分割
    const blocks = this.splitIntoBlocks(cleanedText);
    
    // 各ブロックを分析してparagraphオブジェクトに変換
    blocks.forEach(block => {
      if (block.trim()) {
        const paragraph = this.analyzeBlock(block);
        if (paragraph) {
          paragraphs.push(paragraph);
        }
      }
    });
    
    return paragraphs;
  }

  // テキストの前処理
  preprocessText(text) {
    // 全角スペースを半角スペースに統一
    text = text.replace(/　/g, ' ');
    
    // 連続する空白文字を単一の空白に
    text = text.replace(/[ \t]+/g, ' ');
    
    // 行末の空白を削除
    text = text.replace(/[ \t]+$/gm, '');
    
    // Windows改行をUnix改行に統一
    text = text.replace(/\r\n/g, '\n');
    text = text.replace(/\r/g, '\n');
    
    return text;
  }

  // テキストをブロックに分割
  splitIntoBlocks(text) {
    const lines = text.split('\n');
    const blocks = [];
    let currentBlock = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 空行の場合
      if (line === '') {
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        continue;
      }
      
      // セリフの可能性がある行（「」で囲まれている）
      if (this.isDialogueLine(line)) {
        // 現在のブロックがあれば保存
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
          currentBlock = '';
        }
        // セリフは独立したブロックとして扱う
        blocks.push(line);
        continue;
      }
      
      // 通常のテキスト行
      if (currentBlock) {
        currentBlock += '\n' + line;
      } else {
        currentBlock = line;
      }
    }
    
    // 最後のブロックを追加
    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }
    
    return blocks;
  }

  // セリフ行かどうかを判定（文頭の鍵カッコのみセリフとして扱う）
  isDialogueLine(line) {
    // 行の先頭（空白等を除く）が「で始まっているかチェック
    const trimmedLine = line.trim();
    
    // 空行は対象外
    if (!trimmedLine) {
      return false;
    }
    
    // 文頭が「で始まる場合のみセリフとして判定
    if (trimmedLine.startsWith('「')) {
      // 対応する」があることも確認
      return trimmedLine.includes('」');
    }

    return false;
  }

  // キャラクター名を抽出（セリフの前にある名前を想定）
  extractSpeakerName(line) {
    // パターン1: 「名前：「セリフ」」形式
    const pattern1 = /^(.+?)：「.*」/;
    const match1 = line.match(pattern1);
    if (match1) {
      return match1[1].trim();
    }
    
    // パターン2: 「名前「セリフ」」形式
    const pattern2 = /^(.+?)「.*」/;
    const match2 = line.match(pattern2);
    if (match2) {
      const speaker = match2[1].trim();
      // 短すぎる場合（助詞など）は除外
      if (speaker.length > 0 && speaker.length <= 10) {
        return speaker;
      }
    }
    
    return '';
  }

  // セリフテキストを抽出
  extractDialogueText(line) {
    const dialoguePattern = /「(.*)」/;
    const match = line.match(dialoguePattern);
    return match ? match[1] : line;
  }

  // ブロックを分析してparagraphオブジェクトに変換
  analyzeBlock(block) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();
    
    // セリフの場合
    if (this.isDialogueLine(firstLine)) {
      const speaker = this.extractSpeakerName(firstLine);
      const dialogueText = this.extractDialogueText(firstLine);
      
      return {
        id: this.generateParagraphId(),
        type: 'dialogue',
        text: dialogueText,
        speaker: speaker,
        emotion: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // 地の文の場合
    else {
      // 複数行をまとめる
      const narrativeText = lines.join('\n');
      
      return {
        id: this.generateParagraphId(),
        type: 'narrative',
        text: narrativeText,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // 段落をより詳細に分析する（将来の拡張用）
  analyzeAdvanced(block) {
    // ここに高度な分析ロジックを追加可能
    // - 命令文の検出（コマンドブロック）
    // - 特定のキーワードによる分類
    // - 文体の分析
    return this.analyzeBlock(block);
  }

  // インポート結果のプレビューを生成
  generatePreview(paragraphs) {
    const preview = paragraphs.map((paragraph, index) => {
      const typeLabel = paragraph.type === 'dialogue' ? 'セリフ' : '地の文';
      const speaker = paragraph.speaker ? ` (${paragraph.speaker})` : '';
      const textPreview = paragraph.text.length > 50 
        ? paragraph.text.substring(0, 50) + '...' 
        : paragraph.text;
      
      return `${index + 1}. [${typeLabel}${speaker}] ${textPreview}`;
    }).join('\n');
    
    return preview;
  }
}

export { TextImporter };