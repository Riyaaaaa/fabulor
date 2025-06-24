// メタタグ解析モジュール
class MetaTagParser {
  constructor() {
    // メタタグのパターンを定義
    this.patterns = {
      wait: /\[wait\]/g,
      pause: /\[pause:(\d+)\]/g,
      speed: /\[speed:(slow|normal|fast)\]/g
    };
    
    // YAMLから読み込むメタコマンド定義
    this.metaCommands = {};
    this.commandColors = {};
    this.settings = {
      default_color: "#666666",
      error_color: "#FF0000",
      error_underline: true
    };
  }

  // YAMLファイルからメタコマンド定義を読み込み
  async loadMetaCommandsFromYaml(yamlPath) {
    try {
      const result = await window.electronAPI.loadYamlFile(yamlPath);
      if (result.success) {
        const data = result.data;
        this.metaCommands = data.meta_commands || {};
        this.settings = { ...this.settings, ...(data.settings || {}) };
        
        // コマンドの色情報を抽出
        this.commandColors = {};
        Object.entries(this.metaCommands).forEach(([key, command]) => {
          this.commandColors[key] = command.color || this.settings.default_color;
        });
        
        console.log('メタコマンド定義を読み込みました:', Object.keys(this.metaCommands));
        return true;
      } else {
        console.error('メタコマンド定義ファイルの読み込みに失敗:', result.error);
        return false;
      }
    } catch (error) {
      console.error('メタコマンド定義読み込みエラー:', error);
      return false;
    }
  }

  // テキストからすべてのメタタグを検出
  parseMetaTags(text) {
    const metaTags = [];
    
    // 一般的なメタタグパターン [command] または [command:parameter]
    const generalPattern = /\[([a-zA-Z_][a-zA-Z0-9_]*?)(?::([^\]]+))?\]/g;
    
    let match;
    while ((match = generalPattern.exec(text)) !== null) {
      const commandName = match[1];
      const parameter = match[2] || null;
      const isValid = this.isValidCommand(commandName, parameter);
      
      metaTags.push({
        type: commandName,
        position: match.index,
        length: match[0].length,
        tag: match[0],
        parameter: parameter,
        isValid: isValid,
        color: this.getCommandColor(commandName, isValid)
      });
    }
    
    // 位置順にソート
    metaTags.sort((a, b) => a.position - b.position);
    
    return metaTags;
  }

  // コマンドの妥当性チェック
  isValidCommand(commandName, parameter) {
    if (!this.metaCommands[commandName]) {
      return false;
    }
    
    const command = this.metaCommands[commandName];
    
    // パラメータが必要なコマンドの場合
    if (command.parameters && command.parameters.length > 0) {
      if (!parameter) {
        return false;
      }
      
      // パラメータの妥当性チェック
      const param = command.parameters[0]; // 簡略化：最初のパラメータのみチェック
      
      if (param.type === 'number') {
        const num = parseInt(parameter, 10);
        if (isNaN(num)) return false;
        if (param.min !== undefined && num < param.min) return false;
        if (param.max !== undefined && num > param.max) return false;
      } else if (param.type === 'enum') {
        if (!param.values.includes(parameter)) return false;
      }
    } else {
      // パラメータが不要なコマンドにパラメータがある場合
      if (parameter) {
        return false;
      }
    }
    
    return true;
  }

  // コマンドの色を取得
  getCommandColor(commandName, isValid) {
    if (!isValid) {
      return this.settings.error_color;
    }
    return this.commandColors[commandName] || this.settings.default_color;
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