const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');

let mainWindow;
let recentProjects = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
  
  // ウィンドウを閉じる前の確認
  mainWindow.on('close', (event) => {
    event.preventDefault(); // 一旦閉じることを防ぐ
    
    // 非同期で変更状態をチェック
    checkUnsavedChangesAndClose();
  });
  
  async function checkUnsavedChangesAndClose() {
    try {
      // レンダラープロセスに変更があるかチェック
      const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            return window.projectManager ? window.projectManager.hasChanges() : false;
          } catch(e) {
            return false;
          }
        })();
      `);
      
      if (hasUnsavedChanges) {
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['保存して終了', '保存しないで終了', 'キャンセル'],
          defaultId: 0,
          title: '未保存の変更',
          message: '保存されていない変更があります。',
          detail: 'プロジェクトを保存してから終了しますか？'
        });
        
        if (choice === 0) {
          // 保存して終了
          try {
            await mainWindow.webContents.executeJavaScript(`
              (function() {
                if (window.scenarioManager && window.scenarioManager.saveProject) {
                  return window.scenarioManager.saveProject();
                }
                return Promise.resolve();
              })();
            `);
            // 保存が完了したら終了
            mainWindow.destroy();
          } catch (error) {
            console.error('保存エラー:', error);
            // 保存に失敗した場合も終了するかユーザーに確認
            const forceExit = dialog.showMessageBoxSync(mainWindow, {
              type: 'error',
              buttons: ['強制終了', 'キャンセル'],
              defaultId: 1,
              title: '保存エラー',
              message: 'プロジェクトの保存に失敗しました。',
              detail: 'それでも終了しますか？'
            });
            
            if (forceExit === 0) {
              mainWindow.destroy();
            }
          }
        } else if (choice === 1) {
          // 保存しないで終了
          mainWindow.destroy();
        }
        // choice === 2 (キャンセル) の場合は何もしない（ウィンドウは開いたまま）
      } else {
        // 変更がない場合は通常通り終了
        mainWindow.destroy();
      }
    } catch (error) {
      console.error('終了時のチェックエラー:', error);
      // エラーが発生した場合は通常通り終了
      mainWindow.destroy();
    }
  }
}

// 最近のプロジェクトを保存・読み込み
async function loadRecentProjects() {
  try {
    const userDataPath = app.getPath('userData');
    const recentPath = path.join(userDataPath, 'recent-projects.json');
    const data = await fs.readFile(recentPath, 'utf8');
    recentProjects = JSON.parse(data);
    // 存在しないファイルを除外
    const validProjects = [];
    for (const project of recentProjects) {
      try {
        await fs.access(project.path);
        validProjects.push(project);
      } catch {
        // ファイルが存在しない場合は除外
      }
    }
    recentProjects = validProjects.slice(0, 10); // 最大10件
  } catch {
    recentProjects = [];
  }
}

async function saveRecentProjects() {
  try {
    const userDataPath = app.getPath('userData');
    const recentPath = path.join(userDataPath, 'recent-projects.json');
    await fs.writeFile(recentPath, JSON.stringify(recentProjects, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save recent projects:', error);
  }
}

function addRecentProject(projectPath, projectName) {
  // 既存のエントリを削除
  recentProjects = recentProjects.filter(p => p.path !== projectPath);
  // 先頭に追加
  recentProjects.unshift({
    path: projectPath,
    name: projectName,
    lastOpened: new Date().toISOString()
  });
  // 最大10件に制限
  recentProjects = recentProjects.slice(0, 10);
  // 保存
  saveRecentProjects();
}


ipcMain.handle('save-project', async (event, projectData, currentPath) => {
  try {
    let filePath = currentPath;
    
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'プロジェクトを保存',
        defaultPath: 'New project.fbl',
        filters: [
          { name: 'Fabulor Project', extensions: ['fbl'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled) {
        return { success: false, cancelled: true };
      }
      
      filePath = result.filePath;
    }
    
    await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf8');
    
    // プロジェクト名に基づいてスキーマファイルを作成
    const projectName = path.basename(filePath, '.fbl');
    
    // 最近のプロジェクトに追加
    addRecentProject(filePath, projectName);
    const projectDir = path.dirname(filePath);
    const schemaFileName = `${projectName}_schema.yaml`;
    const schemaPath = path.join(projectDir, schemaFileName);
    
    // schema-template.yamlの内容を読み込んでコピー
    let schemaContent;
    try {
      const templatePath = path.join(__dirname, 'schema-template.yaml');
      schemaContent = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      console.warn('schema-template.yamlが見つかりません。デフォルトの内容を使用します:', error);
      // テンプレートが見つからない場合のフォールバック
      schemaContent = `# ブロックタイプ定義ファイル
