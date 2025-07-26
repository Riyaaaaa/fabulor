// メインのシナリオ管理クラス
import { BlockTypeManager } from './modules/block-types.js';
import { ProjectManager } from './modules/project-manager.js';
import { ParagraphManager } from './modules/paragraph-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { PreviewManager } from './modules/preview-manager.js';
import { SceneManager } from './modules/scene-manager.js';
import { TextImporter } from './modules/text-importer.js';
import { HistoryManager, MoveBlockOperation, EditBlockOperation, DeleteBlockOperation, AddBlockOperation } from './modules/history-manager.js';
import { ResizeManager } from './modules/resize-manager.js';
import { MetaTagParser } from './modules/meta-tag-parser.js';
import { TextHighlighter } from './modules/text-highlighter.js';
import { MigrationManager } from './modules/migration-manager.js';

class ScenarioManager {
  constructor() {
    this.blockTypeManager = new BlockTypeManager();
    this.projectManager = new ProjectManager();
    this.sceneManager = new SceneManager();
    this.paragraphManager = new ParagraphManager(this.blockTypeManager);
    this.textImporter = new TextImporter(this.paragraphManager, this.blockTypeManager);
    this.uiManager = new UIManager(this.blockTypeManager, this.paragraphManager, this.projectManager);
    this.previewManager = new PreviewManager(this.paragraphManager, this.uiManager, this.blockTypeManager);
    this.historyManager = new HistoryManager();
    this.resizeManager = new ResizeManager();
    this.metaTagParser = new MetaTagParser();
    this.textHighlighter = new TextHighlighter(this.metaTagParser);
    this.migrationManager = new MigrationManager(this.paragraphManager, this.uiManager);
    
    // 編集開始時の状態を保存するための変数
    this.editStartState = null;
    this.editTimer = null;
    
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
    
    // メタコマンド定義を読み込み
    await this.loadMetaCommands();
  }

  async loadMetaCommands() {
    try {
      const success = await this.metaTagParser.loadMetaCommandsFromYaml('meta-commands.yaml');
      if (success) {
        console.log('...メタコマンド定義の読み込み完了');
        // グローバルフラグを設定してハイライト機能が使用可能であることを示す
        window.metaCommandsLoaded = true;
        // すべてのテキストエリアにハイライトを適用
        this.applyHighlightToAllTextAreas();
      } else {
        console.warn('...メタコマンド定義の読み込み失敗');
        window.metaCommandsLoaded = false;
      }
    } catch (error) {
      console.error('...メタコマンド定義読み込みエラー:', error);
      window.metaCommandsLoaded = false;
    }
  }

  applyHighlightToAllTextAreas() {
    // 現在表示されているすべてのテキストエリアにハイライトを適用
    const textAreas = document.querySelectorAll('textarea');
    textAreas.forEach(textarea => {
      if (textarea.id === 'editor-content') {
        this.textHighlighter.highlightTextArea(textarea);
      }
    });
  }

  setupTextHighlightForNewParagraphs() {
    // 新しく追加されたテキストエリアにハイライト機能を適用
    const editorContent = document.getElementById('editor-content');
    if (editorContent) {
      this.textHighlighter.highlightTextArea(editorContent);
    }
  }

  // マイグレーションモーダルを表示
  async showMigrationModal() {
    console.log('...マイグレーションモーダル表示開始');
    
    if (!this.projectManager.getProjectPath()) {
      alert('プロジェクトが開かれていません');
      return;
    }

    // マイグレーションスクリプト一覧を読み込み
    const migrations = await this.migrationManager.loadAvailableMigrations(this.projectManager.getProjectPath());
    console.log('...マイグレーション読み込み結果:', migrations);
    
    if (migrations.length === 0) {
      alert('migrationディレクトリにマイグレーションスクリプトが見つかりません');
      return;
    }

    console.log('...マイグレーションモーダルを表示');
    this.migrationManager.showMigrationModal();
  }

  // マイグレーション選択変更時
  onMigrationSelectChange() {
    const select = document.getElementById('migration-select');
    const executeButton = document.getElementById('execute-migration');
    const infoDiv = document.getElementById('migration-info');
    const descriptionP = document.getElementById('migration-description');

    if (select.value) {
      executeButton.disabled = false;
      
      // 選択されたマイグレーションの詳細を表示
      const selectedMigration = this.migrationManager.getAvailableMigrations()
        .find(m => m.fileName === select.value);
      
      if (selectedMigration) {
        descriptionP.textContent = selectedMigration.description || '説明なし';
        infoDiv.style.display = 'block';
      }
    } else {
      executeButton.disabled = true;
      infoDiv.style.display = 'none';
    }
  }

