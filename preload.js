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
  saveNewScene: (projectPath) => ipcRenderer.invoke('save-new-scene', projectPath),
  importTextFile: () => ipcRenderer.invoke('import-text-file'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  openRecentProject: (projectPath) => ipcRenderer.invoke('open-recent-project', projectPath),
  exportAllScenesAsCSV: (projectPath, scenes, blockTypeManager) => ipcRenderer.invoke('export-all-scenes-as-csv', projectPath, scenes, blockTypeManager)
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');
});