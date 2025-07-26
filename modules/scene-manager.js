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

  // ファイル名に使える文字に変換
  sanitizeFileName(name) {
    // 特殊文字を削除または置換してファイル名に安全な文字列にする
    return name
      .replace(/[<>:"/\\|?*]/g, '_') // ファイル名に使えない文字を_に置換
      .replace(/\s+/g, '_') // 空白文字を_に置換
      .replace(/[._]+$/g, '') // 末尾のドットやアンダースコアを削除
      .substring(0, 100) // 長すぎる場合は100文字に制限
      || 'untitled'; // 空文字の場合はuntitled
  }

  createScene(name = 'New scene') {
    const sceneId = this.generateSceneId();
    const sanitizedName = this.sanitizeFileName(name);
    const scene = {
      id: sceneId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exists: true,
      metadata: '',
      paragraphs: [],
      _fileName: `${sanitizedName}.json` // 内部使用のみ
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
      const oldFileName = scene._fileName;
      scene._fileName = `${this.sanitizeFileName(newName)}.json`;
      scene.updatedAt = new Date().toISOString();
      
      // ファイル名が変更された場合は、変更情報を返す
      return {
        success: true,
        oldFileName: oldFileName,
        newFileName: scene._fileName,
        fileNameChanged: oldFileName !== scene._fileName
      };
    }
    return { success: false };
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
    return Array.from(this.scenes.values()).map(scene => {
      // ファイル名から拡張子を除いた部分を名前として使用
      const name = scene._fileName ? scene._fileName.replace(/\.json$/, '') : 'Untitled';
      return {
        ...scene,
        name: name
      };
    });
  }

  getSceneName(sceneId) {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;
    // ファイル名から拡張子を除いた部分を名前として返す
    return scene._fileName ? scene._fileName.replace(/\.json$/, '') : 'Untitled';
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

  updateSceneMetadata(sceneId, metadata) {
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.metadata = metadata;
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
    return `${projectDir}_scenes/${scene._fileName}`;
  }

  // プロジェクトファイル用のシーンリストを生成（互換性のため残す）
  getSceneListForProject() {
    return Array.from(this.scenes.values()).map(scene => ({
      id: scene.id,
      fileName: scene._fileName
    }));
  }

  // scenesディレクトリから読み込んだシーンリストを設定
  loadScenesFromDirectory(sceneList) {
    this.scenes.clear();
    this.currentSceneId = null;
    
    if (!sceneList || !Array.isArray(sceneList)) return;
    
    sceneList.forEach(sceneInfo => {
      const scene = {
        id: sceneInfo.id,
        _fileName: sceneInfo.fileName,
        createdAt: sceneInfo.createdAt || new Date().toISOString(),
        updatedAt: sceneInfo.updatedAt || new Date().toISOString(),
        exists: true, // ディレクトリから読み込んだファイルは存在する
        metadata: sceneInfo.metadata || '',
        paragraphs: sceneInfo.paragraphs || undefined // 実際のデータがある場合のみ設定
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