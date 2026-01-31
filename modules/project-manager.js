// プロジェクト管理モジュール
import { escapeCSV, rowsToCSV } from './csv-utils.js';

class ProjectManager {
  constructor() {
    this.projectPath = null;
    this.hasUnsavedChanges = false;
    this.currentSchemaFile = null; // 初期値をnullに変更
    this.currentMetaTagFile = null; // メタタグファイルのパス
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

  setCurrentSchemaFile(schemaFileName) {
    this.currentSchemaFile = schemaFileName;
  }

  getCurrentMetaTagFile() {
    return this.currentMetaTagFile;
  }

  setCurrentMetaTagFile(metaTagFileName) {
    this.currentMetaTagFile = metaTagFileName;
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
        metaTagFile: this.currentMetaTagFile,
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
        // メタタグファイル名を更新
        if (result.metaTagFileName) {
          this.currentMetaTagFile = result.metaTagFileName;
        }
        await window.electronAPI.showMessage({ message: 'プロジェクトを保存しました' });
        return { success: true, path: result.path, schemaFileName: result.schemaFileName, metaTagFileName: result.metaTagFileName };
      } else {
        const errorMessage = result.error || '不明なエラー';
        await window.electronAPI.showMessage({ type: 'error', message: 'プロジェクトの保存に失敗しました', detail: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('保存エラー:', error);
      await window.electronAPI.showMessage({ type: 'error', message: 'プロジェクトの保存に失敗しました', detail: error.message });
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
        this.currentMetaTagFile = result.data.metaTagFile || 'meta-tag-template.yaml';
        // バージョンチェック
        const version = result.data.version || '1.0.0';
        
        if (version === '1.0.0') {
          // 旧バージョンのプロジェクトを新形式に変換
          const convertedData = {
            version: '2.0.0',
            createdAt: result.data.createdAt,
            schemaFile: result.data.schemaFile || 'schema.yaml',
            metaTagFile: result.data.metaTagFile || 'meta-tag-template.yaml',
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
            metaTagFile: this.currentMetaTagFile,
            legacyParagraphs: result.data.paragraphs || []
          };
        }
        
        return {
          success: true,
          data: result.data,
          path: result.path,
          schemaFile: this.currentSchemaFile,
          metaTagFile: this.currentMetaTagFile
        };
      }
      return { success: false, cancelled: result.cancelled };
    } catch (error) {
      console.error('読み込みエラー:', error);
      await window.electronAPI.showMessage({ type: 'error', message: '読み込みに失敗しました', detail: error.message });
      return { success: false, error: error.message };
    }
  }

  async exportCSV(paragraphs, blockTypeManager) {
    try {
      // CSVデータを生成
      const csvData = this.generateCSV(paragraphs, blockTypeManager);

      const result = await window.electronAPI.exportCSV(csvData);

      if (result.success) {
        await window.electronAPI.showMessage({ message: 'CSVファイルをエクスポートしました' });
        return { success: true };
      } else {
        // キャンセルの場合は何もしない
        if (result.cancelled) {
          return { success: false, cancelled: true };
        }
        const errorMessage = result.error || '不明なエラー';
        await window.electronAPI.showMessage({ type: 'error', message: 'CSVエクスポートに失敗しました', detail: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      await window.electronAPI.showMessage({ type: 'error', message: 'CSVエクスポートに失敗しました', detail: error.message });
      return { success: false, error: error.message };
    }
  }

  async exportAllScenesAsCSV(projectPath, scenes, blockTypes, structs, enums) {
    try {
      const result = await window.electronAPI.exportAllScenesAsCSV(projectPath, scenes, blockTypes, structs, enums);

      if (result.success) {
        await window.electronAPI.showMessage({ message: '全シーンのCSVエクスポートが完了しました。', detail: `出力先: ${result.outputDir}\n作成されたファイル数: ${result.fileCount}` });
        return { success: true };
      } else {
        // キャンセルの場合は何もしない（全シーンエクスポートはファイルダイアログを使わないため通常は発生しない）
        if (result.cancelled) {
          return { success: false, cancelled: true };
        }
        const errorMessage = result.error || '不明なエラー';
        await window.electronAPI.showMessage({ type: 'error', message: 'CSVエクスポートに失敗しました', detail: errorMessage });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('全シーンエクスポートエラー:', error);
      await window.electronAPI.showMessage({ type: 'error', message: 'CSVエクスポートに失敗しました', detail: error.message });
      return { success: false, error: error.message };
    }
  }

  generateCSV(paragraphs, blockTypeManager) {
    // 最大のArg数を計算
    let maxArgs = 0;
    paragraphs.forEach(paragraph => {
      const blockType = blockTypeManager.getBlockType(paragraph.type);
      let argCount = 0;

      // テキストがある場合は+1
      if (blockType && blockType.requires_text) {
        argCount += 1;
      }

      // パラメータ数を追加
      if (blockType && blockType.parameters) {
        argCount += Object.keys(blockType.parameters).length;
      }

      maxArgs = Math.max(maxArgs, argCount);
    });

    // ヘッダー行を生成
    const headers = ['ID', 'Type', 'Tag'];
    for (let i = 1; i <= maxArgs; i++) {
      headers.push(`Arg${i}`);
    }

    // CSV行を生成
    const rows = [headers];

    paragraphs.forEach(paragraph => {
      const row = [];
      const blockType = blockTypeManager.getBlockType(paragraph.type);

      // ID
      row.push(escapeCSV(paragraph.id.toString()));

      // Type
      row.push(escapeCSV(paragraph.type));

      // Tag
      row.push(escapeCSV(paragraph.tags.join(',')));

      // Args（テキスト + パラメータ）を順番に追加

      // テキストがある場合は最初のArgとして追加
      if (blockType && blockType.requires_text) {
        row.push(escapeCSV(paragraph.text || ''));
      }

      // パラメータを追加
      if (blockType && blockType.parameters) {
        Object.keys(blockType.parameters).forEach(paramKey => {
          const paramDef = blockType.parameters[paramKey];
          const value = paragraph[paramKey] || '';

          // struct型の場合は特別な形式で出力
          if (paramDef.type && blockTypeManager.isValidStructType(paramDef.type)) {
            const structValue = this.formatStructForCSV(value, paramDef.type, blockTypeManager);
            row.push(escapeCSV(structValue));
          } else {
            row.push(escapeCSV(value.toString()));
          }
        });
      }

      rows.push(row);
    });

    // CSV文字列に変換
    return rowsToCSV(rows);
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