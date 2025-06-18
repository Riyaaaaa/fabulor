const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (projectData, currentPath) => ipcRenderer.invoke('save-project', projectData, currentPath),
  openProject: () => ipcRenderer.invoke('open-project'),
  exportCSV: (csvData) => ipcRenderer.invoke('export-csv', csvData),
  loadSchemaFile: (projectPath, schemaFileName) => ipcRenderer.invoke('load-schema-file', projectPath, schemaFileName),
  loadCharactersFile: (projectPath, charactersFileName) => ipcRenderer.invoke('load-characters-file', projectPath, charactersFileName),
  saveScene: (projectPath, sceneId, sceneData) => ipcRenderer.invoke('save-scene', projectPath, sceneId, sceneData),
  loadScene: (projectPath, sceneFileName) => ipcRenderer.invoke('load-scene', projectPath, sceneFileName),
  checkSceneExists: (projectPath, sceneFileName) => ipcRenderer.invoke('check-scene-exists', projectPath, sceneFileName),
  saveNewScene: (projectPath) => ipcRenderer.invoke('save-new-scene', projectPath)
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');
});