# このファイルでカスタムブロックタイプを定義できます
# 注意: 「dialogue（セリフ）」と「narrative（地の文）」は標準定義として常に含まれます

block_types:
  # カスタムブロックタイプをここに定義してください
`;
    }

    
    // スキーマファイルが存在しない場合のみ作成
    try {
      await fs.access(schemaPath);
    } catch {
      await fs.writeFile(schemaPath, schemaContent, 'utf8');
    }

    
    return { success: true, path: filePath, schemaFileName: schemaFileName };
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-project', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'プロジェクトを開く',
      filters: [
        { name: 'Fabulor Project', extensions: ['fbl'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }
    
    const filePath = result.filePaths[0];
    const fileContent = await fs.readFile(filePath, 'utf8');
    const projectData = JSON.parse(fileContent);
    
    // 最近のプロジェクトに追加
    const projectName = path.basename(filePath, '.fbl');
    addRecentProject(filePath, projectName);
    
    return { success: true, data: projectData, path: filePath };
  } catch (error) {
    console.error('Open error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-csv', async (event, csvData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'CSVエクスポート',
      defaultPath: 'シナリオ_export.csv',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, cancelled: true };
    }
    
    await fs.writeFile(result.filePath, csvData, 'utf8');
    
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('Export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-schema-file', async (event, projectPath, schemaFileName) => {
  try {
    const projectDir = path.dirname(projectPath);
    const schemaPath = path.join(projectDir, schemaFileName);
    const yamlContent = await fs.readFile(schemaPath, 'utf8');
    const schemaData = yaml.load(yamlContent);
    
    return { success: true, data: schemaData };
  } catch (error) {
    console.error('Schema file load error:', error);
    return { success: false, error: error.message };
  }
});


ipcMain.handle('save-scene', async (event, projectPath, sceneId, sceneData) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenesDir = `${projectDir}_scenes`;
    
    // scenesディレクトリが存在しない場合は作成
    try {
      await fs.access(scenesDir);
    } catch {
      await fs.mkdir(scenesDir, { recursive: true });
    }
    
    // sceneDataにfileNameが含まれている場合はそれを使用
    const fileName = sceneData.fileName || `${sceneId}.json`;
    const scenePath = path.join(scenesDir, fileName);
    await fs.writeFile(scenePath, JSON.stringify(sceneData, null, 2), 'utf8');
    
    return { success: true, path: scenePath };
  } catch (error) {
    console.error('Scene save error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-scene', async (event, projectPath, sceneFileName) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenePath = path.join(`${projectDir}_scenes`, sceneFileName);
    
    const sceneContent = await fs.readFile(scenePath, 'utf8');
    const sceneData = JSON.parse(sceneContent);
    
    return { success: true, data: sceneData };
  } catch (error) {
    console.error('Scene load error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-scene-exists', async (event, projectPath, sceneFileName) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenePath = path.join(`${projectDir}_scenes`, sceneFileName);
    
    await fs.access(scenePath);
    return { exists: true };
  } catch {
    return { exists: false };
  }
});

// scenesディレクトリ内のすべてのシーンファイルを取得
ipcMain.handle('scan-scenes-directory', async (event, projectPath) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenesDir = `${projectDir}_scenes`;
    
    // ディレクトリが存在するか確認
    try {
      await fs.access(scenesDir);
    } catch {
      // ディレクトリが存在しない場合は空の配列を返す
      return { success: true, scenes: [] };
    }
    
    // ディレクトリ内のファイル一覧を取得
    const files = await fs.readdir(scenesDir);
    
    // JSONファイルのみをフィルタリングして、各ファイルの内容を読み取る
    const scenes = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(scenesDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const sceneData = JSON.parse(content);
          
          // シーンデータにファイル名を追加
          scenes.push({
            id: sceneData.id,
            name: sceneData.name,
            fileName: file,
            createdAt: sceneData.createdAt,
            updatedAt: sceneData.updatedAt
          });
        } catch (error) {
          console.error(`Failed to read scene file ${file}:`, error);
          // エラーが発生したファイルはスキップ
        }
      }
    }
    
    return { success: true, scenes: scenes };
  } catch (error) {
    console.error('Scan scenes directory error:', error);
    return { success: false, error: error.message, scenes: [] };
  }
});

ipcMain.handle('rename-scene-file', async (event, projectPath, sceneId, oldFileName, newFileName) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenesDir = `${projectDir}_scenes`;
    
    const oldPath = path.join(scenesDir, oldFileName);
    const newPath = path.join(scenesDir, newFileName);
    
    // 旧ファイルが存在する場合のみリネーム
    try {
      await fs.access(oldPath);
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error) {
      // ファイルが存在しない場合は成功とみなす（まだ保存されていない新規シーン）
      if (error.code === 'ENOENT') {
        return { success: true };
      }
      throw error;
    }
  } catch (error) {
    console.error('Scene file rename error:', error);
    return { success: false, error: error.message };
  }
});

// シーンファイルを削除
ipcMain.handle('delete-scene-file', async (event, projectPath, fileName) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenePath = path.join(`${projectDir}_scenes`, fileName);
    
    // ファイルが存在する場合は削除
    try {
      await fs.access(scenePath);
      await fs.unlink(scenePath);
      return { success: true };
    } catch (error) {
      // ファイルが存在しない場合も成功とみなす
      if (error.code === 'ENOENT') {
        return { success: true };
      }
      throw error;
    }
  } catch (error) {
    console.error('Scene file delete error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-new-scene', async (event, projectPath) => {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenesDir = `${projectDir}_scenes`;
    
    // scenesディレクトリが存在しない場合は作成
    try {
      await fs.access(scenesDir);
    } catch {
      await fs.mkdir(scenesDir, { recursive: true });
    }
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '新規シーンを作成',
      defaultPath: path.join(scenesDir, 'New scene.json'),
      filters: [
        { name: 'Scene Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false };
    }
    
    // ファイル名からシーン名を抽出（拡張子を除去）
    const fileName = path.basename(result.filePath);
    const sceneName = fileName.replace(/\.json$/, '');
    
    return { 
      success: true, 
      path: result.filePath,
      sceneName: sceneName,
      fileName: fileName
    };
  } catch (error) {
    console.error('Save new scene error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-text-file', async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'テキストファイルをインポート',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }
    
    const filePath = result.filePaths[0];
    const textContent = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    return { 
      success: true, 
      content: textContent,
      fileName: fileName
    };
  } catch (error) {
    console.error('Import text file error:', error);
    return { success: false, error: error.message };
  }
});

// 最近のプロジェクト一覧を取得
ipcMain.handle('get-recent-projects', async () => {
  return recentProjects;
});

// 最近のプロジェクトを開く
ipcMain.handle('open-recent-project', async (event, projectPath) => {
  try {
    const fileContent = await fs.readFile(projectPath, 'utf8');
    const projectData = JSON.parse(fileContent);
    
    // 最近のプロジェクトに追加（最終アクセス日時を更新）
    const projectName = path.basename(projectPath, '.fbl');
    addRecentProject(projectPath, projectName);
    
    return { success: true, data: projectData, path: projectPath };
  } catch (error) {
    console.error('Open recent project error:', error);
    return { success: false, error: error.message };
  }
});

// 全シーンをCSVとしてエクスポート
ipcMain.handle('export-all-scenes-as-csv', async (event, projectPath, scenes, blockTypes, structs, enums) => {
  try {
    // プロジェクトファイルと同じ階層にoutputディレクトリを作成
    const projectDir = path.dirname(projectPath);
    const outputDir = path.join(projectDir, 'output');
    
    // outputディレクトリが存在しない場合は作成
    try {
      await fs.access(outputDir);
    } catch {
      await fs.mkdir(outputDir, { recursive: true });
    }
    
    let fileCount = 0;
    
    // 各シーンをCSVファイルとして保存
    for (const scene of scenes) {
      try {
        // シーンデータを読み込み
        let sceneParagraphs = [];
        if (scene.exists) {
          const sceneResult = await loadSceneData(projectPath, scene.fileName);
          if (sceneResult.success) {
            sceneParagraphs = sceneResult.data.paragraphs || [];
          }
        } else if (scene.paragraphs) {
          sceneParagraphs = scene.paragraphs;
        }
        
        if (sceneParagraphs.length === 0) {
          console.log(`シーン "${scene.name}" は空のためスキップしました`);
          continue;
        }
        
        // CSVデータを生成
        const csvData = generateCSVData(sceneParagraphs, blockTypes, structs, enums);
        
        // ファイル名を作成（シーン名から危険な文字を除去）
        const safeSceneName = scene.name.replace(/[<>:"/\\|?*]/g, '_');
        const csvFileName = `${safeSceneName}.csv`;
        const csvFilePath = path.join(outputDir, csvFileName);
        
        // CSVファイルを保存
        await fs.writeFile(csvFilePath, csvData, 'utf8');
        fileCount++;
        
      } catch (error) {
        console.error(`シーン "${scene.name}" のエクスポート中にエラー:`, error);
        // 個別のシーンのエラーは続行して他のシーンを処理
      }
    }
    
    return { 
      success: true, 
      outputDir: outputDir,
      fileCount: fileCount
    };
  } catch (error) {
    console.error('Export all scenes error:', error);
    return { success: false, error: error.message };
  }
});

// シーンデータを読み込むヘルパー関数
async function loadSceneData(projectPath, sceneFileName) {
  try {
    const projectDir = projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    const scenePath = path.join(`${projectDir}_scenes`, sceneFileName);
    
    const sceneContent = await fs.readFile(scenePath, 'utf8');
    const sceneData = JSON.parse(sceneContent);
    
    return { success: true, data: sceneData };
  } catch (error) {
    console.error('Scene load error:', error);
    return { success: false, error: error.message };
  }
}

// CSVデータを生成するヘルパー関数
function generateCSVData(paragraphs, blockTypes, structs, enums) {
  // ブロックタイプを取得するヘルパー関数
  function getBlockType(typeName) {
    return blockTypes[typeName] || null;
  }
  
  // 最大のArg数を計算
  let maxArgs = 0;
  paragraphs.forEach(paragraph => {
    const blockType = getBlockType(paragraph.type);
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

  // データ行を生成
  const rows = [headers];
  paragraphs.forEach(paragraph => {
    const row = [];
    
    // ID
    row.push(escapeCSVValue(paragraph.id ? paragraph.id.toString() : ''));
    
    // Type
    row.push(escapeCSVValue(paragraph.type || ''));
    
    // Tag
    const tags = Array.isArray(paragraph.tags) ? paragraph.tags.join(',') : '';
    row.push(escapeCSVValue(tags));
    
    // Args（テキスト + パラメータ）を順番に追加
    const blockType = getBlockType(paragraph.type);
    
    // テキストがある場合は最初のArgとして追加
    if (blockType && blockType.requires_text) {
      row.push(escapeCSVValue(paragraph.text || ''));
    }
    
    // パラメータを追加
    if (blockType && blockType.parameters) {
      const paramKeys = Object.keys(blockType.parameters);
      paramKeys.forEach(paramKey => {
        const paramDef = blockType.parameters[paramKey];
        const value = paragraph[paramKey] || '';
        
        // struct型の場合は特別な形式で出力
        if (paramDef.type && isValidStructType(paramDef.type, structs)) {
          const structValue = formatStructForCSV(value, paramDef.type, structs);
          row.push(escapeCSVValue(structValue));
        } else {
          row.push(escapeCSVValue(value));
        }
      });
    }
    
    // 残りの列を空文字で埋めない（行ごとに必要な列数のみ出力）
    // 注意: これはCSV標準からは逸脱するが、差分を最小化するため
    
    rows.push(row);
  });

  // CSV文字列に変換
  return rows.map(row => row.join(',')).join('\n');
}

// struct型の検証ヘルパー関数
function isValidStructType(typeName, structs) {
  // structs定義から構造体を探す
  if (structs && structs[typeName]) {
    return true;
  }
  return false;
}

// struct型の値をCSV用の文字列形式に変換
function formatStructForCSV(structValue, structType, structs) {
  if (!structValue || typeof structValue !== 'object') {
    return '';
  }
  
  const structDef = structs && structs[structType];
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

// CSV値をエスケープするヘルパー関数
function escapeCSVValue(value) {
  if (value == null) {
    return '';
  }
  
  let stringValue = String(value);
  
  // 末尾の改行や空行を除去
  stringValue = stringValue.replace(/[\n\r\s]*$/, '');
  
  // 改行文字をエスケープ
  stringValue = stringValue.replace(/\r\n/g, '\\r\\n');
  stringValue = stringValue.replace(/\n/g, '\\n');
  stringValue = stringValue.replace(/\r/g, '\\r');
  
  // カンマまたはダブルクォートが含まれている場合はダブルクォートで囲む
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // 内部のダブルクォートをエスケープ
    stringValue = stringValue.replace(/"/g, '""');
    stringValue = `"${stringValue}"`;
  }
  
  return stringValue;
}

ipcMain.handle('export-text', async (event, textContent, format) => {
  try {
    const formatLabel = format === 'novel' ? '小説' : '台本';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: `テキストエクスポート (${formatLabel}形式)`,
      defaultPath: `シナリオ_${formatLabel}.txt`,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, cancelled: true };
    }
    
    await fs.writeFile(result.filePath, textContent, 'utf8');
    
    return { success: true, path: result.filePath };
  } catch (error) {
    console.error('Text export error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-all-scenes-as-text', async (event, projectPath, sceneTexts, format) => {
  try {
    const projectDir = path.dirname(projectPath);
    const outputDir = path.join(projectDir, 'output');
    
    // outputディレクトリを作成（存在しない場合）
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      console.error('outputディレクトリ作成エラー:', error);
    }
    
    let successCount = 0;
    const formatSuffix = format === 'novel' ? 'novel' : 'script';
    
    for (const scene of sceneTexts) {
      try {
        // ファイル名をサニタイズ（無効な文字を除去）
        const sanitizedName = scene.name.replace(/[<>:"/\\|?*]/g, '_');
        const fileName = `${sanitizedName}_${formatSuffix}.txt`;
        const filePath = path.join(outputDir, fileName);
        
        await fs.writeFile(filePath, scene.content, 'utf8');
        successCount++;
        
        console.log(`テキストエクスポート完了: ${fileName}`);
      } catch (error) {
        console.error(`シーン \"${scene.name}\" のエクスポート中にエラー:`, error);
      }
    }
    
    return {
      success: true,
      outputDir: outputDir,
      fileCount: successCount
    };
  } catch (error) {
    console.error('全シーンテキストエクスポートエラー:', error);
    return { success: false, error: error.message };
  }
});

