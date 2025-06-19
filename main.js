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
    
    // デフォルトのスキーマ内容
    const defaultSchemaContent = `# ブロックタイプ定義ファイル
# このファイルでカスタムブロックタイプを定義できます
# 注意: 「dialogue（セリフ）」と「narrative（地の文）」は標準定義として常に含まれます

block_types:
  # カスタムブロックタイプをここに定義してください
`;

    // デフォルトのキャラクター定義
    const defaultCharactersContent = `# キャラクター定義ファイル
# このファイルでキャラクターとその感情を定義できます

characters:
  # 例:
  # main_character:
  #   name: "主人公"
  #   emotions:
  #     - value: "normal"
  #       label: "通常"
  #     - value: "happy"
  #       label: "喜び"
  #     - value: "sad"
  #       label: "悲しみ"
`;
    
    // スキーマファイルが存在しない場合のみ作成
    try {
      await fs.access(schemaPath);
    } catch {
      await fs.writeFile(schemaPath, defaultSchemaContent, 'utf8');
    }

    // キャラクターファイルを作成
    const charactersFileName = `${projectName}_characters.yaml`;
    const charactersPath = path.join(projectDir, charactersFileName);
    
    try {
      await fs.access(charactersPath);
    } catch {
      await fs.writeFile(charactersPath, defaultCharactersContent, 'utf8');
    }
    
    return { success: true, path: filePath, schemaFileName: schemaFileName, charactersFileName: charactersFileName };
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

ipcMain.handle('load-characters-file', async (event, projectPath, charactersFileName) => {
  try {
    const projectDir = path.dirname(projectPath);
    const charactersPath = path.join(projectDir, charactersFileName);
    const yamlContent = await fs.readFile(charactersPath, 'utf8');
    const charactersData = yaml.load(yamlContent);
    
    return { success: true, data: charactersData };
  } catch (error) {
    console.error('Characters file load error:', error);
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
ipcMain.handle('export-all-scenes-as-csv', async (event, projectPath, scenes, blockTypes) => {
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
        const csvData = generateCSVData(sceneParagraphs, blockTypes);
        
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
function generateCSVData(paragraphs, blockTypes) {
  // ブロックタイプを取得するヘルパー関数
  function getBlockType(typeName) {
    return blockTypes[typeName] || null;
  }
  
  // 最大のArg数を計算
  let maxArgs = 0;
  paragraphs.forEach(paragraph => {
    const blockType = getBlockType(paragraph.type);
    let argCount = 0;
    
    if (blockType && blockType.parameters) {
      argCount += Object.keys(blockType.parameters).length;
    }
    
    if (blockType && blockType.requires_text) {
      argCount += 1;
    }
    
    maxArgs = Math.max(maxArgs, argCount);
  });

  // ヘッダー行を生成
  const headers = ['Type', 'Tag'];
  for (let i = 1; i <= maxArgs; i++) {
    headers.push(`Arg${i}`);
  }

  // データ行を生成
  const rows = [headers];
  paragraphs.forEach(paragraph => {
    const row = [];
    
    // Type
    row.push(escapeCSVValue(paragraph.type || ''));
    
    // Tag
    const tags = Array.isArray(paragraph.tags) ? paragraph.tags.join(',') : '';
    row.push(escapeCSVValue(tags));
    
    // Args
    const blockType = getBlockType(paragraph.type);
    let argIndex = 0;
    
    // パラメータを追加
    if (blockType && blockType.parameters) {
      const paramKeys = Object.keys(blockType.parameters);
      paramKeys.forEach(paramKey => {
        const value = paragraph[paramKey] || '';
        row.push(escapeCSVValue(value));
        argIndex++;
      });
    }
    
    // テキストを追加（requires_textがtrueの場合）
    if (blockType && blockType.requires_text) {
      row.push(escapeCSVValue(paragraph.text || ''));
      argIndex++;
    }
    
    // 残りの列を空文字で埋める
    while (argIndex < maxArgs) {
      row.push('');
      argIndex++;
    }
    
    rows.push(row);
  });

  // CSV文字列に変換
  return rows.map(row => row.join(',')).join('\n');
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