// メインのシナリオ管理クラス
import { BlockTypeManager } from './modules/block-types.js';
import { ProjectManager } from './modules/project-manager.js';
import { ParagraphManager } from './modules/paragraph-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { PreviewManager } from './modules/preview-manager.js';
import { SceneManager } from './modules/scene-manager.js';
import { CharacterManager } from './modules/character-manager.js';
import { TextImporter } from './modules/text-importer.js';

class ScenarioManager {
  constructor() {
    this.blockTypeManager = new BlockTypeManager();
    this.projectManager = new ProjectManager();
    this.sceneManager = new SceneManager();
    this.characterManager = new CharacterManager();
    this.paragraphManager = new ParagraphManager(this.blockTypeManager);
    this.textImporter = new TextImporter(this.paragraphManager);
    this.uiManager = new UIManager(this.blockTypeManager, this.paragraphManager, this.projectManager, this.characterManager);
    this.previewManager = new PreviewManager(this.paragraphManager, this.uiManager);
    
    // グローバルハンドラーを登録
    window.deleteParagraphHandler = (id) => this.deleteParagraph(id);
    window.reorderParagraphHandler = (draggedId, targetId, insertAfter) => this.reorderParagraphs(draggedId, targetId, insertAfter);
    
    this.initializeUI();
    this.bindEvents();
    this.updateTitle();
    
    // ブラウザのページ離脱時の確認
    this.setupBeforeUnloadHandler();
  }

  async initializeUI() {
    this.uiManager.generateTypeUI();
    // 初期状態では編集機能を無効化
    this.setEditingEnabled(false);
    // 最近のプロジェクト一覧を表示
    await this.showRecentProjects();
  }

