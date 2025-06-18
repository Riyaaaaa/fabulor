// プロジェクト管理モジュール
class ProjectManager {
  constructor() {
    this.projectPath = null;
    this.hasUnsavedChanges = false;
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

  async newProject() {
    this.projectPath = null;
    this.hasUnsavedChanges = false;
    return true;
  }

  async saveProject(paragraphs) {
    try {
      const projectData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        schemaFile: 'block-types.yaml',
        paragraphs: paragraphs
      };
      
      const result = await window.electronAPI.saveProject(projectData, this.projectPath);
      
      if (result.success) {
        this.projectPath = result.path;
        this.hasUnsavedChanges = false;
        alert('プロジェクトを保存しました');
        return { success: true, path: result.path };
      }
      return { success: false };
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
      return { success: false, error: error.message };
    }
  }

  async openProject() {
    try {
      const result = await window.electronAPI.openProject();
      
      if (result.success) {
        this.projectPath = result.path;
        this.hasUnsavedChanges = false;
        return {
          success: true,
          data: result.data,
          path: result.path,
          schemaFile: result.data.schemaFile || 'schema.yaml'
        };
      }
      return { success: false };
    } catch (error) {
      console.error('読み込みエラー:', error);
      alert(`読み込みに失敗しました\n\nエラー内容: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async exportJSON(paragraphs) {
    try {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        paragraphs: paragraphs.map(p => ({
          id: p.id,
          text: p.text,
          speaker: p.speaker,
          tags: p.tags
        }))
      };
      
      const result = await window.electronAPI.exportJSON(exportData);
      
      if (result.success) {
        alert('JSONファイルをエクスポートしました');
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('エクスポートに失敗しました');
      return { success: false, error: error.message };
    }
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