  // マイグレーション実行
  async executeMigration() {
    const select = document.getElementById('migration-select');
    const migrationFileName = select.value;
    
    if (!migrationFileName) {
      alert('マイグレーションスクリプトを選択してください');
      return;
    }

    // 確認ダイアログ
    const confirmed = confirm(`マイグレーション "${migrationFileName}" を実行しますか？\n\n現在のブロックデータが置き換えられます。事前に保存することを推奨します。`);
    if (!confirmed) {
      return;
    }

    console.log('...マイグレーション実行開始:', migrationFileName);

    try {
      const result = await this.migrationManager.executeMigration(
        this.projectManager.getProjectPath(),
        migrationFileName
      );

      if (result.success) {
        this.markAsChanged();
        this.migrationManager.closeMigrationModal();
        alert(result.message);
      } else {
        alert(`マイグレーション実行エラー: ${result.error}`);
      }
    } catch (error) {
      console.error('...マイグレーション実行エラー:', error);
      alert(`マイグレーション実行中にエラーが発生しました: ${error.message}`);
    }
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
    document.getElementById('migration').addEventListener('click', () => this.showMigrationModal());
    document.getElementById('close-migration').addEventListener('click', () => this.migrationManager.closeMigrationModal());
    document.getElementById('cancel-migration').addEventListener('click', () => this.migrationManager.closeMigrationModal());
    document.getElementById('execute-migration').addEventListener('click', () => this.executeMigration());
    document.getElementById('migration-select').addEventListener('change', () => this.onMigrationSelectChange());
    document.getElementById('add-scene').addEventListener('click', () => this.addScene());
    document.getElementById('import-text-file').addEventListener('click', () => this.importTextAsScene());
    document.getElementById('import-text').addEventListener('click', () => this.showTextInputModal());
    document.getElementById('new-project-from-recent').addEventListener('click', () => this.newProject());
    document.getElementById('open-project-from-recent').addEventListener('click', () => this.openProject());
    
    // キーボードショートカットのバインド
    this.bindKeyboardShortcuts();
    
    const editorContent = this.uiManager.getEditorContent();
    const tagsInput = this.uiManager.getTagsInput();
    const typeSelect = this.uiManager.getTypeSelect();
    const sceneMetadataInput = document.getElementById('scene-metadata');
    
    editorContent.addEventListener('input', () => this.updateCurrentParagraph());
    editorContent.addEventListener('focus', () => this.startEdit());
    editorContent.addEventListener('blur', () => this.finishEdit());
    tagsInput.addEventListener('input', () => this.updateCurrentParagraph());
    tagsInput.addEventListener('focus', () => this.startEdit());
    tagsInput.addEventListener('blur', () => this.finishEdit());
    typeSelect.addEventListener('change', () => this.onTypeChange());
    
    // シーンメタデータの変更を監視
    sceneMetadataInput.addEventListener('input', () => this.updateSceneMetadata());
    sceneMetadataInput.addEventListener('blur', () => this.saveSceneMetadata());
    
    this.bindSchemaEvents();
    
    document.getElementById('close-preview').addEventListener('click', () => this.previewManager.closePreview());
    document.getElementById('copy-preview').addEventListener('click', () => this.copyPreviewContent());
    const previewFormat = this.uiManager.getPreviewFormat();
    previewFormat.addEventListener('change', () => this.previewManager.updatePreview());
    
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.addEventListener('click', (e) => {
      if (e.target === previewModal) {
        this.previewManager.closePreview();
      }
    });
    
    // プレビューコンテンツでのコピーイベントをインターセプト
    const previewContent = document.getElementById('preview-content');
    previewContent.addEventListener('copy', (e) => {
      e.preventDefault();
      const format = this.uiManager.getPreviewFormat().value;
      const textContent = this.previewManager.generateTextContent(format);
      e.clipboardData.setData('text/plain', textContent);
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
          element.addEventListener('focus', () => this.startEdit());
          element.addEventListener('blur', () => this.finishEdit());
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
    
    // Undo/Redo操作を履歴に追加（既に追加済みなのでskipExecute=true）
    const operation = new AddBlockOperation(this.paragraphManager, this.uiManager, newParagraph.id);
    this.historyManager.executeOperation(operation, true);
  }

  deleteParagraph(paragraphId = null) {
    let idToDelete = paragraphId || this.paragraphManager.getSelectedParagraphId();
    if (!idToDelete) return;
    
    // 文字列として渡された場合は整数に変換
    if (typeof idToDelete === 'string') {
      idToDelete = parseInt(idToDelete);
    }
    
    // 削除前にUndo/Redo操作を作成（実行はDeleteBlockOperationのコンストラクタで状態を保存）
    const operation = new DeleteBlockOperation(this.paragraphManager, this.uiManager, idToDelete);
    
    // 実際の削除を実行
    if (this.paragraphManager.deleteParagraph(idToDelete)) {
      this.markAsChanged();
      this.uiManager.renderParagraphList();
      
      // 削除したブロックが選択中だった場合のみプレースホルダーを表示
      if (idToDelete === this.paragraphManager.getSelectedParagraphId()) {
        this.uiManager.showPlaceholder();
      }
      
      // 履歴に追加（既に削除済みなのでskipExecute=true）
      this.historyManager.executeOperation(operation, true);
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
      // 編集中の場合は履歴を確定
      this.finishEdit();
      
      // 履歴をクリア
      this.historyManager.clear();
      
      this.projectManager.setProjectPath(projectPath);
      this.sceneManager.setProjectPath(projectPath);
      
      // スキーマファイルをロード
      try {
        // プロジェクトマネージャーのスキーマファイル名を設定
        this.projectManager.setCurrentSchemaFile(projectData.schemaFile);
        await this.blockTypeManager.loadSchemaFile(projectPath, projectData.schemaFile);
      } catch (error) {
        console.error('スキーマファイル読み込みエラー:', error);
        alert(`スキーマファイルの読み込みに失敗しました:\n${error.message}\n\nプロジェクトは開かれましたが、スキーマファイルが正しく読み込まれませんでした。`);
      }

      
      // scenesディレクトリから直接シーン一覧を取得
      try {
        const scanResult = await window.electronAPI.scanScenesDirectory(projectPath);
        if (scanResult.success) {
          this.sceneManager.loadScenesFromDirectory(scanResult.scenes);
        } else {
          console.error('シーンディレクトリスキャンエラー:', scanResult.error);
          // エラーが発生しても空のシーンリストで続行
          this.sceneManager.loadScenesFromDirectory([]);
        }
      } catch (error) {
        console.error('シーンリスト読み込みエラー:', error);
        alert(`シーンリストの読み込みに失敗しました:\n${error.message}`);
        return;
      }

      // レガシーデータの処理（v1.0.0からのマイグレーション）
      try {
        if (projectData.paragraphs && projectData.paragraphs.length > 0) {
          const defaultScene = this.sceneManager.getCurrentScene();
          if (defaultScene) {
            defaultScene.paragraphs = projectData.paragraphs;
            await window.electronAPI.saveScene(projectPath, defaultScene.id, {
              id: defaultScene.id,
              _fileName: defaultScene._fileName,
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
        this.uiManager.renderSceneList(this.sceneManager.getScenes(), this.sceneManager.getCurrentSceneId(), (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
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
    
    // 編集中の場合は履歴を確定
    this.finishEdit();
    
    // 履歴をクリア
    this.historyManager.clear();
    
    // まずプロジェクトファイルを保存
    const saveResult = await window.electronAPI.saveProject({
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      schemaFile: '', // 初期値は空文字列、保存後に更新
      currentSceneId: null
    }, null);
    
    if (!saveResult.success) return;
    
    // プロジェクトマネージャーを更新
    this.projectManager.setProjectPath(saveResult.path);
    this.projectManager.markAsSaved();
    
    // スキーマファイルを読み込み
    if (saveResult.schemaFileName) {
      // プロジェクトマネージャーのスキーマファイル名を更新
      this.projectManager.setCurrentSchemaFile(saveResult.schemaFileName);
      
      // プロジェクトファイルのschemaFileを正しい値で更新（再保存）
      await this.projectManager.saveProject([], null);
      
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
    this.uiManager.renderSceneList([], null, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
    this.uiManager.updateCurrentSceneName('');
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
    this.updateTitle();
  }

  async saveProject() {
    // 現在のシーンを保存
    await this.saveCurrentScene();
    
    // プロジェクトファイルを保存（シーン一覧は含めない）
    const currentSceneId = this.sceneManager.getCurrentSceneId();
    const result = await this.projectManager.saveProject([], currentSceneId);
    
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
            _fileName: scene._fileName,
            metadata: scene.metadata || '',
            paragraphs: currentParagraphs
          });
          this.sceneManager.updateSceneParagraphs(scene.id, currentParagraphs);
        } else {
          // その他のシーンは既存のファイルからデータを読み込む
          let sceneParagraphs = [];
          
          // シーンファイルが存在する場合は、必ずファイルから読み込む
          if (scene.exists) {
            try {
              const loadResult = await window.electronAPI.loadScene(result.path, scene._fileName);
              if (loadResult.success && loadResult.data.paragraphs) {
                sceneParagraphs = loadResult.data.paragraphs;
              } else {
                console.warn(`シーン ${scene.name} のデータが空または無効です`);
                // ファイルが存在するが読み込めない場合は、現在のメモリデータを使用
                sceneParagraphs = scene.paragraphs || [];
              }
            } catch (error) {
              console.warn(`シーン ${scene.name} の読み込みに失敗しました:`, error);
              // エラーが発生した場合は、現在のメモリデータを使用
              sceneParagraphs = scene.paragraphs || [];
            }
          } else {
            // ファイルが存在しない場合は、メモリ上のデータを使用
            sceneParagraphs = scene.paragraphs || [];
          }
          
          await window.electronAPI.saveScene(result.path, scene.id, {
            id: scene.id,
            _fileName: scene._fileName,
            metadata: scene.metadata || '',
            paragraphs: sceneParagraphs
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
    // 文字列として渡された場合は整数に変換
    if (typeof draggedId === 'string') {
      draggedId = parseInt(draggedId);
    }
    if (typeof targetId === 'string') {
      targetId = parseInt(targetId);
    }
    
    // 移動前にUndo/Redo操作を作成
    const operation = new MoveBlockOperation(this.paragraphManager, this.uiManager, draggedId, targetId, insertAfter);
    
    // 実際の移動を実行
    if (this.paragraphManager.reorderParagraphs(draggedId, targetId, insertAfter)) {
      this.markAsChanged();
      this.uiManager.renderParagraphList();
      this.uiManager.updateParagraphSelection();
      
      // 履歴に追加（既に移動済みなのでskipExecute=true）
      this.historyManager.executeOperation(operation, true);
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
    
    // ブロックタイプ定義、構造体定義、列挙型定義を取得
    const blockTypes = this.blockTypeManager.getBlockTypes();
    const structs = this.blockTypeManager.getStructs();
    const enums = this.blockTypeManager.getEnums();
    
    await this.projectManager.exportAllScenesAsCSV(projectPath, scenes, blockTypes, structs, enums);
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
          console.warn(`シーンファイルが存在しません: ${scene._fileName}`);
          continue;
        }
        
        try {
          // シーンデータを読み込み
          const result = await window.electronAPI.loadScene(projectPath, scene._fileName);
          if (!result.success || !result.data.paragraphs) {
            console.warn(`シーン \"${scene.name}\" のデータが読み込めませんでした`);
            continue;
          }
          
          // テキストコンテンツを生成
          const textContent = this.generateSceneTextContent(result.data.paragraphs, format);
          
          sceneTexts.push({
            name: scene.name,
            fileName: scene._fileName,
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
        
        // 台本形式では「セリフ」と「モノローグ」のみを表示
        if (paragraph.type !== 'dialogue' && paragraph.type !== 'monologue') {
          return;
        }
        
        // セリフタイプの場合は話者名を表示（設定されている場合のみ）
        const characterName = paragraph.speaker || null;
        if (paragraph.type === 'dialogue' && characterName) {
          textContent += `${characterName}：\n`;
        } else if (paragraph.type === 'monologue' && characterName) {
          textContent += `${characterName}（心の声）：\n`;
        }
        
        // 末尾の改行や空行を除去
        const trimmedText = paragraph.text.replace(/[\n\r\s]*$/, '');
        
        // セリフの場合は台本形式では鍵カッコなし、地の文の場合はそのまま
        if (paragraph.type === 'dialogue') {
          textContent += `${trimmedText}\n\n`;
        } else if (paragraph.type === 'monologue') {
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
    
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (!selectedParagraph) return;
    
    // 変更前の状態を保存
    const oldData = JSON.parse(JSON.stringify(selectedParagraph));
    
    // UIを更新
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
    
    // 変更後の状態を保存してundo/redo操作を作成
    const newData = JSON.parse(JSON.stringify(selectedParagraph));
    const operation = new EditBlockOperation(
      this.paragraphManager,
      this.uiManager,
      selectedParagraph.id,
      oldData,
      newData
    );
    // 既に変更が適用されているので、executeをスキップ
    this.historyManager.executeOperation(operation, true);
    
    this.markAsChanged();
    this.uiManager.updateParagraphListItem(selectedParagraph);
  }

  // 編集開始時の状態を記録
  startEdit() {
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (selectedParagraph && !this.historyManager.isExecuting) {
      this.editStartState = JSON.parse(JSON.stringify(selectedParagraph));
    }
  }

  // 編集完了時にundo/redo操作を履歴に追加
  finishEdit() {
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (selectedParagraph && this.editStartState && !this.historyManager.isExecuting) {
      // 変更があった場合のみ履歴に追加
      const currentState = JSON.parse(JSON.stringify(selectedParagraph));
      if (JSON.stringify(this.editStartState) !== JSON.stringify(currentState)) {
        const operation = new EditBlockOperation(
          this.paragraphManager, 
          this.uiManager, 
          selectedParagraph.id, 
          this.editStartState, 
          currentState
        );
        this.historyManager.executeOperation(operation);
      }
    }
    this.editStartState = null;
  }

  updateCurrentParagraph() {
    const selectedParagraph = this.paragraphManager.getSelectedParagraph();
    if (!selectedParagraph) return;
    
    // 編集開始状態を記録（まだ記録されていない場合）
    if (!this.editStartState && !this.historyManager.isExecuting) {
      this.editStartState = JSON.parse(JSON.stringify(selectedParagraph));
    }
    
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
          // struct型かどうかを判定
          if (element.classList && element.classList.contains('struct-container')) {
            selectedParagraph[key] = this.uiManager.getStructValue(element);
          } else {
            selectedParagraph[key] = element.value;
          }
        }
      });
    }
    
    // 編集タイマーをリセット（一定時間後に自動的に履歴を作成）
    if (this.editTimer) {
      clearTimeout(this.editTimer);
    }
    this.editTimer = setTimeout(() => {
      this.finishEdit();
    }, 2000); // 2秒間編集がない場合に履歴を作成
    
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

  copyPreviewContent() {
    // 現在のプレビューフォーマットを取得
    const format = this.uiManager.getPreviewFormat().value;
    
    // プレビューマネージャーから適切なフォーマットのテキストを生成
    const textContent = this.previewManager.generateTextContent(format);
    
    if (textContent) {
      // クリップボードにコピー
      navigator.clipboard.writeText(textContent).then(() => {
        // コピー成功の視覚的フィードバック
        const copyButton = document.getElementById('copy-preview');
        const originalText = copyButton.textContent;
        copyButton.textContent = 'コピーしました！';
        copyButton.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
          copyButton.textContent = originalText;
          copyButton.style.backgroundColor = '';
        }, 2000);
      }).catch(err => {
        console.error('コピーに失敗しました:', err);
        alert('コピーに失敗しました');
      });
    }
  }

  // Undo操作
  undo() {
    // 編集中の場合は先に履歴を確定
    this.finishEdit();
    
    if (this.historyManager.undo()) {
      this.markAsChanged();
    }
  }

  // Redo操作
  redo() {
    // 編集中の場合は先に履歴を確定
    this.finishEdit();
    
    if (this.historyManager.redo()) {
      this.markAsChanged();
    }
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
      
      alert('スキーマファイルとキャラクターファイルを再読込しました');
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
    newScene._fileName = result.fileName;
    
    // 空のシーンデータを保存
    await window.electronAPI.saveScene(projectPath, newScene.id, {
      id: newScene.id,
      _fileName: newScene._fileName,
      metadata: '',
      paragraphs: []
    });
    
    this.sceneManager.markSceneAsExisting(newScene.id, true);
    this.sceneManager.selectScene(newScene.id);
    this.paragraphManager.setParagraphs([]);
    
    // シーン編集機能を有効化
    this.setSceneEditingEnabled(true);
    
    this.markAsChanged();
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), newScene.id, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
    this.uiManager.updateCurrentSceneName(newScene.name);
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
  }

  async selectScene(sceneId) {
    // 編集中の場合は履歴を確定
    this.finishEdit();
    
    // 現在のシーンを保存
    await this.saveCurrentScene();
    
    // シーン切り替え時にundo/redo履歴をクリア
    this.historyManager.clear();
    
    const scene = this.sceneManager.selectScene(sceneId);
    if (!scene) return;
    
    // シーンのデータをロード
    const projectPath = this.projectManager.getProjectPath();
    if (projectPath && scene.exists) {
      try {
        const result = await window.electronAPI.loadScene(projectPath, scene._fileName);
        if (result.success) {
          scene.paragraphs = result.data.paragraphs || [];
          scene.metadata = result.data.metadata || '';
          this.paragraphManager.setParagraphs(scene.paragraphs);
          // メタデータをUIに反映
          const metadataInput = document.getElementById('scene-metadata');
          metadataInput.value = scene.metadata;
          metadataInput.disabled = false;
        }
      } catch (error) {
        console.error('シーンの読み込みエラー:', error);
        this.paragraphManager.setParagraphs([]);
      }
    } else {
      this.paragraphManager.setParagraphs(scene.paragraphs || []);
      // メタデータをUIに反映
      const metadataInput = document.getElementById('scene-metadata');
      metadataInput.value = scene.metadata || '';
      metadataInput.disabled = false;
    }
    
    // シーン編集機能を有効化
    this.setSceneEditingEnabled(true);
    
    this.uiManager.renderSceneList(this.sceneManager.getScenes(), sceneId, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
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
    const renameResult = this.sceneManager.renameScene(sceneId, newName);
    if (renameResult.success) {
      this.markAsChanged();
      
      // ファイル名が変更された場合は、実際のファイルもリネーム
      if (renameResult.fileNameChanged) {
        const projectPath = this.projectManager.getProjectPath();
        if (projectPath) {
          try {
            await window.electronAPI.renameSceneFile(projectPath, sceneId, renameResult.oldFileName, renameResult.newFileName);
          } catch (error) {
            console.error('シーンファイルのリネームエラー:', error);
            // エラーが発生してもUI更新は続行
          }
        }
      }
      
      // 現在のシーンの場合は表示を更新
      if (sceneId === this.sceneManager.getCurrentSceneId()) {
        this.uiManager.updateCurrentSceneName(newName);
      }
      
      // シーンリストを再描画
      const currentSceneId = this.sceneManager.getCurrentSceneId();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), currentSceneId, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
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
          _fileName: currentScene._fileName,
          metadata: currentScene.metadata || '',
          paragraphs: paragraphs
        });
        this.sceneManager.markSceneAsExisting(currentScene.id, true);
      } catch (error) {
        console.error('シーンの保存エラー:', error);
      }
    }
  }

  updateSceneMetadata() {
    const currentScene = this.sceneManager.getCurrentScene();
    if (!currentScene) return;
    
    const metadataInput = document.getElementById('scene-metadata');
    const newMetadata = metadataInput.value;
    
    if (newMetadata !== currentScene.metadata) {
      this.sceneManager.updateSceneMetadata(currentScene.id, newMetadata);
      this.markAsChanged();
    }
  }

  async saveSceneMetadata() {
    const currentScene = this.sceneManager.getCurrentScene();
    if (!currentScene) return;
    
    const projectPath = this.projectManager.getProjectPath();
    if (projectPath) {
      try {
        await window.electronAPI.saveScene(projectPath, currentScene.id, {
          id: currentScene.id,
          _fileName: currentScene._fileName,
          metadata: currentScene.metadata || '',
          paragraphs: currentScene.paragraphs || []
        });
      } catch (error) {
        console.error('シーンメタデータの保存エラー:', error);
      }
    }
  }
  
  async deleteScene(sceneId, sceneName) {
    // 確認ダイアログを表示
    const confirmed = confirm(`シーン「${sceneName}」を削除しますか？\nこの操作は取り消せません。`);
    if (!confirmed) return;
    
    const projectPath = this.projectManager.getProjectPath();
    if (!projectPath) return;
    
    // 削除するシーンのファイル名を取得
    const scene = this.sceneManager.getScenes().find(s => s.id === sceneId);
    if (!scene) return;
    
    // 削除するシーンが現在のシーンかどうか
    const isCurrentScene = sceneId === this.sceneManager.getCurrentSceneId();
    
    // ファイルシステムから削除
    try {
      await window.electronAPI.deleteSceneFile(projectPath, scene._fileName);
    } catch (error) {
      console.error('シーンファイルの削除エラー:', error);
      alert(`シーンファイルの削除に失敗しました:\n${error.message}`);
      return;
    }
    
    // シーンを削除
    if (this.sceneManager.deleteScene(sceneId)) {
      this.markAsChanged();
      
      // 削除後のシーン一覧を取得
      const remainingScenes = this.sceneManager.getScenes();
      
      if (isCurrentScene) {
        // 現在のシーンを削除した場合
        if (remainingScenes.length > 0) {
          // 他のシーンがある場合は最初のシーンを選択
          await this.selectScene(remainingScenes[0].id);
        } else {
          // シーンがなくなった場合
          this.paragraphManager.setParagraphs([]);
          this.uiManager.updateCurrentSceneName('');
          this.uiManager.renderParagraphList();
          this.uiManager.showPlaceholder();
          this.setSceneEditingEnabled(false);
        }
      }
      
      // シーンリストを再描画
      const currentSceneId = this.sceneManager.getCurrentSceneId();
      this.uiManager.renderSceneList(remainingScenes, currentSceneId, 
        (sceneId) => this.selectScene(sceneId), 
        (sceneId, newName) => this.renameScene(sceneId, newName),
        (sceneId, sceneName) => this.deleteScene(sceneId, sceneName)
      );
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
      'migration',
      'add-scene',
      'import-text-file',
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
    
    // メタデータ入力の有効/無効化
    const metadataInput = document.getElementById('scene-metadata');
    if (metadataInput) {
      metadataInput.disabled = !enabled;
      if (!enabled) {
        metadataInput.value = '';
      }
    }
    
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
        _fileName: newScene._fileName,
        metadata: '',
        paragraphs: paragraphs
      });

      this.sceneManager.markSceneAsExisting(newScene.id, true);
      this.sceneManager.selectScene(newScene.id);
      this.paragraphManager.setParagraphs(paragraphs);

      // シーン編集機能を有効化
      this.setSceneEditingEnabled(true);

      this.markAsChanged();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), newScene.id, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
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

  showTextInputModal() {
    const modal = document.getElementById('text-input-modal');
    const sceneNameInput = document.getElementById('scene-name-input');
    const sceneTextInput = document.getElementById('scene-text-input');
    const createButton = document.getElementById('create-scene-from-text');
    const cancelButton = document.getElementById('cancel-text-input');
    const closeButton = document.getElementById('close-text-input');
    
    // 入力をクリア
    sceneNameInput.value = '';
    sceneTextInput.value = '';
    
    // モーダルを表示
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // フォーカスをシーン名入力に設定
    sceneNameInput.focus();
    
    // イベントハンドラー
    const handleCreate = () => this.createSceneFromText();
    const handleCancel = () => this.hideTextInputModal();
    const handleClose = () => this.hideTextInputModal();
    
    // 既存のイベントリスナーを削除
    createButton.removeEventListener('click', handleCreate);
    cancelButton.removeEventListener('click', handleCancel);
    closeButton.removeEventListener('click', handleClose);
    
    // 新しいイベントリスナーを追加
    createButton.addEventListener('click', handleCreate);
    cancelButton.addEventListener('click', handleCancel);
    closeButton.addEventListener('click', handleClose);
    
    // モーダル背景クリックで閉じる
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideTextInputModal();
      }
    });
  }

  hideTextInputModal() {
    const modal = document.getElementById('text-input-modal');
    modal.style.display = 'none';
    modal.classList.remove('show');
  }

  async createSceneFromText() {
    const sceneNameInput = document.getElementById('scene-name-input');
    const sceneTextInput = document.getElementById('scene-text-input');
    
    const sceneName = sceneNameInput.value.trim();
    const sceneText = sceneTextInput.value.trim();
    
    if (!sceneName) {
      alert('シーン名を入力してください');
      sceneNameInput.focus();
      return;
    }
    
    if (!sceneText) {
      alert('テキストを入力してください');
      sceneTextInput.focus();
      return;
    }
    
    try {
      const projectPath = this.projectManager.getProjectPath();
      if (!projectPath) {
        await this.newProject();
      }
      
      // テキストをブロックに変換
      const paragraphs = this.textImporter.importFromText(sceneText);
      
      if (paragraphs.length === 0) {
        alert('インポートできるブロックが見つかりませんでした');
        return;
      }
      
      // 現在のシーンを保存
      await this.saveCurrentScene();
      
      // 新しいシーンを作成
      const newScene = this.sceneManager.createScene(sceneName);
      
      // シーンファイルを保存
      await window.electronAPI.saveScene(this.projectManager.getProjectPath(), newScene.id, {
        id: newScene.id,
        _fileName: newScene._fileName,
        metadata: '',
        paragraphs: paragraphs
      });
      
      this.sceneManager.markSceneAsExisting(newScene.id, true);
      this.sceneManager.selectScene(newScene.id);
      this.paragraphManager.setParagraphs(paragraphs);
      
      // シーン編集機能を有効化
      this.setSceneEditingEnabled(true);
      
      this.markAsChanged();
      this.uiManager.renderSceneList(this.sceneManager.getScenes(), newScene.id, (sceneId) => this.selectScene(sceneId), (sceneId, newName) => this.renameScene(sceneId, newName), (sceneId, sceneName) => this.deleteScene(sceneId, sceneName));
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
      
      // モーダルを閉じる
      this.hideTextInputModal();
      
      alert(`${paragraphs.length}個のブロックでシーン「${sceneName}」を作成しました`);
      
    } catch (error) {
      console.error('シーン作成エラー:', error);
      alert(`シーンの作成に失敗しました\n\nエラー内容: ${error.message}`);
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
            if (!document.getElementById('import-text-file').disabled) {
              this.importTextAsScene();
            }
            break;
            
          case 'z':
            // Ctrl/Cmd + Z: Undo
            e.preventDefault();
            this.undo();
            break;
            
          case 'y':
            // Ctrl/Cmd + Y: Redo
            e.preventDefault();
            this.redo();
            break;
        }
      } else if (e.key === 'Escape') {
        // Escape: プレビューを閉じる
        if (this.previewManager.isPreviewOpen()) {
          e.preventDefault();
          this.previewManager.closePreview();
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // 矢印キー: ブロック選択の移動
        // テキストエリアやインプット要素にフォーカスがある場合はスキップ
        const activeElement = document.activeElement;
        const isTextInput = activeElement.tagName === 'TEXTAREA' || 
                          activeElement.tagName === 'INPUT' ||
                          activeElement.contentEditable === 'true';
        
        if (!isTextInput && this.paragraphManager.getParagraphs().length > 0) {
          e.preventDefault();
          
          let selectedParagraph;
          if (e.key === 'ArrowUp') {
            selectedParagraph = this.paragraphManager.selectPreviousParagraph();
          } else {
            selectedParagraph = this.paragraphManager.selectNextParagraph();
          }
          
          if (selectedParagraph) {
            this.uiManager.showEditor(selectedParagraph);
            this.uiManager.updateParagraphSelection();
            
            // 選択されたブロックを可視範囲にスクロール
            // 少し遅延させてDOMの更新を待つ
            setTimeout(() => {
              const selectedElement = document.querySelector(`[data-paragraph-id="${selectedParagraph.id}"]`);
              if (selectedElement) {
                // スクロールコンテナを取得
                const scrollContainer = document.querySelector('.paragraph-list-container');
                if (scrollContainer) {
                  const containerRect = scrollContainer.getBoundingClientRect();
                  const elementRect = selectedElement.getBoundingClientRect();
                  
                  // 要素がコンテナの可視範囲外にある場合のみスクロール
                  if (elementRect.top < containerRect.top) {
                    // 上に隠れている場合
                    const scrollAmount = elementRect.top - containerRect.top - 10;
                    scrollContainer.scrollTop += scrollAmount;
                  } else if (elementRect.bottom > containerRect.bottom) {
                    // 下に隠れている場合
                    const scrollAmount = elementRect.bottom - containerRect.bottom + 10;
                    scrollContainer.scrollTop += scrollAmount;
                  }
                }
              }
            }, 50);
          }
        }
      }
    });
  }
}

const scenarioManager = new ScenarioManager();

// グローバル参照を作成（メインプロセスからアクセス用）
window.scenarioManager = scenarioManager;
window.projectManager = scenarioManager.projectManager;