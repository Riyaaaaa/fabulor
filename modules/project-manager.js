// プロジェクト管理モジュール
class ProjectManager {
  constructor() {
    this.projectPath = null;
    this.hasUnsavedChanges = false;
    this.currentSchemaFile = 'block-types.yaml';
  }

  setProjectPath(path) {
    this.projectPath = path;
  }

  getProjectPath() {
    return this.projectPath;
  }

  markAsChanged() {
    this.hasUnsavedChanges = true;
  }

  markAsSaved() {
    this.hasUnsavedChanges = false;
  }

  hasChanges() {
    return this.hasUnsavedChanges;
  }

  getCurrentSchemaFile() {
    return this.currentSchemaFile;
  }

  async newProject() {
    this.projectPath = null;
    this.hasUnsavedChanges = false;
    return true;
  }

  async saveProject(scenes, currentSceneId) {
    try {
      const projectData = {
        version: '2.0.0',
        createdAt: new Date().toISOString(),
        schemaFile: this.currentSchemaFile,
        scenes: scenes,
        currentSceneId: currentSceneId
      };
      
      const result = await window.electronAPI.saveProject(projectData, this.projectPath);
      
      if (result.success) {
        this.projectPath = result.path;
        this.hasUnsavedChanges = false;
        // スキーマファイル名を更新
        if (result.schemaFileName) {
          this.currentSchemaFile = result.schemaFileName;
        }
        alert('プロジェクトを保存しました');
        return { success: true, path: result.path, schemaFileName: result.schemaFileName };
      } else {
        const errorMessage = result.error || '不明なエラー';
        alert(`プロジェクトの保存に失敗しました\n\nエラー内容: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert(`プロジェクトの保存に失敗しました\n\nエラー内容: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async openProject() {
    try {
      const result = await window.electronAPI.openProject();
      
      if (result.success) {
        this.projectPath = result.path;
        this.hasUnsavedChanges = false;
        this.currentSchemaFile = result.data.schemaFile || 'schema.yaml';
        // バージョンチェック
        const version = result.data.version || '1.0.0';
        
        if (version === '1.0.0') {
          // 旧バージョンのプロジェクトを新形式に変換
          const convertedData = {
            version: '2.0.0',
            createdAt: result.data.createdAt,
            schemaFile: result.data.schemaFile || 'schema.yaml',
            scenes: [{
              id: 'default_scene',
              name: 'メインシーン',
              fileName: 'default_scene.json'
            }],
            currentSceneId: 'default_scene'
          };
          
          // 旧データの段落は別途処理が必要
          return {
            success: true,
            data: convertedData,
            path: result.path,
            schemaFile: this.currentSchemaFile,
            legacyParagraphs: result.data.paragraphs || []
          };
        }
        
        return {
          success: true,
          data: result.data,
          path: result.path,
          schemaFile: this.currentSchemaFile
        };
      }
      return { success: false, cancelled: result.cancelled };
    } catch (error) {
      console.error('読み込みエラー:', error);
      alert(`読み込みに失敗しました\n\nエラー内容: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async exportCSV(paragraphs, blockTypeManager) {
    try {
      // CSVデータを生成
      const csvData = this.generateCSV(paragraphs, blockTypeManager);
      
      const result = await window.electronAPI.exportCSV(csvData);
      
      if (result.success) {
        alert('CSVファイルをエクスポートしました');
        return { success: true };
      } else {
        // キャンセルの場合は何もしない
        if (result.cancelled) {
          return { success: false, cancelled: true };
        }
        const errorMessage = result.error || '不明なエラー';
        alert(`CSVエクスポートに失敗しました\n\nエラー内容: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert(`CSVエクスポートに失敗しました\n\nエラー内容: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async exportAllScenesAsCSV(projectPath, scenes, blockTypes, structs) {
    try {
      const result = await window.electronAPI.exportAllScenesAsCSV(projectPath, scenes, blockTypes, structs);
      
      if (result.success) {
        alert(`全シーンのCSVエクスポートが完了しました。\n\n出力先: ${result.outputDir}\n作成されたファイル数: ${result.fileCount}`);
        return { success: true };
      } else {
        // キャンセルの場合は何もしない（全シーンエクスポートはファイルダイアログを使わないため通常は発生しない）
        if (result.cancelled) {
          return { success: false, cancelled: true };
        }
        const errorMessage = result.error || '不明なエラー';
        alert(`CSVエクスポートに失敗しました\n\nエラー内容: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('全シーンエクスポートエラー:', error);
      alert(`CSVエクスポートに失敗しました\n\nエラー内容: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  generateCSV(paragraphs, blockTypeManager) {
    // 最大のArg数を計算
    let maxArgs = 0;
    paragraphs.forEach(paragraph => {
      const blockType = blockTypeManager.getBlockType(paragraph.type);
      let argCount = 0;
      
      // パラメータの数をカウント
      if (blockType && blockType.parameters) {
        argCount = Object.keys(blockType.parameters).length;
      }
      
      // テキストがある場合は+1
      if (blockType && blockType.requires_text && paragraph.text) {
        argCount += 1;
      }
      
      maxArgs = Math.max(maxArgs, argCount);
    });

    // ヘッダー行を生成
    const headers = ['Type', 'Tag'];
    for (let i = 1; i <= maxArgs; i++) {
      headers.push(`Arg${i}`);
    }
    
    // CSV行を生成
    const rows = [headers];
    
    paragraphs.forEach(paragraph => {
      const row = [];
      const blockType = blockTypeManager.getBlockType(paragraph.type);
      
      // Type
      row.push(this.escapeCSV(paragraph.type));
      
      // Tag
      row.push(this.escapeCSV(paragraph.tags.join(',')));
      
      // Args
      const args = [];
      
      // パラメータを順番に追加
      if (blockType && blockType.parameters) {
        Object.keys(blockType.parameters).forEach(paramKey => {
          const paramDef = blockType.parameters[paramKey];
          const value = paragraph[paramKey] || '';
          
          // struct型の場合は特別な形式で出力
          if (paramDef.type && blockTypeManager.isValidStructType(paramDef.type)) {
            const structValue = this.formatStructForCSV(value, paramDef.type, blockTypeManager);
            args.push(this.escapeCSV(structValue));
          } else {
            args.push(this.escapeCSV(value.toString()));
          }
        });
      }
      
      // テキストを最後に追加
      if (blockType && blockType.requires_text && paragraph.text) {
        args.push(this.escapeCSV(paragraph.text));
      }
      
      // 残りのArgを空文字で埋める
      while (args.length < maxArgs) {
        args.push('');
      }
      
      rows.push([...row, ...args]);
    });
    
    // CSV文字列に変換
    return rows.map(row => row.join(',')).join('\n');
  }

  // struct型の値をCSV用の文字列形式に変換
  formatStructForCSV(structValue, structType, blockTypeManager) {
    if (!structValue || typeof structValue !== 'object') {
      return '';
    }
    
    const structDef = blockTypeManager.getStruct(structType);
    if (!structDef || !structDef.properties) {
      return '';
    }
    
    // プロパティ=値の形式で結合
    const pairs = [];
    Object.keys(structDef.properties).forEach(propKey => {
      const propValue = structValue[propKey];
      if (propValue !== undefined && propValue !== null && propValue !== '') {
        pairs.push(`${propKey}=${propValue}`);
      }
    });
    
    return pairs.join(';');
  }

  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }
    
    value = value.toString();
    
    // 末尾の改行や空行を除去
    value = value.replace(/[\n\r\s]*$/, '');
    
    // 改行を改行コード文字列に変換
    value = value.replace(/\r\n/g, '\\r\\n')
                 .replace(/\n/g, '\\n')
                 .replace(/\r/g, '\\r');
    
    // ダブルクォート、カンマが含まれる場合はエスケープ
    if (value.includes('"') || value.includes(',')) {
      // ダブルクォートをエスケープ
      value = value.replace(/"/g, '""');
      // 全体をダブルクォートで囲む
      return `"${value}"`;
    }
    
    return value;
  }

  updateTitle() {
    const headerTitle = document.querySelector('header h1');
    const asterisk = this.hasUnsavedChanges ? '*' : '';
    
    if (this.projectPath) {
      const fileName = this.projectPath.split('/').pop().replace('.fbl', '');
      const newTitle = `Fabulor - ${fileName}${asterisk}`;
      document.title = newTitle;
      if (headerTitle) {
        headerTitle.textContent = newTitle;
      }
    } else {
      const newTitle = `Fabulor - 無題のプロジェクト${asterisk}`;
      document.title = newTitle;
      if (headerTitle) {
        headerTitle.textContent = newTitle;
      }
    }
  }
}

export { ProjectManager };