const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const yaml = require('js-yaml');

let mainWindow;

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
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('save-project', async (event, projectData, currentPath) => {
  try {
    let filePath = currentPath;
    
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'プロジェクトを保存',
        defaultPath: 'シナリオ.fbl',
        filters: [
          { name: 'Fabulor Project', extensions: ['fbl'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled) {
        return { success: false };
      }
      
      filePath = result.filePath;
    }
    
    await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf8');
    
    return { success: true, path: filePath };
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
      return { success: false };
    }
    
    const filePath = result.filePaths[0];
    const fileContent = await fs.readFile(filePath, 'utf8');
    const projectData = JSON.parse(fileContent);
    
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
      return { success: false };
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