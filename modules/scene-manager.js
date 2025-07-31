// シーン管理モジュール
class SceneManager {
  constructor() {
    this.scenes = new Map(); // ファイル名 -> シーン情報
    this.currentSceneFileName = null;
    this.projectPath = null;
  }

  generateUniqueFileName(baseName) {
    // タイムスタンプとランダム文字列を追加してユニークなファイル名を生成
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    return `${baseName}_${timestamp}_${random}.json`;
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
    const sanitizedName = this.sanitizeFileName(name);
    let fileName = `${sanitizedName}.json`;
    
    // 同じファイル名が既に存在する場合はユニークなファイル名を生成
    if (this.scenes.has(fileName)) {
      fileName = this.generateUniqueFileName(sanitizedName);
    }
    
    const scene = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      exists: true,
      metadata: '',
      paragraphs: [],
      _fileName: fileName
    };
    
    this.scenes.set(fileName, scene);
    return scene;
  }

  deleteScene(fileName) {
    if (this.scenes.has(fileName)) {
      this.scenes.delete(fileName);
      if (this.currentSceneFileName === fileName) {
        this.currentSceneFileName = null;
      }
      return true;
    }
    return false;
  }

  renameScene(oldFileName, newName) {
    const scene = this.scenes.get(oldFileName);
    if (scene) {
      const sanitizedName = this.sanitizeFileName(newName);
      const newFileName = `${sanitizedName}.json`;
      
      // 同じファイル名が既に存在する場合はユニークなファイル名を生成
      if (this.scenes.has(newFileName) && newFileName !== oldFileName) {
        return {
          success: false,
          error: '同じ名前のシーンが既に存在します'
        };
      }
      
      scene._fileName = newFileName;
      scene.updatedAt = new Date().toISOString();
      
      // Map内のキーも更新
      this.scenes.delete(oldFileName);
      this.scenes.set(newFileName, scene);
      
      // 現在のシーンの場合は更新
      if (this.currentSceneFileName === oldFileName) {
        this.currentSceneFileName = newFileName;
      }
      
      return {
        success: true,
        oldFileName: oldFileName,
        newFileName: newFileName,
        fileNameChanged: oldFileName !== newFileName
      };
    }
    return { success: false };
  }

  selectScene(fileName) {
    if (this.scenes.has(fileName)) {
      this.currentSceneFileName = fileName;
      return this.scenes.get(fileName);
    }
    return null;
  }

  getCurrentScene() {
    if (this.currentSceneFileName) {
      return this.scenes.get(this.currentSceneFileName);
    }
    return null;
  }

  getCurrentSceneFileName() {
    return this.currentSceneFileName;
  }

  getScenes() {
    const result = Array.from(this.scenes.entries()).map(([fileName, scene]) => {
      // ファイル名から拡張子を除いた部分を名前として使用
      const name = fileName.replace(/\.json$/, '');
      const sceneWithName = {
        ...scene,
        name: name,
        fileName: fileName // UIで必要なため追加
      };
      return sceneWithName;
    });
    return result;
  }

  getSceneName(fileName) {
    if (!this.scenes.has(fileName)) return null;
    // ファイル名から拡張子を除いた部分を名前として返す
    return fileName.replace(/\.json$/, '');
  }

  updateSceneParagraphs(fileName, paragraphs) {
    const scene = this.scenes.get(fileName);
    if (scene) {
      scene.paragraphs = paragraphs;
      scene.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  updateSceneMetadata(fileName, metadata) {
    const scene = this.scenes.get(fileName);
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

  getSceneFilePath(fileName) {
    if (!this.projectPath) return null;
    if (!this.scenes.has(fileName)) return null;
    
    const projectDir = this.projectPath.replace(/\.[^/.]+$/, ''); // 拡張子を除去
    return `${projectDir}_scenes/${fileName}`;
  }

  // プロジェクトファイル用のシーンリストを生成
  getSceneListForProject() {
    return Array.from(this.scenes.keys()).map(fileName => ({
      fileName: fileName
    }));
  }

  // scenesディレクトリから読み込んだシーンリストを設定
  loadScenesFromDirectory(sceneList) {
    this.scenes.clear();
    this.currentSceneFileName = null;
    
    if (!sceneList || !Array.isArray(sceneList)) return;
    
    
    sceneList.forEach(sceneInfo => {
      const scene = {
        _fileName: sceneInfo.fileName,
        createdAt: sceneInfo.createdAt || new Date().toISOString(),
        updatedAt: sceneInfo.updatedAt || new Date().toISOString(),
        exists: true, // ディレクトリから読み込んだファイルは存在する
        metadata: sceneInfo.metadata || '',
        paragraphs: sceneInfo.paragraphs || undefined // 実際のデータがある場合のみ設定
      };
      
      this.scenes.set(sceneInfo.fileName, scene);
    });
    
  }

  markSceneAsExisting(fileName, exists) {
    const scene = this.scenes.get(fileName);
    if (scene) {
      scene.exists = exists;
    }
  }

  clearScenes() {
    this.scenes.clear();
    this.currentSceneFileName = null;
  }
}

export { SceneManager };