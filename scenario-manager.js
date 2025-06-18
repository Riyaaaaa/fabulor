// メインのシナリオ管理クラス
import { BlockTypeManager } from './modules/block-types.js';
import { ProjectManager } from './modules/project-manager.js';
import { ParagraphManager } from './modules/paragraph-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { PreviewManager } from './modules/preview-manager.js';
import { SceneManager } from './modules/scene-manager.js';

class ScenarioManager {
  constructor() {
    this.blockTypeManager = new BlockTypeManager();
    this.projectManager = new ProjectManager();
    this.sceneManager = new SceneManager();
    this.paragraphManager = new ParagraphManager(this.blockTypeManager);
    this.uiManager = new UIManager(this.blockTypeManager, this.paragraphManager, this.projectManager);
    this.previewManager = new PreviewManager(this.paragraphManager, this.uiManager);
    
    this.initializeUI();
    this.bindEvents();
    this.updateTitle();
  }

  initializeUI() {
    this.uiManager.generateTypeUI();
    // 初期状態でデフォルトシーンを作成
    const defaultScene = this.sceneManager.createScene('メインシーン');
    this.sceneManager.selectScene(defaultScene.id);
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), defaultScene.id, (sceneId) => this.selectScene(sceneId));
    this.uiManager.updateCurrentSceneName(defaultScene.name);
  }

  bindEvents() {
    document.getElementById('add-paragraph').addEventListener('click', () => this.addParagraph());
    document.getElementById('delete-paragraph').addEventListener('click', () => this.deleteParagraph());
    document.getElementById('new-project').addEventListener('click', () => this.newProject());
    document.getElementById('save-project').addEventListener('click', () => this.saveProject());
    document.getElementById('open-project').addEventListener('click', () => this.openProject());
    document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
    document.getElementById('preview-novel').addEventListener('click', () => this.previewManager.showPreview());
    document.getElementById('reload-schema').addEventListener('click', () => this.reloadSchema());
    document.getElementById('add-scene').addEventListener('click', () => this.addScene());
    
    const editorContent = this.uiManager.getEditorContent();
    const tagsInput = this.uiManager.getTagsInput();
    const typeSelect = this.uiManager.getTypeSelect();
    
    editorContent.addEventListener('input', () => this.updateCurrentParagraph());
    tagsInput.addEventListener('input', () => this.updateCurrentParagraph());
    typeSelect.addEventListener('change', () => this.onTypeChange());
    
    this.bindSchemaEvents();
    
    document.getElementById('close-preview').addEventListener('click', () => this.previewManager.closePreview());
    const previewFormat = this.uiManager.getPreviewFormat();
    previewFormat.addEventListener('change', () => this.previewManager.updatePreview());
    
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        this.previewManager.closePreview();
      }
    });
  }

  bindSchemaEvents() {
    // 動的に生成されたパラメータ要素にイベントリスナーを追加
    const typeParams = this.uiManager.getTypeParams();
    Object.values(typeParams).forEach(params => {
      Object.values(params).forEach(element => {
        if (element) {
          element.addEventListener('input', () => this.updateCurrentParagraph());
          element.addEventListener('change', () => this.updateCurrentParagraph());
        }
      });
    });
  }

  addParagraph() {
    const newParagraph = this.paragraphManager.addParagraph();
    this.markAsChanged();
    this.uiManager.renderParagraphList();
    const selectedParagraph = this.paragraphManager.selectParagraph(newParagraph.id);
    if (selectedParagraph) {
      this.uiManager.showEditor(selectedParagraph);
      this.uiManager.updateParagraphSelection();
    }
  }

  deleteParagraph() {
    const selectedId = this.paragraphManager.getSelectedParagraphId();
    if (!selectedId) return;
    
    if (this.paragraphManager.deleteParagraph(selectedId)) {
      this.markAsChanged();
      this.uiManager.renderParagraphList();
      this.uiManager.showPlaceholder();
    }
  }

  async newProject() {
    const hasChanges = this.projectManager.hasChanges();
    if (hasChanges || this.paragraphManager.getParagraphs().length > 0) {
      const confirmed = confirm('現在のプロジェクトを破棄して新規作成しますか？');
      if (!confirmed) return;
    }
    
    // 新規プロジェクトをセットアップ
    this.sceneManager.clearScenes();
    const defaultScene = this.sceneManager.createScene('メインシーン');
    this.sceneManager.selectScene(defaultScene.id);
    
    this.paragraphManager.setParagraphs([]);
    await this.projectManager.newProject();
    
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), defaultScene.id, (sceneId) => this.selectScene(sceneId));
    this.uiManager.updateCurrentSceneName(defaultScene.name);
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
    this.updateTitle();
  }

  async saveProject() {
    // 現在のシーンを保存
    await this.saveCurrentScene();
    
    // プロジェクトファイルを保存
    const sceneList = this.sceneManager.getSceneListForProject();
    const currentSceneId = this.sceneManager.getCurrentSceneId();
    const result = await this.projectManager.saveProject(sceneList, currentSceneId);
    
    if (result.success) {
      this.sceneManager.setProjectPath(result.path);
      
      // すべてのシーンを保存
      const scenes = this.sceneManager.getScenes();
      for (const scene of scenes) {
        if (scene.paragraphs && scene.paragraphs.length > 0) {
          await window.electronAPI.saveScene(result.path, scene.id, {
            id: scene.id,
            name: scene.name,
            fileName: scene.fileName,
            paragraphs: scene.paragraphs
          });
          this.sceneManager.markSceneAsExisting(scene.id, true);
        }
      }
      
      this.updateTitle();
    }
  }

  async openProject() {
    const result = await this.projectManager.openProject();
    
    if (result.success) {
      this.sceneManager.setProjectPath(result.path);
      
      // スキーマファイルをロード
      await this.blockTypeManager.loadSchemaFile(result.path, result.schemaFile);
      
      // シーンリストをロード
      this.sceneManager.loadScenesFromProject(result.data.scenes || []);
      
      // 各シーンの存在確認
      const scenes = this.sceneManager.getScenes();
      for (const scene of scenes) {
        const checkResult = await window.electronAPI.checkSceneExists(result.path, scene.fileName);
        this.sceneManager.markSceneAsExisting(scene.id, checkResult.exists);
      }
      
      // レガシーデータの処理（v1.0.0からの移行）
      if (result.legacyParagraphs && result.legacyParagraphs.length > 0) {
        const defaultScene = this.sceneManager.getCurrentScene();
        if (defaultScene) {
          defaultScene.paragraphs = result.legacyParagraphs;
          await window.electronAPI.saveScene(result.path, defaultScene.id, {
            id: defaultScene.id,
            name: defaultScene.name,
            fileName: defaultScene.fileName,
            paragraphs: defaultScene.paragraphs
          });
        }
      }
      
      // 現在のシーンを選択
      const currentSceneId = result.data.currentSceneId || (scenes.length > 0 ? scenes[0].id : null);
      if (currentSceneId) {
        await this.selectScene(currentSceneId);
      }
      
      // UIを再生成
      this.uiManager.generateTypeUI();
      this.bindSchemaEvents();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), currentSceneId, (sceneId) => this.selectScene(sceneId));
      this.updateTitle();
    }
  }

  async exportCSV() {
    const paragraphs = this.paragraphManager.getParagraphs();
    await this.projectManager.exportCSV(paragraphs, this.blockTypeManager);
  }

  onTypeChange() {
    const typeSelect = this.uiManager.getTypeSelect();
    const editorContent = this.uiManager.getEditorContent();
    const newType = typeSelect.value;
    this.uiManager.showTypeParams(newType);
    
    // ブロックタイプ定義に基づいてテキスト入力を制御
    const blockType = this.blockTypeManager.getBlockType(newType);
    if (blockType && !blockType.requires_text) {
      editorContent.style.display = 'none';
      editorContent.value = '';
    } else {
      editorContent.style.display = 'block';
      editorContent.disabled = false;
      editorContent.placeholder = 'ここにテキストを入力...';
    }
    
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (!selectedParagraph) return;
    
    const oldType = selectedParagraph.type;
    selectedParagraph.type = newType;
    selectedParagraph.updatedAt = new Date().toISOString();
    
    // テキストが不要なタイプに変更した場合はテキストをクリア
    if (blockType && !blockType.requires_text) {
      selectedParagraph.text = '';
    }
    
    this.uiManager.clearTypeParams(oldType);
    this.paragraphManager.setDefaultParams(selectedParagraph, newType);
    this.uiManager.loadTypeParams(selectedParagraph);
    this.markAsChanged();
    this.uiManager.updateParagraphListItem(selectedParagraph);
  }

  updateCurrentParagraph() {
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (!selectedParagraph) return;
    
    const editorContent = this.uiManager.getEditorContent();
    const tagsInput = this.uiManager.getTagsInput();
    const typeParams = this.uiManager.getTypeParams();
    
    // テキストが必要なタイプの場合のみテキストを更新
    const blockType = this.blockTypeManager.getBlockType(selectedParagraph.type);
    if (blockType && blockType.requires_text) {
      selectedParagraph.text = editorContent.value;
    }
    selectedParagraph.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    selectedParagraph.updatedAt = new Date().toISOString();
    
    const type = selectedParagraph.type;
    if (typeParams[type]) {
      Object.entries(typeParams[type]).forEach(([key, element]) => {
        if (element) {
          selectedParagraph[key] = element.value;
        }
      });
    }
    
    this.markAsChanged();
    this.uiManager.updateParagraphListItem(selectedParagraph);
  }

  markAsChanged() {
    this.projectManager.markAsChanged();
    this.updateTitle();
  }

  updateTitle() {
    this.projectManager.updateTitle();
  }

  async reloadSchema() {
    try {
      const projectPath = this.projectManager.getProjectPath();
      if (!projectPath) {
        alert('プロジェクトを開いてからスキーマを再読込してください');
        return;
      }

      // 現在の選択状態を保存
      const selectedId = this.paragraphManager.getSelectedParagraphId();
      
      // スキーマファイル名を取得
      const schemaFileName = this.projectManager.getCurrentSchemaFile();
      
      // スキーマをリロード
      await this.blockTypeManager.loadSchemaFile(projectPath, schemaFileName);
      
      // UIを再生成
      this.uiManager.generateTypeUI();
      this.bindSchemaEvents();
      
      // リストを再描画
      this.uiManager.renderParagraphList();
      
      // 選択状態を復元
      if (selectedId) {
        const paragraph = this.paragraphManager.selectParagraph(selectedId);
        if (paragraph) {
          this.uiManager.showEditor(paragraph);
          this.uiManager.updateParagraphSelection();
        }
      }
      
      alert('スキーマファイルを再読込しました');
    } catch (error) {
      console.error('スキーマ再読込エラー:', error);
      alert(`スキーマの再読込に失敗しました\n\nエラー内容: ${error.message}`);
    }
  }

  async addScene() {
    const projectPath = this.projectManager.getProjectPath();
    if (!projectPath) {
      // プロジェクトが開かれていない場合は、新規プロジェクトとして開始
      await this.newProject();
      return;
    }
    
    // ファイル保存ダイアログを開く
    const result = await window.electronAPI.saveNewScene(projectPath);
    if (!result.success) return;
    
    // 現在のシーンを保存
    await this.saveCurrentScene();
    
    const newScene = this.sceneManager.createScene(result.sceneName);
    // ファイル名を上書き
    newScene.fileName = result.fileName;
    
    // 空のシーンデータを保存
    await window.electronAPI.saveScene(projectPath, newScene.id, {
      id: newScene.id,
      name: newScene.name,
      fileName: newScene.fileName,
      paragraphs: []
    });
    
    this.sceneManager.markSceneAsExisting(newScene.id, true);
    this.sceneManager.selectScene(newScene.id);
    this.paragraphManager.setParagraphs([]);
    
    this.markAsChanged();
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), newScene.id, (sceneId) => this.selectScene(sceneId));
    this.uiManager.updateCurrentSceneName(newScene.name);
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
  }

  async selectScene(sceneId) {
    // 現在のシーンを保存
    await this.saveCurrentScene();
    
    const scene = this.sceneManager.selectScene(sceneId);
    if (!scene) return;
    
    // シーンのデータをロード
    const projectPath = this.projectManager.getProjectPath();
    if (projectPath && scene.exists) {
      try {
        const result = await window.electronAPI.loadScene(projectPath, scene.fileName);
        if (result.success) {
          scene.paragraphs = result.data.paragraphs || [];
          this.paragraphManager.setParagraphs(scene.paragraphs);
        }
      } catch (error) {
        console.error('シーンの読み込みエラー:', error);
        this.paragraphManager.setParagraphs([]);
      }
    } else {
      this.paragraphManager.setParagraphs(scene.paragraphs || []);
    }
    
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), sceneId, (sceneId) => this.selectScene(sceneId));
    this.uiManager.updateCurrentSceneName(scene.name);
    this.uiManager.renderParagraphList();
    
    if (this.paragraphManager.getParagraphs().length > 0) {
      const firstParagraph = this.paragraphManager.getParagraphs()[0];
      const selected = this.paragraphManager.selectParagraph(firstParagraph.id);
      if (selected) {
        this.uiManager.showEditor(selected);
        this.uiManager.updateParagraphSelection();
      }
    } else {
      this.uiManager.showPlaceholder();
    }
  }

  async saveCurrentScene() {
    const currentScene = this.sceneManager.getCurrentScene();
    if (!currentScene) return;
    
    const paragraphs = this.paragraphManager.getParagraphs();
    this.sceneManager.updateSceneParagraphs(currentScene.id, paragraphs);
    
    const projectPath = this.projectManager.getProjectPath();
    if (projectPath && paragraphs.length > 0) {
      try {
        await window.electronAPI.saveScene(projectPath, currentScene.id, {
          id: currentScene.id,
          name: currentScene.name,
          fileName: currentScene.fileName,
          paragraphs: paragraphs
        });
        this.sceneManager.markSceneAsExisting(currentScene.id, true);
      } catch (error) {
        console.error('シーンの保存エラー:', error);
      }
    }
  }
}

const scenarioManager = new ScenarioManager();