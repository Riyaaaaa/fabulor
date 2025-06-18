class ScenarioManager {
  constructor() {
    this.paragraphs = [];
    this.selectedParagraphId = null;
    this.projectPath = null;
    
    this.initializeUI();
    this.bindEvents();
  }
  
  generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  createParagraph(text = '', type = 'narrative', params = {}, tags = []) {
    const baseData = {
      id: this.generateGUID(),
      text: text,
      type: type,
      tags: tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    switch (type) {
      case 'dialogue':
        return {
          ...baseData,
          speaker: params.speaker || '',
          emotion: params.emotion || '',
          volume: params.volume || 'normal'
        };
      case 'narrative':
        return {
          ...baseData,
          perspective: params.perspective || 'third'
        };
      case 'description':
        return {
          ...baseData,
          target: params.target || '',
          detailLevel: params.detailLevel || 'normal'
        };
      case 'action':
        return {
          ...baseData,
          subject: params.subject || '',
          speed: params.speed || 'normal'
        };
      case 'thought':
        return {
          ...baseData,
          character: params.character || '',
          depth: params.depth || 'normal'
        };
      default:
        return baseData;
    }
  }
  
  initializeUI() {
    this.paragraphList = document.getElementById('paragraph-list');
    this.editorPlaceholder = document.getElementById('editor-placeholder');
    this.editorContainer = document.getElementById('editor-container');
    this.editorContent = document.getElementById('editor-content');
    this.paragraphIdSpan = document.getElementById('paragraph-id');
    this.tagsInput = document.getElementById('tags-input');
    
    this.typeSelect = document.getElementById('type-select');
    this.typeParamContainers = {
      narrative: document.getElementById('narrative-params'),
      dialogue: document.getElementById('dialogue-params'),
      description: document.getElementById('description-params'),
      action: document.getElementById('action-params'),
      thought: document.getElementById('thought-params')
    };
    
    this.typeParams = {
      narrative: {
        perspective: document.getElementById('narrative-perspective')
      },
      dialogue: {
        speaker: document.getElementById('speaker-input'),
        emotion: document.getElementById('emotion-select'),
        volume: document.getElementById('volume-select')
      },
      description: {
        target: document.getElementById('description-target'),
        detailLevel: document.getElementById('detail-level')
      },
      action: {
        subject: document.getElementById('action-subject'),
        speed: document.getElementById('action-speed')
      },
      thought: {
        character: document.getElementById('thought-character'),
        depth: document.getElementById('thought-depth')
      }
    };
    
    this.previewModal = document.getElementById('preview-modal');
    this.previewContent = document.getElementById('preview-content');
    this.previewFormat = document.getElementById('preview-format');
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
    
    Object.values(this.typeParams).forEach(params => {
      Object.values(params).forEach(element => {
        element.addEventListener('input', () => this.updateCurrentParagraph());
        element.addEventListener('change', () => this.updateCurrentParagraph());
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
    
    this.typeSelect.value = paragraph.type || 'narrative';
    this.showTypeParams(paragraph.type || 'narrative');
    this.loadTypeParams(paragraph);
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
  }
  
  async saveProject() {
    try {
      const projectData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        paragraphs: this.paragraphs
      };
      
      const result = await window.electronAPI.saveProject(projectData, this.projectPath);
      
      if (result.success) {
        this.projectPath = result.path;
        alert('プロジェクトを保存しました');
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
        this.renderParagraphList();
        this.showPlaceholder();
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
    
    if (!this.selectedParagraphId) return;
    
    const paragraph = this.paragraphs.find(p => p.id === this.selectedParagraphId);
    if (paragraph) {
      const oldType = paragraph.type;
      paragraph.type = newType;
      paragraph.updatedAt = new Date().toISOString();
      
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
    switch (type) {
      case 'dialogue':
        paragraph.speaker = paragraph.speaker || '';
        paragraph.emotion = paragraph.emotion || '';
        paragraph.volume = paragraph.volume || 'normal';
        break;
      case 'narrative':
        paragraph.perspective = paragraph.perspective || 'third';
        break;
      case 'description':
        paragraph.target = paragraph.target || '';
        paragraph.detailLevel = paragraph.detailLevel || 'normal';
        break;
      case 'action':
        paragraph.subject = paragraph.subject || '';
        paragraph.speed = paragraph.speed || 'normal';
        break;
      case 'thought':
        paragraph.character = paragraph.character || '';
        paragraph.depth = paragraph.depth || 'normal';
        break;
    }
  }
  
  updateCurrentParagraph() {
    if (!this.selectedParagraphId) return;
    
    const paragraph = this.paragraphs.find(p => p.id === this.selectedParagraphId);
    if (paragraph) {
      paragraph.text = this.editorContent.value;
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
    const labels = {
      narrative: 'ナレーション',
      dialogue: 'セリフ',
      description: '描写',
      action: 'アクション',
      thought: '心理描写'
    };
    return labels[type] || 'その他';
  }
  
  getMainInfo(paragraph) {
    switch (paragraph.type) {
      case 'dialogue':
        return paragraph.speaker || '(話者なし)';
      case 'narrative':
        return paragraph.perspective || 'third';
      case 'description':
        return paragraph.target || '(対象なし)';
      case 'action':
        return paragraph.subject || '(主体なし)';
      case 'thought':
        return paragraph.character || '(人物なし)';
      default:
        return '(情報なし)';
    }
  }
}

const scenarioManager = new ScenarioManager();