// マイグレーションディレクトリスキャンハンドラー
ipcMain.handle('scan-migration-directory', async (event, projectPath) => {
  try {
    const projectDir = path.dirname(projectPath);
    const migrationDir = path.join(projectDir, 'migration');
    
    console.log('マイグレーションディレクトリスキャン:', migrationDir);
    
    // migrationディレクトリの存在確認
    try {
      await fs.access(migrationDir);
    } catch (error) {
      return { success: false, error: 'migrationディレクトリが見つかりません' };
    }
    
    // .jsファイルを検索
    const files = await fs.readdir(migrationDir);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    
    const migrations = [];
    
    for (const file of jsFiles) {
      try {
        const filePath = path.join(migrationDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        
        // ファイル内容から名前と説明を抽出（コメント形式）
        const nameMatch = content.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
        const descMatch = content.match(/\/\*\s*@description\s+(.+?)\s*\*\//);
        
        migrations.push({
          fileName: file,
          name: nameMatch ? nameMatch[1] : file.replace('.js', ''),
          description: descMatch ? descMatch[1] : null,
          filePath: filePath
        });
      } catch (error) {
        console.error(`マイグレーションファイル読み込みエラー ${file}:`, error);
      }
    }
    
    return { success: true, migrations: migrations };
  } catch (error) {
    console.error('マイグレーションディレクトリスキャンエラー:', error);
    return { success: false, error: error.message };
  }
});

// マイグレーション実行ハンドラー
ipcMain.handle('execute-migration', async (event, projectPath, migrationFileName, blocks) => {
  try {
    const projectDir = path.dirname(projectPath);
    const migrationPath = path.join(projectDir, 'migration', migrationFileName);
    
    console.log('マイグレーション実行:', migrationPath);
    
    // ファイルの存在確認
    try {
      await fs.access(migrationPath);
    } catch (error) {
      return { success: false, error: `マイグレーションファイルが見つかりません: ${migrationFileName}` };
    }
    
    // マイグレーションスクリプトを動的に読み込み
    delete require.cache[require.resolve(migrationPath)]; // キャッシュをクリア
    const migrationModule = require(migrationPath);
    
    if (typeof migrationModule.migrate !== 'function') {
      return { success: false, error: 'マイグレーションファイルにmigrate関数が見つかりません' };
    }
    
    // 各ブロックにマイグレーションを適用
    const migratedBlocks = [];
    
    for (let i = 0; i < blocks.length; i++) {
      try {
        const result = migrationModule.migrate(blocks[i]);
        if (result) {
          migratedBlocks.push(result);
        } else {
          console.warn(`ブロック ${i} のマイグレーション結果がnullです`);
          migratedBlocks.push(blocks[i]); // 元のブロックを保持
        }
      } catch (error) {
        console.error(`ブロック ${i} のマイグレーション実行エラー:`, error);
        return { success: false, error: `ブロック ${i} の処理中にエラーが発生しました: ${error.message}` };
      }
    }
    
    return { success: true, migratedBlocks: migratedBlocks };
  } catch (error) {
    console.error('マイグレーション実行エラー:', error);
    return { success: false, error: error.message };
  }
});

// YAMLファイル読み込みハンドラー
ipcMain.handle('load-yaml-file', async (event, yamlPath) => {
  try {
    console.log('YAML読み込み開始:', yamlPath);
    
    // 相対パスの場合は絶対パスに変換
    let fullPath = yamlPath;
    if (!path.isAbsolute(yamlPath)) {
      fullPath = path.join(__dirname, yamlPath);
    }
    
    const yamlContent = await fs.readFile(fullPath, 'utf8');
    const data = yaml.load(yamlContent);
    
    console.log('YAML読み込み成功:', fullPath);
    return { success: true, data: data };
  } catch (error) {
    console.error('YAML読み込みエラー:', error);
    return { success: false, error: error.message };
  }
});

// アプリケーションイベント処理
app.whenReady().then(async () => {
  await loadRecentProjects();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// macOSでアプリケーション終了前の処理
app.on('before-quit', async (event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // レンダラープロセスに変更があるかチェック
    try {
      const hasUnsavedChanges = await mainWindow.webContents.executeJavaScript(`
        (function() {
          try {
            return window.projectManager ? window.projectManager.hasChanges() : false;
          } catch(e) {
            return false;
          }
        })();
      `);
      
      if (hasUnsavedChanges) {
        event.preventDefault(); // アプリケーション終了を一時停止
        
        const choice = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          buttons: ['保存して終了', '保存しないで終了', 'キャンセル'],
          defaultId: 0,
          title: '未保存の変更',
          message: '保存されていない変更があります。',
          detail: 'プロジェクトを保存してからアプリケーションを終了しますか？'
        });
        
        if (choice === 0) {
          // 保存して終了
          try {
            await mainWindow.webContents.executeJavaScript(`
              (function() {
                if (window.scenarioManager && window.scenarioManager.saveProject) {
                  return window.scenarioManager.saveProject();
                }
                return Promise.resolve();
              })();
            `);
            // 保存が完了したら終了
            app.quit();
          } catch (error) {
            console.error('保存エラー:', error);
            // 保存に失敗した場合も終了するかユーザーに確認
            const forceExit = dialog.showMessageBoxSync(mainWindow, {
              type: 'error',
              buttons: ['強制終了', 'キャンセル'],
              defaultId: 1,
              title: '保存エラー',
              message: 'プロジェクトの保存に失敗しました。',
              detail: 'それでもアプリケーションを終了しますか？'
            });
            
            if (forceExit === 0) {
              app.quit();
            }
          }
        } else if (choice === 1) {
          // 保存しないで終了
          app.quit();
        }
        // choice === 2 (キャンセル) の場合は何もしない
      }
    } catch (error) {
      console.error('終了時のチェックエラー:', error);
      // エラーが発生した場合は通常通り終了
    }
  }
});