// シーン管理モジュール
class SceneManager {
  constructor() {
    this.scenes = new Map(); // シーンID -> シーン情報
    this.currentSceneId = null;
    this.projectPath = null;
  }

  generateSceneId() {
    return 'scene_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  createScene(name = 'New scene') {
    const sceneId = this.generateSceneId();
    const scene = {
      id: sceneId,
      name: name,
      fileName: `${sceneId}.json`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exists: true,
      paragraphs: []
    };
    
    this.scenes.set(sceneId, scene);
    return scene;
  }

  deleteScene(sceneId) {
    if (this.scenes.has(sceneId)) {
      this.scenes.delete(sceneId);
      if (this.currentSceneId === sceneId) {
        this.currentSceneId = null;
      }
      return true;
    }
    return false;
  }

  renameScene(sceneId, newName) {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.name = newName;
      scene.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  selectScene(sceneId) {
    if (this.scenes.has(sceneId)) {
      this.currentSceneId = sceneId;
      return this.scenes.get(sceneId);
    }
    return null;
  }

  getCurrentScene() {
    if (this.currentSceneId) {
      return this.scenes.get(this.currentSceneId);
    }
    return null;
  }

  getCurrentSceneId() {
    return this.currentSceneId;
  }

  getScenes() {
    return Array.from(this.scenes.values());
  }

  updateSceneParagraphs(sceneId, paragraphs) {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.paragraphs = paragraphs;
      scene.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  setProjectPath(projectPath) {
    this.projectPath = projectPath;
  }

  getSceneFilePath(sceneId) {
    if (!this.projectPath) return null;
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;
    
    const projectDir = this.projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    return `${projectDir}_scenes/${scene.fileName}`;
  }

  // プロジェクトファイル用のシーンリストを生成
  getSceneListForProject() {
    return Array.from(this.scenes.values()).map(scene => ({
      id: scene.id,
      name: scene.name,
      fileName: scene.fileName
    }));
  }

  // プロジェクトファイルからシーンリストを復元
  loadScenesFromProject(sceneList) {
    this.scenes.clear();
    this.currentSceneId = null;
    
    if (!sceneList || !Array.isArray(sceneList)) return;
    
    sceneList.forEach(sceneInfo => {
      const scene = {
        id: sceneInfo.id,
        name: sceneInfo.name,
        fileName: sceneInfo.fileName,
        createdAt: sceneInfo.createdAt || new Date().toISOString(),
        updatedAt: sceneInfo.updatedAt || new Date().toISOString(),
        exists: false, // 実際のファイル存在は後でチェック
        paragraphs: []
      };
      
      this.scenes.set(scene.id, scene);
    });
  }

  markSceneAsExisting(sceneId, exists) {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.exists = exists;
    }
  }

  clearScenes() {
    this.scenes.clear();
    this.currentSceneId = null;
  }
}

export { SceneManager };