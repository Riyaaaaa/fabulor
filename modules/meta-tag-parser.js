// メタタグ解析モジュール
class MetaTagParser {
  constructor() {
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
      console.log('MetaTagParser: Loading YAML from:', yamlPath);
      const result = await window.electronAPI.loadYamlFile(yamlPath);
      if (result.success) {
        const data = result.data;
        console.log('MetaTagParser: YAML data loaded:', data);
        
        this.metaCommands = data.meta_commands || {};
        this.settings = { ...this.settings, ...(data.settings || {}) };
        
        // コマンドの色情報を抽出
        this.commandColors = {};
        Object.entries(this.metaCommands).forEach(([key, command]) => {
          this.commandColors[key] = command.color || this.settings.default_color;
        });
        
        console.log('MetaTagParser: メタコマンド定義を読み込みました:', Object.keys(this.metaCommands));
        console.log('MetaTagParser: コマンド色設定:', this.commandColors);
        return true;
      } else {
        console.error('MetaTagParser: メタコマンド定義ファイルの読み込みに失敗:', result.error);
        return false;
      }
    } catch (error) {
      console.error('MetaTagParser: メタコマンド定義読み込みエラー:', error);
      return false;
    }
  }

  // テキストからすべてのメタタグを検出
  parseMetaTags(text) {
    const metaTags = [];
    
    if (!text) {
      console.log('...parseMetaTags: テキストが空');
      return metaTags;
    }
    
    // 一般的なメタタグパターン [command] または [command:parameter]
    const generalPattern = /\[([a-zA-Z_][a-zA-Z0-9_]*?)(?::([^\]]+))?\]/g;
    
    console.log('...parseMetaTags: パターン検索開始', text);
    
    let match;
    while ((match = generalPattern.exec(text)) !== null) {
      const commandName = match[1];
      const parameter = match[2] || null;
      const isValid = this.isValidCommand(commandName, parameter);
      
      console.log(`...検出: [${commandName}${parameter ? ':' + parameter : ''}] - 有効: ${isValid}`);
      
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
    
    console.log('...parseMetaTags: 検出完了', metaTags.length, '個');
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
        // 必須パラメータがあるかチェック
        return !command.parameters.some(p => p.required);
      }
      
      // 複数パラメータの場合は:で分割
      const paramValues = parameter.split(':');
      
      // パラメータの妥当性チェック
      for (let i = 0; i < command.parameters.length; i++) {
        const param = command.parameters[i];
        const value = paramValues[i];
        
        if (param.required && !value) {
          return false;
        }
        
        if (value) {
          if (!this.validateParameter(param, value)) {
            return false;
          }
        }
      }
    } else {
      // パラメータが不要なコマンドにパラメータがある場合
      if (parameter) {
        return false;
      }
    }
    
    return true;
  }

  // パラメータの妥当性を検証
  validateParameter(param, value) {
    switch (param.type) {
      case 'number':
        const num = parseInt(value, 10);
        if (isNaN(num)) return false;
        if (param.min !== undefined && num < param.min) return false;
        if (param.max !== undefined && num > param.max) return false;
        return true;
        
      case 'enum':
        return param.values.includes(value);
        
      case 'boolean':
        return value === 'true' || value === 'false';
        
      case 'string':
        // 文字列は基本的に何でもOK
        return true;
        
      default:
        return false;
    }
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
    
    // 一般的なメタタグパターンを除去
    const generalPattern = /\[([a-zA-Z_][a-zA-Z0-9_]*?)(?::([^\]]+))?\]/g;
    return text.replace(generalPattern, '');
  }

  // メタタグが含まれているかチェック
  hasMetaTags(text) {
    if (!text) return false;
    
    const generalPattern = /\[([a-zA-Z_][a-zA-Z0-9_]*?)(?::([^\]]+))?\]/;
    return generalPattern.test(text);
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
    
    // 一般的なメタタグパターン
    const generalPattern = /^\[([a-zA-Z_][a-zA-Z0-9_]*?)(?::([^\]]+))?\]$/;
    const match = trimmed.match(generalPattern);
    
    if (!match) {
      return { valid: false, error: '無効なメタタグ形式です' };
    }
    
    const commandName = match[1];
    const parameter = match[2] || null;
    
    if (!this.isValidCommand(commandName, parameter)) {
      return { valid: false, error: `無効なコマンドまたはパラメータです: ${commandName}` };
    }
    
    const command = this.metaCommands[commandName];
    const result = { valid: true, type: commandName };
    
    // パラメータを解析
    if (parameter && command.parameters) {
      const paramValues = parameter.split(':');
      command.parameters.forEach((param, index) => {
        if (paramValues[index]) {
          result[param.name] = this.parseParameterValue(param, paramValues[index]);
        }
      });
    }
    
    return result;
  }

  // パラメータ値を適切な型に変換
  parseParameterValue(param, value) {
    switch (param.type) {
      case 'number':
        return parseInt(value, 10);
      case 'boolean':
        return value === 'true';
      case 'string':
      case 'enum':
      default:
        return value;
    }
  }
}

export { MetaTagParser };