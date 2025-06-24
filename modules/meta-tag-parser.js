// メタタグ解析モジュール
class MetaTagParser {
  constructor() {
    // メタタグのパターンを定義
    this.patterns = {
      wait: /\[wait\]/g,
      pause: /\[pause:(\d+)\]/g,
      speed: /\[speed:(slow|normal|fast)\]/g
    };
  }

  // テキストからすべてのメタタグを検出
  parseMetaTags(text) {
    const metaTags = [];
    
    // [wait]タグを検出
    let match;
    while ((match = this.patterns.wait.exec(text)) !== null) {
      metaTags.push({
        type: 'wait',
        position: match.index,
        length: match[0].length,
        tag: match[0]
      });
    }
    
    // [pause:ミリ秒]タグを検出
    this.patterns.pause.lastIndex = 0; // RegExpのlastIndexをリセット
    while ((match = this.patterns.pause.exec(text)) !== null) {
      metaTags.push({
        type: 'pause',
        position: match.index,
        length: match[0].length,
        tag: match[0],
        duration: parseInt(match[1], 10)
      });
    }
    
    // [speed:速度]タグを検出
    this.patterns.speed.lastIndex = 0; // RegExpのlastIndexをリセット
    while ((match = this.patterns.speed.exec(text)) !== null) {
      metaTags.push({
        type: 'speed',
        position: match.index,
        length: match[0].length,
        tag: match[0],
        speed: match[1]
      });
    }
    
    // 位置順にソート
    metaTags.sort((a, b) => a.position - b.position);
    
    return metaTags;
  }

  // テキストからメタタグを除去
  removeMetaTags(text) {
    if (!text) return text;
    
    let result = text;
    
    // すべてのメタタグパターンを除去
    result = result.replace(this.patterns.wait, '');
    result = result.replace(this.patterns.pause, '');
    result = result.replace(this.patterns.speed, '');
    
    return result;
  }

  // メタタグが含まれているかチェック
  hasMetaTags(text) {
    if (!text) return false;
    
    return this.patterns.wait.test(text) || 
           this.patterns.pause.test(text) || 
           this.patterns.speed.test(text);
  }

  // テキストをメタタグで分割
  splitByMetaTags(text) {
    if (!text) return [{ text: '', metaTags: [] }];
    
    const metaTags = this.parseMetaTags(text);
    if (metaTags.length === 0) {
      return [{ text: text, metaTags: [] }];
    }
    
    const segments = [];
    let currentPosition = 0;
    
    metaTags.forEach(metaTag => {
      // メタタグ前のテキスト
      if (metaTag.position > currentPosition) {
        const segmentText = text.substring(currentPosition, metaTag.position);
        segments.push({ text: segmentText, metaTags: [] });
      }
      
      // メタタグ自体
      segments.push({ text: '', metaTags: [metaTag] });
      
      currentPosition = metaTag.position + metaTag.length;
    });
    
    // 最後のメタタグ以降のテキスト
    if (currentPosition < text.length) {
      const remainingText = text.substring(currentPosition);
      segments.push({ text: remainingText, metaTags: [] });
    }
    
    return segments;
  }

  // メタタグの妥当性をチェック
  validateMetaTag(tagText) {
    const trimmed = tagText.trim();
    
    // [wait]の妥当性チェック
    if (trimmed === '[wait]') {
      return { valid: true, type: 'wait' };
    }
    
    // [pause:数値]の妥当性チェック
    const pauseMatch = trimmed.match(/^\[pause:(\d+)\]$/);
    if (pauseMatch) {
      const duration = parseInt(pauseMatch[1], 10);
      if (duration >= 0) {
        return { valid: true, type: 'pause', duration };
      }
    }
    
    // [speed:速度]の妥当性チェック
    const speedMatch = trimmed.match(/^\[speed:(slow|normal|fast)\]$/);
    if (speedMatch) {
      return { valid: true, type: 'speed', speed: speedMatch[1] };
    }
    
    return { valid: false, error: '無効なメタタグです' };
  }
}

export { MetaTagParser };