  bindEvents() {
    document.getElementById('add-paragraph').addEventListener('click', () => this.addParagraph());
    document.getElementById('delete-paragraph').addEventListener('click', () => this.deleteParagraph());
    document.getElementById('new-project').addEventListener('click', () => this.newProject());
    document.getElementById('save-project').addEventListener('click', () => this.saveProject());
    document.getElementById('open-project').addEventListener('click', () => this.openProject());
    document.getElementById('export-csv').addEventListener('click', () => this.exportCSV());
    document.getElementById('export-text').addEventListener('click', () => this.exportText());
    document.getElementById('preview-novel').addEventListener('click', () => this.previewManager.showPreview());
    document.getElementById('reload-schema').addEventListener('click', () => this.reloadSchema());
    document.getElementById('add-scene').addEventListener('click', () => this.addScene());
    document.getElementById('import-text').addEventListener('click', () => this.importTextAsScene());
    document.getElementById('new-project-from-recent').addEventListener('click', () => this.newProject());
    document.getElementById('open-project-from-recent').addEventListener('click', () => this.openProject());
    
    // キーボードショートカットのバインド
    this.bindKeyboardShortcuts();
    
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

  deleteParagraph(paragraphId = null) {
    const idToDelete = paragraphId || this.paragraphManager.getSelectedParagraphId();
    if (!idToDelete) return;
    
    if (this.paragraphManager.deleteParagraph(idToDelete)) {
      this.markAsChanged();
      this.uiManager.renderParagraphList();
      
      // 削除したブロックが選択中だった場合のみプレースホルダーを表示
      if (idToDelete === this.paragraphManager.getSelectedParagraphId()) {
        this.uiManager.showPlaceholder();
      }
    }
  }

  async showRecentProjects() {
    try {
      const recentProjects = await window.electronAPI.getRecentProjects();
      const recentProjectsList = document.getElementById('recent-projects-list');
      const recentProjectsPanel = document.getElementById('recent-projects-panel');
      
      recentProjectsList.innerHTML = '';
      
      if (recentProjects.length === 0) {
        recentProjectsList.innerHTML = '<div class="recent-projects-empty">最近開いたプロジェクトはありません</div>';
      } else {
        recentProjects.forEach(project => {
          const item = document.createElement('div');
          item.className = 'recent-project-item';
          
          const info = document.createElement('div');
          info.className = 'recent-project-info';
          
          const name = document.createElement('div');
          name.className = 'recent-project-name';
          name.textContent = project.name;
          
          const path = document.createElement('div');
          path.className = 'recent-project-path';
          path.textContent = project.path;
          
          const date = document.createElement('div');
          date.className = 'recent-project-date';
          const lastOpened = new Date(project.lastOpened);
          date.textContent = `最終更新: ${lastOpened.toLocaleDateString()} ${lastOpened.toLocaleTimeString()}`;
          
          info.appendChild(name);
          info.appendChild(path);
          info.appendChild(date);
          item.appendChild(info);
          
          item.addEventListener('click', () => this.openRecentProject(project.path));
          
          recentProjectsList.appendChild(item);
        });
      }
      
      recentProjectsPanel.style.display = 'block';
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  }

  hideRecentProjects() {
    const recentProjectsPanel = document.getElementById('recent-projects-panel');
    recentProjectsPanel.style.display = 'none';
  }

  async loadProject(projectData, projectPath) {
    try {
      this.projectManager.setProjectPath(projectPath);
      this.sceneManager.setProjectPath(projectPath);
      
      // スキーマファイルをロード
      try {
        await this.blockTypeManager.loadSchemaFile(projectPath, projectData.schemaFile);
      } catch (error) {
        console.error('スキーマファイル読み込みエラー:', error);
        alert(`スキーマファイルの読み込みに失敗しました:\n${error.message}\n\nプロジェクトは開かれましたが、スキーマファイルが正しく読み込まれませんでした。`);
      }

      // キャラクターファイルをロード（プロジェクト名ベース）
      try {
        const projectName = projectPath.split('/').pop().replace('.fbl', '');
        const charactersFileName = `${projectName}_characters.yaml`;
        await this.characterManager.loadCharactersFile(projectPath, charactersFileName);
      } catch (error) {
        console.error('キャラクターファイル読み込みエラー:', error);
        console.warn('キャラクターファイルの読み込みに失敗しました:', error.message);
      }
      
      // シーンリストをロード
      try {
        this.sceneManager.loadScenesFromProject(projectData.scenes || []);
      } catch (error) {
        console.error('シーンリスト読み込みエラー:', error);
        alert(`シーンリストの読み込みに失敗しました:\n${error.message}`);
        return;
      }

      // 各シーンの存在チェック
      const scenes = this.sceneManager.getScenes();
      for (const scene of scenes) {
        try {
          const existsResult = await window.electronAPI.checkSceneExists(projectPath, scene.fileName);
          this.sceneManager.markSceneAsExisting(scene.id, existsResult.exists);
        } catch (error) {
          console.warn('シーンファイル存在チェックエラー:', scene.fileName, error);
          this.sceneManager.markSceneAsExisting(scene.id, false);
        }
      }

      // レガシーデータの処理（v1.0.0からのマイグレーション）
      try {
        if (projectData.paragraphs && projectData.paragraphs.length > 0) {
          const defaultScene = this.sceneManager.getCurrentScene();
          if (defaultScene) {
            defaultScene.paragraphs = projectData.paragraphs;
            await window.electronAPI.saveScene(projectPath, defaultScene.id, {
              id: defaultScene.id,
              name: defaultScene.name,
              fileName: defaultScene.fileName,
              paragraphs: defaultScene.paragraphs
            });
          }
        }
      } catch (error) {
        console.error('レガシーデータ処理エラー:', error);
        console.warn('レガシーデータの処理に失敗しました:', error.message);
      }
      
      // 現在のシーンを選択
      try {
        const currentSceneId = projectData.currentSceneId || (this.sceneManager.getScenes().length > 0 ? this.sceneManager.getScenes()[0].id : null);
        if (currentSceneId) {
          await this.selectScene(currentSceneId);
        } else {
          this.paragraphManager.setParagraphs([]);
          this.uiManager.showPlaceholder();
        }
      } catch (error) {
        console.warn('シーン選択エラー:', error);
        this.paragraphManager.setParagraphs([]);
        this.uiManager.showPlaceholder();
      }
      
      // 編集機能を有効化
      this.setEditingEnabled(true);
      
      // UIを再生成
      try {
        this.uiManager.generateTypeUI();
        this.bindSchemaEvents();
        this.uiManager.renderSceneList(this.sceneManager.getScenes(), this.sceneManager.getCurrentSceneId(), (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName));
      } catch (error) {
        console.error('UI再生成エラー:', error);
        alert(`UIの更新に失敗しました:\n${error.message}`);
      }
      
      this.hideRecentProjects();
      this.updateTitle();
    } catch (error) {
      console.error('プロジェクト読み込みエラー:', error);
      alert(`プロジェクトの読み込みに失敗しました:\n${error.message}`);
    }
  }

  async openRecentProject(projectPath) {
    try {
      const result = await window.electronAPI.openRecentProject(projectPath);
      if (result.success) {
        await this.loadProject(result.data, result.path);
      } else {
        alert('プロジェクトを開けませんでした:\n' + (result.error || '不明なエラー'));
      }
    } catch (error) {
      console.error('Open recent project error:', error);
      alert('プロジェクトを開けませんでした:\n' + error.message);
    }
  }

  async newProject() {
    const hasChanges = this.projectManager.hasChanges();
    if (hasChanges || this.paragraphManager.getParagraphs().length > 0) {
      const confirmed = confirm('現在のプロジェクトを破棄して新規作成しますか？');
      if (!confirmed) return;
    }
    
    // まずプロジェクトファイルを保存
    const saveResult = await window.electronAPI.saveProject({
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      schemaFile: '', // 後で設定
      scenes: [],
      currentSceneId: null
    }, null);
    
    if (!saveResult.success) return;
    
    // プロジェクトマネージャーを更新
    this.projectManager.setProjectPath(saveResult.path);
    this.projectManager.markAsSaved();
    
    // スキーマファイルを読み込み
    if (saveResult.schemaFileName) {
      await this.blockTypeManager.loadSchemaFile(saveResult.path, saveResult.schemaFileName);
      this.uiManager.generateTypeUI();
      this.bindSchemaEvents();
    }

    // キャラクターファイルを読み込み
    if (saveResult.charactersFileName) {
      await this.characterManager.loadCharactersFile(saveResult.path, saveResult.charactersFileName);
      this.uiManager.generateTypeUI();
      this.bindSchemaEvents();
    }
    
    // 新規プロジェクトをセットアップ
    this.sceneManager.clearScenes();
    this.sceneManager.setProjectPath(saveResult.path);
    
    this.paragraphManager.setParagraphs([]);
    
    // 編集機能を有効化（シーン編集は無効化）
    this.setEditingEnabled(true);
    this.setSceneEditingEnabled(false);
    
    this.hideRecentProjects();
    this.uiManager.renderSceneList([], null, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName));
    this.uiManager.updateCurrentSceneName('');
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
        // 現在のシーンは最新の段落データを使用
        if (scene.id === currentSceneId) {
          const currentParagraphs = this.paragraphManager.getParagraphs();
          await window.electronAPI.saveScene(result.path, scene.id, {
            id: scene.id,
            name: scene.name,
            fileName: scene.fileName,
            paragraphs: currentParagraphs
          });
          this.sceneManager.updateSceneParagraphs(scene.id, currentParagraphs);
        } else {
          // その他のシーンは保存済みのデータを使用
          await window.electronAPI.saveScene(result.path, scene.id, {
            id: scene.id,
            name: scene.name,
            fileName: scene.fileName,
            paragraphs: scene.paragraphs || []
          });
        }
        this.sceneManager.markSceneAsExisting(scene.id, true);
      }
      
      this.updateTitle();
    }
  }

  async openProject() {
    try {
      const result = await this.projectManager.openProject();
      
      if (result.success) {
        await this.loadProject(result.data, result.path);
      } else {
        // プロジェクトファイルの選択がキャンセルされた場合は何もしない
        if (result.cancelled) {
          return;
        }
        // その他のエラーの場合は詳細なエラーメッセージを表示
        alert('プロジェクトを開けませんでした:\n' + (result.error || '不明なエラーが発生しました'));
      }
    } catch (error) {
      console.error('プロジェクトオープンエラー:', error);
      alert(`プロジェクトを開く際にエラーが発生しました:\n\n${error.message}\n\nファイルが破損している可能性があります。`);
    }
  }

  reorderParagraphs(draggedId, targetId, insertAfter = false) {
    if (this.paragraphManager.reorderParagraphs(draggedId, targetId, insertAfter)) {
      this.markAsChanged();
      this.uiManager.renderParagraphList();
      this.uiManager.updateParagraphSelection();
    }
  }

  async exportCSV() {
    const projectPath = this.projectManager.getProjectPath();
    if (!projectPath) {
      alert('プロジェクトが保存されていません。先にプロジェクトを保存してください。');
      return;
    }
    
    // 現在のシーンを保存してから全シーンをエクスポート
    await this.saveCurrentScene();
    
    const scenes = this.sceneManager.getScenes();
    if (scenes.length === 0) {
      alert('エクスポートするシーンがありません。');
      return;
    }
    
    // ブロックタイプ定義を取得
    const blockTypes = this.blockTypeManager.getBlockTypes();
    
    await this.projectManager.exportAllScenesAsCSV(projectPath, scenes, blockTypes);
  }

  async exportText() {
    const projectPath = this.projectManager.getProjectPath();
    if (!projectPath) {
      alert('プロジェクトが保存されていません。先にプロジェクトを保存してください。');
      return;
    }

    // 現在のシーンを保存してから全シーンをエクスポート
    await this.saveCurrentScene();
    
    const scenes = this.sceneManager.getScenes();
    if (scenes.length === 0) {
      alert('エクスポートするシーンがありません。');
      return;
    }

    // フォーマット選択のダイアログを表示
    const format = await this.showFormatSelectionDialog();
    if (!format) return; // キャンセルされた場合

    // 全シーンをテキストエクスポート
    await this.exportAllScenesAsText(projectPath, scenes, format);
  }

  showFormatSelectionDialog() {
    return new Promise((resolve) => {
      // モーダルダイアログを作成
      const modal = document.createElement('div');
      modal.className = 'modal show';
      modal.style.display = 'flex';
      
      const modalContent = document.createElement('div');
      modalContent.style.cssText = `
        background: #2d2d30;
        border-radius: 8px;
        padding: 2rem;
        max-width: 400px;
        text-align: center;
        border: 1px solid #3e3e42;
      `;
      
      const title = document.createElement('h2');
      title.textContent = 'エクスポート形式を選択';
      title.style.cssText = 'color: #ffffff; margin-bottom: 1.5rem; font-size: 1.2rem;';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display: flex; gap: 1rem; justify-content: center; margin-bottom: 1rem;';
      
      const novelButton = document.createElement('button');
      novelButton.textContent = '小説形式';
      novelButton.className = 'add-button';
      novelButton.style.cssText = 'flex: 1; padding: 1rem; font-size: 1rem;';
      
      const scriptButton = document.createElement('button');
      scriptButton.textContent = '台本形式';
      scriptButton.className = 'add-button';
      scriptButton.style.cssText = 'flex: 1; padding: 1rem; font-size: 1rem;';
      
      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'キャンセル';
      cancelButton.style.cssText = `
        background: #666666;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 0.5rem 1rem;
        cursor: pointer;
        margin-top: 0.5rem;
      `;
      
      buttonContainer.appendChild(novelButton);
      buttonContainer.appendChild(scriptButton);
      
      modalContent.appendChild(title);
      modalContent.appendChild(buttonContainer);
      modalContent.appendChild(cancelButton);
      modal.appendChild(modalContent);
      document.body.appendChild(modal);
      
      const cleanup = () => {
        document.body.removeChild(modal);
      };
      
      novelButton.addEventListener('click', () => {
        cleanup();
        resolve('novel');
      });
      
      scriptButton.addEventListener('click', () => {
        cleanup();
        resolve('script');
      });
      
      cancelButton.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });
    });
  }

  async exportAllScenesAsText(projectPath, scenes, format) {
    try {
      // 各シーンのテキストを生成
      const sceneTexts = [];
      
      for (const scene of scenes) {
        if (!scene.exists) {
          console.warn(`シーンファイルが存在しません: ${scene.fileName}`);
          continue;
        }
        
        try {
          // シーンデータを読み込み
          const result = await window.electronAPI.loadScene(projectPath, scene.fileName);
          if (!result.success || !result.data.paragraphs) {
            console.warn(`シーン \"${scene.name}\" のデータが読み込めませんでした`);
            continue;
          }
          
          // テキストコンテンツを生成
          const textContent = this.generateSceneTextContent(result.data.paragraphs, format);
          
          sceneTexts.push({
            name: scene.name,
            fileName: scene.fileName,
            content: textContent
          });
        } catch (error) {
          console.error(`シーン \"${scene.name}\" の処理中にエラー:`, error);
        }
      }
      
      if (sceneTexts.length === 0) {
        alert('エクスポートできるシーンがありませんでした。');
        return;
      }
      
      // メインプロセスに全シーンのテキストエクスポートを依頼
      const result = await window.electronAPI.exportAllScenesAsText(projectPath, sceneTexts, format);
      
      if (result.success) {
        alert(`全シーンのテキストエクスポートが完了しました。\n\n出力先: ${result.outputDir}\n作成されたファイル数: ${result.fileCount}`);
      } else {
        const errorMessage = result.error || '不明なエラー';
        alert(`テキストエクスポートに失敗しました\n\nエラー内容: ${errorMessage}`);
      }
    } catch (error) {
      console.error('全シーンテキストエクスポートエラー:', error);
      alert(`テキストエクスポートに失敗しました\n\nエラー内容: ${error.message}`);
    }
  }

  generateSceneTextContent(paragraphs, format) {
    if (!paragraphs || paragraphs.length === 0) {
      return '';
    }

    let textContent = '';
    
    if (format === 'novel') {
      paragraphs.forEach(paragraph => {
        if (!paragraph.text || !paragraph.text.trim()) return;
        
        // セリフタイプのブロックは話者の有無に関わらず鍵カッコを表示
        if (paragraph.type === 'dialogue') {
          // 末尾の改行や空行を除去
          const trimmedText = paragraph.text.replace(/[\n\r\s]*$/, '');
          textContent += `「${trimmedText}」\n\n`;
        } else if (paragraph.type === 'monologue') {
          // モノローグは（）で囲む
          const trimmedText = paragraph.text.replace(/[\n\r\s]*$/, '');
          textContent += `（${trimmedText}）\n\n`;
        } else {
          // 地の文など
          // 末尾の改行や空行を除去
          const trimmedText = paragraph.text.replace(/[\n\r\s]*$/, '');
          textContent += `${trimmedText}\n\n`;
        }
      });
    } else if (format === 'script') {
      paragraphs.forEach(paragraph => {
        if (!paragraph.text || !paragraph.text.trim()) return;
        
        // セリフタイプの場合は話者名を表示（設定されている場合のみ）
        if (paragraph.type === 'dialogue' && paragraph.speaker && paragraph.speaker.trim()) {
          textContent += `${paragraph.speaker}：\n`;
        } else if (paragraph.type === 'monologue' && paragraph.speaker && paragraph.speaker.trim()) {
          textContent += `${paragraph.speaker}（心の声）：\n`;
        }
        
        // 末尾の改行や空行を除去
        const trimmedText = paragraph.text.replace(/[\n\r\s]*$/, '');
        
        // セリフの場合は台本形式では鍵カッコなし、地の文の場合はそのまま
        if (paragraph.type === 'dialogue') {
          textContent += `${trimmedText}\n\n`;
        } else if (paragraph.type === 'monologue') {
          textContent += `${trimmedText}\n\n`;
        } else {
          textContent += `${trimmedText}\n\n`;
        }
      });
    }
    
    return textContent.trim();
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
    
    // シーン編集機能を有効化
    this.setSceneEditingEnabled(true);
    
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
    
    // シーン編集機能を有効化
    this.setSceneEditingEnabled(true);
    
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), sceneId, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName));
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

  async renameScene(sceneId, newName) {
    if (this.sceneManager.renameScene(sceneId, newName)) {
      this.markAsChanged();
      
      // 現在のシーンの場合は表示を更新
      if (sceneId === this.sceneManager.getCurrentSceneId()) {
        this.uiManager.updateCurrentSceneName(newName);
      }
      
      // シーンリストを再描画
      const currentSceneId = this.sceneManager.getCurrentSceneId();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), currentSceneId, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName));
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

  setEditingEnabled(enabled) {
    // 編集関連のボタンを有効/無効化
    const editButtons = [
      'save-project',
      'export-csv',
      'export-text',
      'preview-novel',
      'reload-schema',
      'add-scene',
      'import-text'
    ];
    
    editButtons.forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = !enabled;
      }
    });
    
    // エディタの表示/非表示
    if (!enabled) {
      this.uiManager.showPlaceholder();
      const placeholder = document.getElementById('editor-placeholder');
      if (placeholder) {
        placeholder.textContent = 'プロジェクトを作成または開いてください';
      }
    }
  }

  setSceneEditingEnabled(enabled) {
    // シーン編集関連のボタンを有効/無効化
    const sceneEditButtons = [
      'add-paragraph',
      'delete-paragraph'
    ];
    
    sceneEditButtons.forEach(id => {
      const button = document.getElementById(id);
      if (button) {
        button.disabled = !enabled;
      }
    });
    
    // エディタの表示/非表示
    if (!enabled) {
      this.uiManager.showPlaceholder();
      const placeholder = document.getElementById('editor-placeholder');
      if (placeholder) {
        placeholder.textContent = 'シーンを選択してください';
      }
    }
  }

  async importTextAsScene() {
    const projectPath = this.projectManager.getProjectPath();
    if (!projectPath) {
      await this.newProject();
      return;
    }

    try {
      // テキストファイルを選択・読み込み
      const importResult = await window.electronAPI.importTextFile();
      if (!importResult.success) return;

      // テキストをブロックに変換
      const paragraphs = this.textImporter.importFromText(importResult.content);
      
      if (paragraphs.length === 0) {
        alert('インポートできるブロックが見つかりませんでした');
        return;
      }

      // プレビューを表示
      const preview = this.textImporter.generatePreview(paragraphs);
      const confirmed = confirm(`以下の${paragraphs.length}個のブロックをインポートしますか？\n\n${preview.substring(0, 500)}${preview.length > 500 ? '\n...' : ''}`);
      
      if (!confirmed) return;

      // 現在のシーンを保存
      await this.saveCurrentScene();

      // 新しいシーンを作成
      const newScene = this.sceneManager.createScene(importResult.fileName || 'インポートされたシーン');
      
      // シーンファイルを保存
      await window.electronAPI.saveScene(projectPath, newScene.id, {
        id: newScene.id,
        name: newScene.name,
        fileName: newScene.fileName,
        paragraphs: paragraphs
      });

      this.sceneManager.markSceneAsExisting(newScene.id, true);
      this.sceneManager.selectScene(newScene.id);
      this.paragraphManager.setParagraphs(paragraphs);

      // シーン編集機能を有効化
      this.setSceneEditingEnabled(true);

      this.markAsChanged();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), newScene.id, (sceneId) => this.selectScene(sceneId));
      this.uiManager.updateCurrentSceneName(newScene.name);
      this.uiManager.renderParagraphList();
      
      // 最初のブロックを選択
      if (paragraphs.length > 0) {
        const firstParagraph = this.paragraphManager.selectParagraph(paragraphs[0].id);
        if (firstParagraph) {
          this.uiManager.showEditor(firstParagraph);
          this.uiManager.updateParagraphSelection();
        }
      }

      alert(`${paragraphs.length}個のブロックをインポートしました`);

    } catch (error) {
      console.error('テキストインポートエラー:', error);
      alert(`テキストインポートに失敗しました\n\nエラー内容: ${error.message}`);
    }
  }
  
  setupBeforeUnloadHandler() {
    // ブラウザのページ離脱時の確認（Electronでも動作する）
    window.addEventListener('beforeunload', (e) => {
      if (this.projectManager.hasChanges()) {
        // 標準的な確認ダイアログを表示
        e.preventDefault();
        e.returnValue = '保存されていない変更があります。このページを離れますか？';
        return e.returnValue;
      }
    });
  }
  
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd キーの判定
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      if (isCtrlOrCmd) {
        switch(e.key.toLowerCase()) {
          case 's':
            // Ctrl/Cmd + S: 保存
            e.preventDefault();
            if (!document.getElementById('save-project').disabled) {
              this.saveProject();
            }
            break;
            
          case 'n':
            // Ctrl/Cmd + N: 新規プロジェクト
            e.preventDefault();
            this.newProject();
            break;
            
          case 'o':
            // Ctrl/Cmd + O: 開く
            e.preventDefault();
            this.openProject();
            break;
            
          case 'e':
            // Ctrl/Cmd + E: エクスポート（Shift併用で形式選択）
            if (e.shiftKey) {
              e.preventDefault();
              if (!document.getElementById('export-text').disabled) {
                this.exportText();
              }
            } else {
              e.preventDefault();
              if (!document.getElementById('export-csv').disabled) {
                this.exportCSV();
              }
            }
            break;
            
          case 'p':
            // Ctrl/Cmd + P: プレビュー
            e.preventDefault();
            if (!document.getElementById('preview-novel').disabled) {
              this.previewManager.showPreview();
            }
            break;
            
          case 'r':
            // Ctrl/Cmd + R: スキーマリロード
            e.preventDefault();
            if (!document.getElementById('reload-schema').disabled) {
              this.reloadSchema();
            }
            break;
            
          case 't':
            // Ctrl/Cmd + T: 新規シーン
            e.preventDefault();
            if (!document.getElementById('add-scene').disabled) {
              this.addScene();
            }
            break;
            
          case 'b':
            // Ctrl/Cmd + B: 新規ブロック追加
            e.preventDefault();
            if (!document.getElementById('add-paragraph').disabled) {
              this.addParagraph();
            }
            break;
            
          case 'd':
            // Ctrl/Cmd + D: ブロック削除
            if (e.shiftKey) {
              e.preventDefault();
              if (!document.getElementById('delete-paragraph').disabled) {
                this.deleteParagraph();
              }
            }
            break;
            
          case 'i':
            // Ctrl/Cmd + I: テキストインポート
            e.preventDefault();
            if (!document.getElementById('import-text').disabled) {
              this.importTextAsScene();
            }
            break;
        }
      } else if (e.key === 'Escape') {
        // Escape: プレビューを閉じる
        if (this.previewManager.isPreviewOpen()) {
          e.preventDefault();
          this.previewManager.closePreview();
        }
      }
    });
  }
}

const scenarioManager = new ScenarioManager();

// グローバル参照を作成（メインプロセスからアクセス用）
window.scenarioManager = scenarioManager;
window.projectManager = scenarioManager.projectManager;