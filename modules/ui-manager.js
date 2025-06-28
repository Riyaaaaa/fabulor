// UI管理モジュール
class UIManager {
  constructor(blockTypeManager, paragraphManager, projectManager) {
    this.blockTypeManager = blockTypeManager;
    this.paragraphManager = paragraphManager;
    this.projectManager = projectManager;
    this.typeParamContainers = {};
    this.typeParams = {};
    this.draggedElement = null; // グローバルなドラッグ状態
    
    this.initializeElements();
  }

  initializeElements() {
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
    this.sceneList = document.getElementById('scene-list');
    this.currentSceneName = document.getElementById('current-scene-name');
  }

  generateTypeUI() {
    // タイプセレクトのオプションを生成
    this.typeSelect.innerHTML = '';
    const blockTypes = this.blockTypeManager.getBlockTypes();
    Object.entries(blockTypes).forEach(([typeKey, typeDef]) => {
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

    Object.entries(blockTypes).forEach(([typeKey, typeDef]) => {
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
          if (paramDef.type === 'text' || paramDef.type === 'string') {
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.placeholder = paramDef.placeholder || '';
          } else if (paramDef.type === 'number' || paramDef.type === 'integer' || paramDef.type === 'int') {
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.placeholder = paramDef.placeholder || '';
            if (paramDef.min !== undefined) inputElement.min = paramDef.min;
            if (paramDef.step !== undefined) inputElement.step = paramDef.step;
          } else if (paramDef.type === 'boolean') {
            inputElement = document.createElement('select');
            // falseオプション
            const falseOption = document.createElement('option');
            falseOption.value = 'false';
            falseOption.textContent = 'いいえ';
            inputElement.appendChild(falseOption);
            // trueオプション
            const trueOption = document.createElement('option');
            trueOption.value = 'true';
            trueOption.textContent = 'はい';
            inputElement.appendChild(trueOption);
          } else if (paramDef.type === 'select') {
            inputElement = document.createElement('select');
            paramDef.options.forEach(option => {
              const optionElement = document.createElement('option');
              optionElement.value = option.value;
              optionElement.textContent = option.label;
              inputElement.appendChild(optionElement);
            });
          } else if (this.blockTypeManager.isValidEnumType(paramDef.type)) {
            // enum型の場合は選択リストを作成
            inputElement = this.createEnumSelectElement(paramDef.type);
          } else if (this.blockTypeManager.isValidStructType(paramDef.type)) {
            // struct型の場合は複合入力UI要素を作成
            inputElement = this.createStructInputElement(paramDef.type, typeKey, paramKey);
          } else {
            // 未知の型の場合はテキスト入力として扱う
            inputElement = document.createElement('input');
            inputElement.type = 'text';
            inputElement.placeholder = `未対応の型: ${paramDef.type}`;
          }

          inputElement.id = `${typeKey}-${paramKey}`;
          this.typeParams[typeKey][paramKey] = inputElement;

          label.appendChild(inputElement);
          container.appendChild(label);
        });
      }

      // メタデータセクションに追加
      metadataDiv.appendChild(container);
    });
  }

  showEditor(paragraph) {
    this.editorPlaceholder.style.display = 'none';
    this.editorContainer.style.display = 'block';
    
    paragraph = this.paragraphManager.migrateParagraph(paragraph);
    
    this.paragraphIdSpan.textContent = `ID: ${paragraph.id}`;
    this.editorContent.value = paragraph.text;
    this.tagsInput.value = paragraph.tags.join(', ');
    
    this.typeSelect.value = paragraph.type || 'dialogue';
    this.showTypeParams(paragraph.type || 'dialogue');
    this.loadTypeParams(paragraph);
    
    // ブロックタイプ定義に基づいてテキスト入力を制御
    const blockType = this.blockTypeManager.getBlockType(paragraph.type);
    if (blockType && !blockType.requires_text) {
      this.editorContent.style.display = 'none';
      this.editorContent.value = '';
    } else {
      this.editorContent.style.display = 'block';
      this.editorContent.disabled = false;
      this.editorContent.placeholder = 'ここにテキストを入力...';
    }
    
    // メタコマンドハイライトを適用
    if (window.scenarioManager && window.metaCommandsLoaded) {
      setTimeout(() => {
        console.log('...エディタコンテンツにハイライト適用');
        if (window.scenarioManager.textHighlighter) {
          window.scenarioManager.textHighlighter.highlightTextArea(this.editorContent);
        }
      }, 10);
    } else if (window.scenarioManager) {
      // メタコマンドの読み込み完了を待機
      setTimeout(() => {
        if (window.metaCommandsLoaded) {
          console.log('...遅延ハイライト適用');
          if (window.scenarioManager.textHighlighter) {
            window.scenarioManager.textHighlighter.highlightTextArea(this.editorContent);
          }
        }
      }, 100);
    }
  }

  showPlaceholder() {
    this.editorPlaceholder.style.display = 'flex';
    this.editorContainer.style.display = 'none';
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
        // struct型かどうかを判定
        if (element.classList && element.classList.contains('struct-container')) {
          this.setStructValue(element, paragraph[key]);
        } else {
          element.value = paragraph[key];
        }
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

  renderParagraphList() {
    this.paragraphList.innerHTML = '';
    
    const paragraphs = this.paragraphManager.getParagraphs();
    paragraphs.forEach((paragraph, index) => {
      const item = this.createParagraphListItem(paragraph, index + 1);
      this.paragraphList.appendChild(item);
    });
  }

  createParagraphListItem(paragraph, blockNumber) {
    const item = document.createElement('div');
    item.className = 'paragraph-item';
    item.dataset.id = paragraph.id;
    item.dataset.paragraphId = paragraph.id;
    item.draggable = true;
    
    const blockNumberElem = document.createElement('div');
    blockNumberElem.className = 'block-number';
    blockNumberElem.textContent = blockNumber || '';
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'ドラッグして並び替え';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'paragraph-item-content';
    
    const title = document.createElement('h3');
    const typeLabel = this.blockTypeManager.getTypeLabel(paragraph.type);
    const mainInfo = this.paragraphManager.getMainInfo(paragraph);
    title.textContent = `${typeLabel}: ${mainInfo}`;
    
    const preview = document.createElement('p');
    preview.textContent = paragraph.text || '(テキストなし)';
    
    contentWrapper.appendChild(title);
    contentWrapper.appendChild(preview);
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'paragraph-delete-button';
    deleteButton.textContent = '×';
    deleteButton.title = '削除';
    
    item.appendChild(blockNumberElem);
    item.appendChild(dragHandle);
    item.appendChild(contentWrapper);
    item.appendChild(deleteButton);
    
    contentWrapper.addEventListener('click', () => {
      const selectedParagraph = this.paragraphManager.selectParagraph(paragraph.id);
      if (selectedParagraph) {
        this.showEditor(selectedParagraph);
        this.updateParagraphSelection();
      }
    });
    
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.deleteParagraphHandler) {
        window.deleteParagraphHandler(paragraph.id);
      }
    });
    
    // ドラッグ&ドロップイベント
    this.addDragAndDropListeners(item);
    
    return item;
  }

  addDragAndDropListeners(item) {
    // ドラッグ開始
    item.addEventListener('dragstart', (e) => {
      this.draggedElement = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });
    
    // ドラッグ終了
    item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      document.querySelectorAll('.paragraph-item').forEach(el => {
        el.classList.remove('drag-over-above', 'drag-over-below');
      });
      this.draggedElement = null;
    });
    
    // ドラッグオーバー
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      if (this.draggedElement && this.draggedElement !== item) {
        // 他のアイテムのドラッグオーバー状態をクリア
        document.querySelectorAll('.paragraph-item').forEach(el => {
          el.classList.remove('drag-over-above', 'drag-over-below');
        });
        
        // マウス位置に基づいて挿入位置を決定
        const rect = item.getBoundingClientRect();
        const mouseY = e.clientY;
        const itemCenterY = rect.top + rect.height / 2;
        
        if (mouseY < itemCenterY) {
          // マウスが上半分にある場合：要素の上に挿入
          item.classList.add('drag-over-above');
        } else {
          // マウスが下半分にある場合：要素の下に挿入
          item.classList.add('drag-over-below');
        }
      }
    });
    
    // ドロップ
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      
      if (this.draggedElement && this.draggedElement !== item) {
        const draggedId = parseInt(this.draggedElement.dataset.id);
        const targetId = parseInt(item.dataset.id);
        
        // マウス位置に基づいて挿入位置を決定
        const rect = item.getBoundingClientRect();
        const mouseY = e.clientY;
        const itemCenterY = rect.top + rect.height / 2;
        
        let insertAfter = false;
        if (mouseY >= itemCenterY) {
          // マウスが下半分にある場合：要素の後に挿入
          insertAfter = true;
        }
        
        if (window.reorderParagraphHandler) {
          window.reorderParagraphHandler(draggedId, targetId, insertAfter);
        }
      }
      
      item.classList.remove('drag-over-above', 'drag-over-below');
    });
    
    // ドラッグリーブ
    item.addEventListener('dragleave', (e) => {
      if (!item.contains(e.relatedTarget)) {
        item.classList.remove('drag-over-above', 'drag-over-below');
      }
    });
  }

  updateParagraphListItem(paragraph) {
    const item = this.paragraphList.querySelector(`[data-id="${paragraph.id}"]`);
    if (item) {
      const typeLabel = this.blockTypeManager.getTypeLabel(paragraph.type);
      const mainInfo = this.paragraphManager.getMainInfo(paragraph);
      item.querySelector('h3').textContent = `${typeLabel}: ${mainInfo}`;
      item.querySelector('p').textContent = paragraph.text || '(テキストなし)';
    }
  }

  updateParagraphSelection() {
    const items = this.paragraphList.querySelectorAll('.paragraph-item');
    const selectedId = this.paragraphManager.getSelectedParagraphId();
    items.forEach(item => {
      if (parseInt(item.dataset.id) === selectedId) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  getTypeParams() {
    return this.typeParams;
  }

  getEditorContent() {
    return this.editorContent;
  }

  getTagsInput() {
    return this.tagsInput;
  }

  getTypeSelect() {
    return this.typeSelect;
  }

  getPreviewModal() {
    return this.previewModal;
  }

  getPreviewContent() {
    return this.previewContent;
  }

  getPreviewFormat() {
    return this.previewFormat;
  }

  renderSceneList(scenes, currentSceneId, sceneClickHandler, sceneRenameHandler, sceneDeleteHandler) {
    this.sceneList.innerHTML = '';
    
    scenes.forEach(scene => {
      const item = document.createElement('div');
      item.className = 'scene-item';
      item.dataset.id = scene.id;
      
      if (scene.id === currentSceneId) {
        item.classList.add('selected');
      }
      
      if (!scene.exists) {
        item.classList.add('missing');
      }
      
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'scene-item-content';
      
      const title = document.createElement('h3');
      title.textContent = scene.name;
      
      const info = document.createElement('p');
      info.textContent = scene.fileName;
      
      contentWrapper.appendChild(title);
      contentWrapper.appendChild(info);
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'scene-delete-button';
      deleteButton.textContent = '×';
      deleteButton.title = '削除';
      
      item.appendChild(contentWrapper);
      item.appendChild(deleteButton);
      
      // クリックイベントの遅延処理でダブルクリックとの競合を防ぐ
      let clickTimer = null;
      
      contentWrapper.addEventListener('click', (e) => {
        if (e.target === title || title.contains(e.target)) {
          // タイトル部分のクリックは遅延処理
          if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
          }
          clickTimer = setTimeout(() => {
            sceneClickHandler(scene.id);
            clickTimer = null;
          }, 300);
        } else {
          // タイトル以外の部分は即座に処理
          sceneClickHandler(scene.id);
        }
      });
      
      // 削除ボタンのクリックイベント
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sceneDeleteHandler) {
          sceneDeleteHandler(scene.id, scene.name);
        }
      });
      
      // ダブルクリックで編集モードに入る
      title.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        // クリックタイマーをクリア
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        this.makeSceneNameEditable(title, scene, sceneRenameHandler);
      });
      
      this.sceneList.appendChild(item);
    });
  }

  makeSceneNameEditable(titleElement, scene, sceneRenameHandler) {
    const originalName = scene.name;
    
    // 入力フィールドを作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.className = 'scene-name-input';
    
    // タイトル要素を入力フィールドに置き換え
    titleElement.style.display = 'none';
    titleElement.parentNode.insertBefore(input, titleElement.nextSibling);
    
    // 入力フィールドにフォーカスして全選択
    input.focus();
    input.select();
    
    const saveChanges = () => {
      const newName = input.value.trim();
      if (newName && newName !== originalName) {
        sceneRenameHandler(scene.id, newName);
      }
      // 元の表示に戻す
      titleElement.style.display = '';
      input.remove();
    };
    
    const cancelChanges = () => {
      // 元の表示に戻す
      titleElement.style.display = '';
      input.remove();
    };
    
    // Enterキーで保存、Escapeキーでキャンセル
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveChanges();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelChanges();
      }
    });
    
    // フォーカスが外れたら保存（ただし、少し遅延させて意図しないblurを防ぐ）
    input.addEventListener('blur', () => {
      setTimeout(saveChanges, 100);
    });
  }

  updateCurrentSceneName(sceneName) {
    if (this.currentSceneName) {
      this.currentSceneName.textContent = sceneName ? `現在のシーン: ${sceneName}` : 'シーンが選択されていません';
    }
  }


  // struct型のパラメータ用UI要素を作成
  createStructInputElement(structType, typeKey, paramKey) {
    const structDef = this.blockTypeManager.getStruct(structType);
    if (!structDef || !structDef.properties) {
      console.error(`Struct definition not found: ${structType}`);
      const errorElement = document.createElement('div');
      errorElement.textContent = `Struct "${structType}" が見つかりません`;
      errorElement.style.color = 'red';
      return errorElement;
    }

    // struct全体を包むコンテナ
    const structContainer = document.createElement('div');
    structContainer.className = 'struct-container';
    structContainer.style.border = '1px solid #ccc';
    structContainer.style.padding = '10px';
    structContainer.style.margin = '5px 0';
    structContainer.style.borderRadius = '4px';
    structContainer.style.backgroundColor = '#f9f9f9';

    // structの名前を表示
    const structTitle = document.createElement('div');
    structTitle.className = 'struct-title';
    structTitle.textContent = structType;
    structTitle.style.fontWeight = 'bold';
    structTitle.style.marginBottom = '8px';
    structTitle.style.color = '#333';
    structContainer.appendChild(structTitle);

    // struct内のプロパティごとに入力要素を作成
    Object.entries(structDef.properties).forEach(([propKey, propDef]) => {
      const propContainer = document.createElement('div');
      propContainer.className = 'struct-property';
      propContainer.style.marginBottom = '8px';

      const label = document.createElement('label');
      label.textContent = (propDef.label || propKey) + ':';
      label.style.display = 'block';
      label.style.marginBottom = '2px';
      label.style.fontSize = '0.9em';

      let inputElement;
      // プロパティの型に応じて入力要素を作成
      if (propDef.type === 'string' || propDef.type === 'text') {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = propDef.placeholder || '';
        if (propDef.default !== undefined) {
          inputElement.value = propDef.default;
        }
      } else if (propDef.type === 'number' || propDef.type === 'integer' || propDef.type === 'int') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        if (propDef.min !== undefined) inputElement.min = propDef.min;
        if (propDef.max !== undefined) inputElement.max = propDef.max;
        if (propDef.step !== undefined) inputElement.step = propDef.step;
        if (propDef.default !== undefined) {
          inputElement.value = propDef.default;
        }
      } else if (propDef.type === 'boolean') {
        inputElement = document.createElement('select');
        // falseオプション
        const falseOption = document.createElement('option');
        falseOption.value = 'false';
        falseOption.textContent = 'いいえ';
        inputElement.appendChild(falseOption);
        // trueオプション
        const trueOption = document.createElement('option');
        trueOption.value = 'true';
        trueOption.textContent = 'はい';
        inputElement.appendChild(trueOption);
        if (propDef.default !== undefined) {
          inputElement.value = propDef.default.toString();
        }
      } else if (propDef.type === 'select' && propDef.options) {
        inputElement = document.createElement('select');
        propDef.options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.label;
          inputElement.appendChild(optionElement);
        });
        if (propDef.default !== undefined) {
          inputElement.value = propDef.default;
        }
      } else {
        // 未対応の型はテキスト入力として扱う
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.placeholder = `型: ${propDef.type}`;
        if (propDef.default !== undefined) {
          inputElement.value = propDef.default;
        }
      }

      // 入力要素にIDを設定（struct内プロパティ用の特別な形式）
      inputElement.id = `${typeKey}-${paramKey}-${propKey}`;
      inputElement.dataset.structType = structType;
      inputElement.dataset.propertyKey = propKey;
      inputElement.style.width = '100%';
      inputElement.style.padding = '4px';
      inputElement.style.border = '1px solid #ddd';
      inputElement.style.borderRadius = '2px';

      label.appendChild(inputElement);
      propContainer.appendChild(label);
      structContainer.appendChild(propContainer);
    });

    return structContainer;
  }

  // enum型の選択リストを作成
  createEnumSelectElement(enumType) {
    const enumDef = this.blockTypeManager.getEnum(enumType);
    if (!enumDef || !enumDef.fields) {
      console.error(`Enum definition not found: ${enumType}`);
      const errorElement = document.createElement('select');
      const errorOption = document.createElement('option');
      errorOption.value = '';
      errorOption.textContent = `Enum "${enumType}" が見つかりません`;
      errorElement.appendChild(errorOption);
      return errorElement;
    }

    const selectElement = document.createElement('select');
    
    // 空のオプションを追加
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '選択してください';
    selectElement.appendChild(emptyOption);

    // enum定義からオプションを作成
    enumDef.fields.forEach(field => {
      const optionElement = document.createElement('option');
      optionElement.value = field.name;
      optionElement.textContent = field.label || field.name;
      selectElement.appendChild(optionElement);
    });

    return selectElement;
  }

  // struct型パラメータの値を取得
  getStructValue(structContainer) {
    const structValue = {};
    const propertyInputs = structContainer.querySelectorAll('input, select');
    
    propertyInputs.forEach(input => {
      const propertyKey = input.dataset.propertyKey;
      if (propertyKey) {
        structValue[propertyKey] = input.value;
      }
    });
    
    return structValue;
  }

  // struct型パラメータに値を設定
  setStructValue(structContainer, structValue) {
    if (!structValue || typeof structValue !== 'object') {
      return;
    }
    
    const propertyInputs = structContainer.querySelectorAll('input, select');
    propertyInputs.forEach(input => {
      const propertyKey = input.dataset.propertyKey;
      if (propertyKey && structValue[propertyKey] !== undefined) {
        input.value = structValue[propertyKey];
      }
    });
  }

  // 指定したtypeの全パラメータ値を取得（struct型対応）
  getTypeParamValues(type) {
    const values = {};
    if (!this.typeParams[type]) return values;
    
    Object.entries(this.typeParams[type]).forEach(([key, element]) => {
      if (element) {
        // struct型かどうかを判定
        if (element.classList && element.classList.contains('struct-container')) {
          values[key] = this.getStructValue(element);
        } else {
          values[key] = element.value;
        }
      }
    });
    
    return values;
  }
}

export { UIManager };