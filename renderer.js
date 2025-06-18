class ScenarioManager {
  constructor() {
    this.paragraphs = [];
    this.selectedParagraphId = null;
    this.projectPath = null;
    this.blockTypes = {};
    
    this.loadBlockTypes().then(() => {
      this.initializeUI();
      this.bindEvents();
      this.updateTitle();
    });
  }
  
  async loadBlockTypes() {
    try {
      const result = await window.electronAPI.loadBlockTypes();
      if (result.success) {
        this.blockTypes = result.data.block_types;
      } else {
        console.error('スキーマファイルの読み込みに失敗:', result.error);
        // フォールバック用のデフォルト設定
        this.blockTypes = {
          dialogue: { label: 'セリフ', requires_text: true, parameters: {} },
          narrative: { label: '地の文', requires_text: true, parameters: {} },
          command: { label: 'コマンド', requires_text: false, parameters: {} }
        };
      }
    } catch (error) {
      console.error('スキーマファイル読み込みエラー:', error);
    }
  }

  async loadSchemaFile(projectPath, schemaFileName) {
    try {
      const result = await window.electronAPI.loadSchemaFile(projectPath, schemaFileName);
      if (result.success) {
        this.blockTypes = result.data.block_types;
      } else {
        console.error('スキーマファイルの読み込みに失敗:', result.error);
        alert(`スキーマファイル "${schemaFileName}" の読み込みに失敗しました。デフォルト設定を使用します。`);
        // フォールバック用のデフォルト設定
        this.blockTypes = {
          dialogue: { label: 'セリフ', requires_text: true, parameters: {} },
          narrative: { label: '地の文', requires_text: true, parameters: {} },
          command: { label: 'コマンド', requires_text: false, parameters: {} }
        };
      }
    } catch (error) {
      console.error('スキーマファイル読み込みエラー:', error);
    }
  }

  generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  createParagraph(text = '', type = 'dialogue', params = {}, tags = []) {
    const baseData = {
      id: this.generateGUID(),
      text: text,
      type: type,
      tags: tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // ブロックタイプ定義からデフォルト値を設定
    const blockType = this.blockTypes[type];
    if (blockType && blockType.parameters) {
      Object.entries(blockType.parameters).forEach(([paramName, paramDef]) => {
        baseData[paramName] = params[paramName] || paramDef.default || '';
      });
    }
    
    return baseData;
  }
  
  initializeUI() {
    this.paragraphList = document.getElementById('paragraph-list');
    this.editorPlaceholder = document.getElementById('editor-placeholder');
    this.editorContainer = document.getElementById('editor-container');
    this.editorContent = document.getElementById('editor-content');
    this.paragraphIdSpan = document.getElementById('paragraph-id');
    this.tagsInput = document.getElementById('tags-input');
    
    this.typeSelect = document.getElementById('type-select');
    this.previewModal = document.getElementById('preview-modal');
    this.previewContent = document.getElementById('preview-content');
    this.previewFormat = document.getElementById('preview-format');
    
    // ブロックタイプ定義からUIを動的生成
    this.generateTypeUI();
  }
  
  generateTypeUI() {
    // タイプセレクトのオプションを生成
    this.typeSelect.innerHTML = '';
    Object.entries(this.blockTypes).forEach(([typeKey, typeDef]) => {
      const option = document.createElement('option');
      option.value = typeKey;
      option.textContent = typeDef.label;
      this.typeSelect.appendChild(option);
    });

    // 既存のパラメータコンテナを削除
    const existingContainers = document.querySelectorAll('.type-params');
    existingContainers.forEach(container => container.remove());

    // 新しいパラメータコンテナを動的生成
    this.typeParamContainers = {};
    this.typeParams = {};
    const metadataDiv = document.querySelector('.metadata');

    Object.entries(this.blockTypes).forEach(([typeKey, typeDef]) => {
      // パラメータコンテナを作成
      const container = document.createElement('div');
      container.id = `${typeKey}-params`;
      container.className = 'type-params';
      container.style.display = 'none';

      this.typeParamContainers[typeKey] = container;
      this.typeParams[typeKey] = {};

      if (Object.keys(typeDef.parameters).length === 0) {
        // パラメータがない場合は情報メッセージを表示
        const infoP = document.createElement('p');
        infoP.className = 'type-info';
        infoP.textContent = `${typeDef.label}には追加設定項目はありません`;
        container.appendChild(infoP);
      } else {
        // パラメータがある場合は入力要素を生成
        Object.entries(typeDef.parameters).forEach(([paramKey, paramDef]) => {
          const label = document.createElement('label');
          label.textContent = paramDef.label + ':';

          let inputElement;
          if (paramDef.type === 'text') {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.placeholder = paramDef.placeholder || '';
          } else if (paramDef.type === 'number') {
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.placeholder = paramDef.placeholder || '';
            if (paramDef.min !== undefined) inputElement.min = paramDef.min;
            if (paramDef.step !== undefined) inputElement.step = paramDef.step;
          } else if (paramDef.type === 'select') {
            inputElement = document.createElement('select');
            paramDef.options.forEach(option => {
              const optionElement = document.createElement('option');
              optionElement.value = option.value;
              optionElement.textContent = option.label;
              inputElement.appendChild(optionElement);
            });
          }

          inputElement.id = `${typeKey}-${paramKey}`;
          this.typeParams[typeKey][paramKey] = inputElement;

          label.appendChild(inputElement);
          container.appendChild(label);
        });
      }

      // タグ入力の前に挿入
      metadataDiv.insertBefore(container, document.querySelector('label:last-child'));
    });
  }

  bindEvents() {
    document.getElementById('add-paragraph').addEventListener('click', () => this.addParagraph());
    document.getElementById('delete-paragraph').addEventListener('click', () => this.deleteParagraph());
    document.getElementById('new-project').addEventListener('click', () => this.newProject());
    document.getElementById('save-project').addEventListener('click', () => this.saveProject());
    document.getElementById('open-project').addEventListener('click', () => this.openProject());
    document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('preview-novel').addEventListener('click', () => this.showPreview());
    
    this.editorContent.addEventListener('input', () => this.updateCurrentParagraph());
    this.tagsInput.addEventListener('input', () => this.updateCurrentParagraph());
    this.typeSelect.addEventListener('change', () => this.onTypeChange());
    
    this.bindSchemaEvents();
  }

  bindSchemaEvents() {
    // 動的に生成されたパラメータ要素にイベントリスナーを追加
    Object.values(this.typeParams).forEach(params => {
      Object.values(params).forEach(element => {
        if (element) {
          element.addEventListener('input', () => this.updateCurrentParagraph());
          element.addEventListener('change', () => this.updateCurrentParagraph());
        }
      });
    });
    
    document.getElementById('close-preview').addEventListener('click', () => this.closePreview());
    this.previewFormat.addEventListener('change', () => this.updatePreview());
    
    this.previewModal.addEventListener('click', (e) => {
      if (e.target === this.previewModal) {
        this.closePreview();
      }
    });
  }
  
  addParagraph() {
    const newParagraph = this.createParagraph();
    this.paragraphs.push(newParagraph);
    this.renderParagraphList();
    this.selectParagraph(newParagraph.id);
  }
  
  deleteParagraph() {
    if (!this.selectedParagraphId) return;
    
    const index = this.paragraphs.findIndex(p => p.id === this.selectedParagraphId);
    if (index !== -1) {
      this.paragraphs.splice(index, 1);
      this.selectedParagraphId = null;
      this.renderParagraphList();
      this.showPlaceholder();
    }
  }
  
  selectParagraph(id) {
    this.selectedParagraphId = id;
    const paragraph = this.paragraphs.find(p => p.id === id);
    
    if (paragraph) {
      this.showEditor(paragraph);
      this.updateParagraphSelection();
    }
  }
  
  showEditor(paragraph) {
    this.editorPlaceholder.style.display = 'none';
    this.editorContainer.style.display = 'block';
    
    paragraph = this.migrateParagraph(paragraph);
    
    this.paragraphIdSpan.textContent = `ID: ${paragraph.id}`;
    this.editorContent.value = paragraph.text;
    this.tagsInput.value = paragraph.tags.join(', ');
    
    this.typeSelect.value = paragraph.type || 'dialogue';
    this.showTypeParams(paragraph.type || 'dialogue');
    this.loadTypeParams(paragraph);
    
    // ブロックタイプ定義に基づいてテキスト入力を制御
    const blockType = this.blockTypes[paragraph.type];
    if (blockType && !blockType.requires_text) {
      this.editorContent.disabled = true;
      this.editorContent.placeholder = `${blockType.label}にテキストは不要です`;
      this.editorContent.value = '';
    } else {
      this.editorContent.disabled = false;
      this.editorContent.placeholder = 'ここにテキストを入力...';
    }
  }
  
  showPlaceholder() {
    this.editorPlaceholder.style.display = 'flex';
    this.editorContainer.style.display = 'none';
  }
  
  updateCurrentParagraph() {
    if (!this.selectedParagraphId) return;
    
    const paragraph = this.paragraphs.find(p => p.id === this.selectedParagraphId);
    if (paragraph) {
      paragraph.text = this.editorContent.value;
      paragraph.speaker = this.speakerInput.value;
      paragraph.tags = this.tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
      paragraph.updatedAt = new Date().toISOString();
      
      this.updateParagraphListItem(paragraph);
    }
  }
  
  renderParagraphList() {
    this.paragraphList.innerHTML = '';
    
    this.paragraphs.forEach(paragraph => {
      const item = this.createParagraphListItem(paragraph);
      this.paragraphList.appendChild(item);
    });
  }
  
  createParagraphListItem(paragraph) {
    const item = document.createElement('div');
    item.className = 'paragraph-item';
    item.dataset.id = paragraph.id;
    
    const title = document.createElement('h3');
    title.textContent = paragraph.speaker || '(話者なし)';
    
    const preview = document.createElement('p');
    preview.textContent = paragraph.text || '(テキストなし)';
    
    item.appendChild(title);
    item.appendChild(preview);
    
    item.addEventListener('click', () => this.selectParagraph(paragraph.id));
    
    return item;
  }
  
  updateParagraphListItem(paragraph) {
    const item = this.paragraphList.querySelector(`[data-id="${paragraph.id}"]`);
    if (item) {
      item.querySelector('h3').textContent = paragraph.speaker || '(話者なし)';
      item.querySelector('p').textContent = paragraph.text || '(テキストなし)';
    }
  }
  
  updateParagraphSelection() {
    const items = this.paragraphList.querySelectorAll('.paragraph-item');
    items.forEach(item => {
      if (item.dataset.id === this.selectedParagraphId) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }
  
  newProject() {
    if (this.paragraphs.length > 0) {
      const confirmed = confirm('現在のプロジェクトを破棄して新規作成しますか？');
      if (!confirmed) return;
    }
    
    this.paragraphs = [];
    this.selectedParagraphId = null;
    this.projectPath = null;
    this.renderParagraphList();
    this.showPlaceholder();
    this.updateTitle();
  }
  
  async saveProject() {
    try {
      const projectData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        schemaFile: 'block-types.yaml',
        paragraphs: this.paragraphs
      };
      
      const result = await window.electronAPI.saveProject(projectData, this.projectPath);
      
      if (result.success) {
        this.projectPath = result.path;
        alert('プロジェクトを保存しました');
        this.updateTitle();
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
    }
  }
  
  async openProject() {
    try {
      const result = await window.electronAPI.openProject();
      
      if (result.success) {
        this.paragraphs = result.data.paragraphs || [];
        this.projectPath = result.path;
        this.selectedParagraphId = null;
        
        // スキーマファイルをロード
        const schemaFile = result.data.schemaFile || 'block-types.yaml';
        await this.loadSchemaFile(result.path, schemaFile);
        
        // UIを再生成してからデータを表示
        this.generateTypeUI();
        this.bindSchemaEvents();
        this.renderParagraphList();
        this.showPlaceholder();
        this.updateTitle();
      }
    } catch (error) {
      console.error('読み込みエラー:', error);
      alert('読み込みに失敗しました');
    }
  }
  
  async exportJSON() {
    try {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        paragraphs: this.paragraphs.map(p => ({
          id: p.id,
          text: p.text,
          speaker: p.speaker,
          tags: p.tags
        }))
      };
      
      const result = await window.electronAPI.exportJSON(exportData);
      
      if (result.success) {
        alert('JSONファイルをエクスポートしました');
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert('エクスポートに失敗しました');
    }
  }
  
  showPreview() {
    if (this.paragraphs.length === 0) {
      alert('プレビューできる段落がありません');
      return;
    }
    
    this.previewModal.style.display = 'flex';
    this.updatePreview();
  }
  
  closePreview() {
    this.previewModal.style.display = 'none';
  }
  
  updatePreview() {
    const format = this.previewFormat.value;
    this.previewContent.className = `preview-content ${format}-format`;
    
    if (format === 'novel') {
      this.renderNovelFormat();
    } else if (format === 'script') {
      this.renderScriptFormat();
    }
  }
  
  renderNovelFormat() {
    this.previewContent.innerHTML = '';
    
    this.paragraphs.forEach(paragraph => {
      if (!paragraph.text.trim()) return;
      
      const paragraphDiv = document.createElement('div');
      paragraphDiv.className = 'paragraph';
      
      if (paragraph.speaker && paragraph.speaker.trim()) {
        paragraphDiv.classList.add('dialogue');
      }
      
      paragraphDiv.textContent = paragraph.text;
      this.previewContent.appendChild(paragraphDiv);
    });
  }
  
  renderScriptFormat() {
    this.previewContent.innerHTML = '';
    
    this.paragraphs.forEach(paragraph => {
      if (!paragraph.text.trim()) return;
      
      const paragraphDiv = document.createElement('div');
      paragraphDiv.className = 'paragraph';
      
      if (paragraph.speaker && paragraph.speaker.trim()) {
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker';
        speakerDiv.textContent = paragraph.speaker;
        paragraphDiv.appendChild(speakerDiv);
      }
      
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      textDiv.textContent = paragraph.text;
      paragraphDiv.appendChild(textDiv);
      
      this.previewContent.appendChild(paragraphDiv);
    });
  }
  
  migrateParagraph(paragraph) {
    if (!paragraph.type) {
      paragraph.type = paragraph.speaker ? 'dialogue' : 'narrative';
    }
    
    const index = this.paragraphs.findIndex(p => p.id === paragraph.id);
    if (index !== -1) {
      this.paragraphs[index] = paragraph;
    }
    
    return paragraph;
  }
  
  onTypeChange() {
    const newType = this.typeSelect.value;
    this.showTypeParams(newType);
    
    // ブロックタイプ定義に基づいてテキスト入力を制御
    const blockType = this.blockTypes[newType];
    if (blockType && !blockType.requires_text) {
      this.editorContent.disabled = true;
      this.editorContent.placeholder = `${blockType.label}にテキストは不要です`;
      this.editorContent.value = '';
    } else {
      this.editorContent.disabled = false;
      this.editorContent.placeholder = 'ここにテキストを入力...';
    }
    
    if (!this.selectedParagraphId) return;
    
    const paragraph = this.paragraphs.find(p => p.id === this.selectedParagraphId);
    if (paragraph) {
      const oldType = paragraph.type;
      paragraph.type = newType;
      paragraph.updatedAt = new Date().toISOString();
      
      // テキストが不要なタイプに変更した場合はテキストをクリア
      const blockType = this.blockTypes[newType];
      if (blockType && !blockType.requires_text) {
        paragraph.text = '';
      }
      
      this.clearTypeParams(oldType);
      this.setDefaultParams(paragraph, newType);
      this.loadTypeParams(paragraph);
      this.updateParagraphListItem(paragraph);
    }
  }
  
  showTypeParams(type) {
    Object.entries(this.typeParamContainers).forEach(([key, container]) => {
      container.style.display = key === type ? 'flex' : 'none';
    });
  }
  
  loadTypeParams(paragraph) {
    const type = paragraph.type;
    if (!this.typeParams[type]) return;
    
    Object.entries(this.typeParams[type]).forEach(([key, element]) => {
      if (element && paragraph[key] !== undefined) {
        element.value = paragraph[key];
      }
    });
  }
  
  clearTypeParams(type) {
    if (!this.typeParams[type]) return;
    
    Object.values(this.typeParams[type]).forEach(element => {
      if (element) {
        element.value = '';
      }
    });
  }
  
  setDefaultParams(paragraph, type) {
    const blockType = this.blockTypes[type];
    if (blockType && blockType.parameters) {
      Object.entries(blockType.parameters).forEach(([paramName, paramDef]) => {
        if (paragraph[paramName] === undefined) {
          paragraph[paramName] = paramDef.default || '';
        }
      });
    }
  }
  
  updateCurrentParagraph() {
    if (!this.selectedParagraphId) return;
    
    const paragraph = this.paragraphs.find(p => p.id === this.selectedParagraphId);
    if (paragraph) {
      // テキストが必要なタイプの場合のみテキストを更新
      const blockType = this.blockTypes[paragraph.type];
      if (blockType && blockType.requires_text) {
        paragraph.text = this.editorContent.value;
      }
      paragraph.tags = this.tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
      paragraph.updatedAt = new Date().toISOString();
      
      const type = paragraph.type;
      if (this.typeParams[type]) {
        Object.entries(this.typeParams[type]).forEach(([key, element]) => {
          if (element) {
            paragraph[key] = element.value;
          }
        });
      }
      
      this.updateParagraphListItem(paragraph);
    }
  }
  
  createParagraphListItem(paragraph) {
    const item = document.createElement('div');
    item.className = 'paragraph-item';
    item.dataset.id = paragraph.id;
    
    const title = document.createElement('h3');
    const typeLabel = this.getTypeLabel(paragraph.type);
    const mainInfo = this.getMainInfo(paragraph);
    title.textContent = `${typeLabel}: ${mainInfo}`;
    
    const preview = document.createElement('p');
    preview.textContent = paragraph.text || '(テキストなし)';
    
    item.appendChild(title);
    item.appendChild(preview);
    
    item.addEventListener('click', () => this.selectParagraph(paragraph.id));
    
    return item;
  }
  
  updateParagraphListItem(paragraph) {
    const item = this.paragraphList.querySelector(`[data-id="${paragraph.id}"]`);
    if (item) {
      const typeLabel = this.getTypeLabel(paragraph.type);
      const mainInfo = this.getMainInfo(paragraph);
      item.querySelector('h3').textContent = `${typeLabel}: ${mainInfo}`;
      item.querySelector('p').textContent = paragraph.text || '(テキストなし)';
    }
  }
  
  getTypeLabel(type) {
    const blockType = this.blockTypes[type];
    return blockType ? blockType.label : 'その他';
  }
  
  getMainInfo(paragraph) {
    const blockType = this.blockTypes[paragraph.type];
    if (!blockType) return '(情報なし)';
    
    // 最初のパラメータの値を表示するか、タイプ名を表示
    const params = blockType.parameters;
    const paramKeys = Object.keys(params);
    
    if (paramKeys.length > 0) {
      const firstParamKey = paramKeys[0];
      const value = paragraph[firstParamKey];
      if (value) {
        return value;
      }
    }
    
    return blockType.label;
  }
  
  updateTitle() {
    const titleElement = document.title;
    const headerTitle = document.querySelector('header h1');
    
    if (this.projectPath) {
      const fileName = this.projectPath.split('/').pop().replace('.fbl', '');
      const newTitle = `Fabulor - ${fileName}`;
      document.title = newTitle;
      if (headerTitle) {
        headerTitle.textContent = newTitle;
      }
    } else {
      document.title = 'Fabulor - 無題のプロジェクト';
      if (headerTitle) {
        headerTitle.textContent = 'Fabulor - 無題のプロジェクト';
      }
    }
  }
}

const scenarioManager = new ScenarioManager();