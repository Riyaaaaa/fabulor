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
  scanScenesDirectory: (projectPath) => ipcRenderer.invoke('scan-scenes-directory', projectPath),
  renameSceneFile: (projectPath, sceneId, oldFileName, newFileName) => ipcRenderer.invoke('rename-scene-file', projectPath, sceneId, oldFileName, newFileName),
  deleteSceneFile: (projectPath, fileName) => ipcRenderer.invoke('delete-scene-file', projectPath, fileName),
  saveNewScene: (projectPath) => ipcRenderer.invoke('save-new-scene', projectPath),
  importTextFile: () => ipcRenderer.invoke('import-text-file'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  openRecentProject: (projectPath) => ipcRenderer.invoke('open-recent-project', projectPath),
  exportAllScenesAsCSV: (projectPath, scenes, blockTypes) => ipcRenderer.invoke('export-all-scenes-as-csv', projectPath, scenes, blockTypes),
  exportText: (textContent, format) => ipcRenderer.invoke('export-text', textContent, format),
  exportAllScenesAsText: (projectPath, sceneTexts, format) => ipcRenderer.invoke('export-all-scenes-as-text', projectPath, sceneTexts, format),
  loadYamlFile: (yamlPath) => ipcRenderer.invoke('load-yaml-file', yamlPath),
  scanMigrationDirectory: (projectPath) => ipcRenderer.invoke('scan-migration-directory', projectPath),
  executeMigration: (projectPath, migrationFileName, blocks) => ipcRenderer.invoke('execute-migration', projectPath, migrationFileName, blocks)
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');
});