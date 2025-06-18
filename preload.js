const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (projectData, currentPath) => ipcRenderer.invoke('save-project', projectData, currentPath),
  openProject: () => ipcRenderer.invoke('open-project'),
  exportJSON: (exportData) => ipcRenderer.invoke('export-json', exportData),
  loadBlockTypes: () => ipcRenderer.invoke('load-block-types'),
  loadSchemaFile: (projectPath, schemaFileName) => ipcRenderer.invoke('load-schema-file', projectPath, schemaFileName)
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');
});