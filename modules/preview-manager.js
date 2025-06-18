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
      
      if (paragraph.speaker && paragraph.speaker.trim()) {
        paragraphDiv.classList.add('dialogue');
      }
      
      // 改行を<br>タグに変換してHTMLとして設定（HTMLエスケープも行う）
      const escapedText = this.escapeHtml(paragraph.text);
      const textWithBreaks = escapedText.replace(/\n/g, '<br>');
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
      
      if (paragraph.speaker && paragraph.speaker.trim()) {
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker';
        speakerDiv.textContent = paragraph.speaker;
        paragraphDiv.appendChild(speakerDiv);
      }
      
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      // 改行を<br>タグに変換してHTMLとして設定（HTMLエスケープも行う）
      const escapedText = this.escapeHtml(paragraph.text);
      const textWithBreaks = escapedText.replace(/\n/g, '<br>');
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
}

export { PreviewManager };