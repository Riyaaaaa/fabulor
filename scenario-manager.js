// メインのシナリオ管理クラス
import { BlockTypeManager } from './modules/block-types.js';
import { ProjectManager } from './modules/project-manager.js';
import { ParagraphManager } from './modules/paragraph-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { PreviewManager } from './modules/preview-manager.js';

class ScenarioManager {
  constructor() {
    this.blockTypeManager = new BlockTypeManager();
    this.projectManager = new ProjectManager();
    this.paragraphManager = new ParagraphManager(this.blockTypeManager);
    this.uiManager = new UIManager(this.blockTypeManager, this.paragraphManager, this.projectManager);
    this.previewManager = new PreviewManager(this.paragraphManager, this.uiManager);
    
    this.initializeUI();
    this.bindEvents();
    this.updateTitle();
  }

  initializeUI() {
    this.uiManager.generateTypeUI();
  }

  bindEvents() {
    document.getElementById('add-paragraph').addEventListener('click', () => this.addParagraph());
    document.getElementById('delete-paragraph').addEventListener('click', () => this.deleteParagraph());
    document.getElementById('new-project').addEventListener('click', () => this.newProject());
    document.getElementById('save-project').addEventListener('click', () => this.saveProject());
    document.getElementById('open-project').addEventListener('click', () => this.openProject());
    document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('preview-novel').addEventListener('click', () => this.previewManager.showPreview());
    document.getElementById('reload-schema').addEventListener('click', () => this.reloadSchema());
    
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
    const paragraphs = this.paragraphManager.getParagraphs();
    if (paragraphs.length > 0) {
      const confirmed = confirm('現在のプロジェクトを破棄して新規作成しますか？');
      if (!confirmed) return;
    }
    
    this.paragraphManager.setParagraphs([]);
    await this.projectManager.newProject();
    this.uiManager.renderParagraphList();
    this.uiManager.showPlaceholder();
    this.updateTitle();
  }

  async saveProject() {
    const paragraphs = this.paragraphManager.getParagraphs();
    const result = await this.projectManager.saveProject(paragraphs);
    if (result.success) {
      this.updateTitle();
    }
  }

  async openProject() {
    const result = await this.projectManager.openProject();
    
    if (result.success) {
      this.paragraphManager.setParagraphs(result.data.paragraphs || []);
      
      // スキーマファイルをロード
      await this.blockTypeManager.loadSchemaFile(result.path, result.schemaFile);
      
      // UIを再生成してからデータを表示
      this.uiManager.generateTypeUI();
      this.bindSchemaEvents();
      this.uiManager.renderParagraphList();
      this.uiManager.showPlaceholder();
      this.updateTitle();
    }
  }

  async exportJSON() {
    const paragraphs = this.paragraphManager.getParagraphs();
    await this.projectManager.exportJSON(paragraphs);
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
}

const scenarioManager = new ScenarioManager();