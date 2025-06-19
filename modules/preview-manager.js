// プレビュー管理モジュール
class PreviewManager {
  constructor(paragraphManager, uiManager) {
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
  }

  showPreview() {
    const paragraphs = this.paragraphManager.getParagraphs();
    if (paragraphs.length === 0) {
      alert('プレビューできる段落がありません');
      return;
    }
    
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.classList.add('show');
    this.updatePreview();
  }

  closePreview() {
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.classList.remove('show');
  }

  updatePreview() {
    const previewFormat = this.uiManager.getPreviewFormat();
    const previewContent = this.uiManager.getPreviewContent();
    const format = previewFormat.value;
    previewContent.className = `preview-content ${format}-format`;
    
    if (format === 'novel') {
      this.renderNovelFormat();
    } else if (format === 'script') {
      this.renderScriptFormat();
    }
  }

  renderNovelFormat() {
    const previewContent = this.uiManager.getPreviewContent();
    previewContent.innerHTML = '';
    
    const paragraphs = this.paragraphManager.getParagraphs();
    paragraphs.forEach(paragraph => {
      if (!paragraph.text.trim()) return;
      
      const paragraphDiv = document.createElement('div');
      paragraphDiv.className = 'paragraph';
      
      // セリフタイプのブロックは話者の有無に関わらず鍵カッコを表示
      if (paragraph.type === 'dialogue') {
        paragraphDiv.classList.add('dialogue');
      } else if (paragraph.type === 'monologue') {
        paragraphDiv.classList.add('monologue');
      }
      
      // 改行を<br>タグに変換してHTMLとして設定（HTMLエスケープも行う）
      const escapedText = this.escapeHtml(paragraph.text);
      // 末尾の改行や空行を除去してから<br>タグに変換
      const trimmedText = escapedText.replace(/[\n\r\s]*$/, '');
      const textWithBreaks = trimmedText.replace(/\n/g, '<br>');
      paragraphDiv.innerHTML = textWithBreaks;
      previewContent.appendChild(paragraphDiv);
    });
  }

  renderScriptFormat() {
    const previewContent = this.uiManager.getPreviewContent();
    previewContent.innerHTML = '';
    
    const paragraphs = this.paragraphManager.getParagraphs();
    paragraphs.forEach(paragraph => {
      if (!paragraph.text.trim()) return;
      
      const paragraphDiv = document.createElement('div');
      paragraphDiv.className = 'paragraph';
      
      // セリフタイプの場合は話者名を表示（設定されている場合のみ）
      if (paragraph.type === 'dialogue' && paragraph.speaker && paragraph.speaker.trim()) {
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker';
        speakerDiv.textContent = paragraph.speaker;
        paragraphDiv.appendChild(speakerDiv);
      } else if (paragraph.type === 'monologue' && paragraph.speaker && paragraph.speaker.trim()) {
        // モノローグの場合は話者名に（心の声）を追加
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker monologue-speaker';
        speakerDiv.textContent = `${paragraph.speaker}（心の声）`;
        paragraphDiv.appendChild(speakerDiv);
      }
      
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      // 改行を<br>タグに変換してHTMLとして設定（HTMLエスケープも行う）
      const escapedText = this.escapeHtml(paragraph.text);
      // 末尾の改行や空行を除去してから<br>タグに変換
      const trimmedText = escapedText.replace(/[\n\r\s]*$/, '');
      const textWithBreaks = trimmedText.replace(/\n/g, '<br>');
      textDiv.innerHTML = textWithBreaks;
      paragraphDiv.appendChild(textDiv);
      
      previewContent.appendChild(paragraphDiv);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // テキスト形式でのプレビュー内容生成
  generateTextContent(format = 'novel') {
    const paragraphs = this.paragraphManager.getParagraphs();
    if (paragraphs.length === 0) {
      return '';
    }

    let textContent = '';
    
    if (format === 'novel') {
      paragraphs.forEach(paragraph => {
        if (!paragraph.text.trim()) return;
        
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
        if (!paragraph.text.trim()) return;
        
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

}

export { PreviewManager };