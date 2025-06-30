import { MetaTagParser } from './meta-tag-parser.js';

// プレビュー管理モジュール
class PreviewManager {
  constructor(paragraphManager, uiManager) {
    this.paragraphManager = paragraphManager;
    this.uiManager = uiManager;
    this.metaTagParser = new MetaTagParser();
  }

  showPreview() {
    const paragraphs = this.paragraphManager.getParagraphs();
    if (paragraphs.length === 0) {
      alert('プレビューできる段落がありません');
      return;
    }
    
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.style.display = 'flex';  // style属性を直接設定
    previewModal.classList.add('show');
    this.updatePreview();
  }

  closePreview() {
    const previewModal = this.uiManager.getPreviewModal();
    previewModal.style.display = 'none';  // style属性を直接設定
    previewModal.classList.remove('show');
  }
  
  isPreviewOpen() {
    const previewModal = this.uiManager.getPreviewModal();
    return previewModal.classList.contains('show');
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
      
      // メタタグを除去してからHTMLエスケープ
      const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
      const escapedText = this.escapeHtml(textWithoutMetaTags);
      // 末尾の改行や空行を除去してから<br>タグに変換
      const trimmedText = escapedText.replace(/[\n\r\s]*$/, '');
      const textWithBreaks = trimmedText.replace(/\n/g, '<br>');
      
      // セリフタイプのブロックは話者の有無に関わらず鍵カッコを表示
      if (paragraph.type === 'dialogue') {
        paragraphDiv.classList.add('dialogue');
      } else if (paragraph.type === 'monologue') {
        paragraphDiv.classList.add('monologue');
      }
      
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
      
      // 台本形式では「セリフ」と「モノローグ」のみを表示
      if (paragraph.type !== 'dialogue' && paragraph.type !== 'monologue') {
        return;
      }
      
      const paragraphDiv = document.createElement('div');
      paragraphDiv.className = 'paragraph';
      
      // セリフタイプの場合は話者名を表示（設定されている場合のみ）
      const characterName = this.getCharacterName(paragraph);
      if (paragraph.type === 'dialogue' && characterName) {
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker';
        speakerDiv.textContent = characterName;
        paragraphDiv.appendChild(speakerDiv);
      } else if (paragraph.type === 'monologue' && characterName) {
        // モノローグの場合は話者名に（心の声）を追加
        const speakerDiv = document.createElement('div');
        speakerDiv.className = 'speaker monologue-speaker';
        speakerDiv.textContent = `${characterName}（心の声）`;
        paragraphDiv.appendChild(speakerDiv);
      }
      
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      // メタタグを除去してからHTMLエスケープ
      const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
      const escapedText = this.escapeHtml(textWithoutMetaTags);
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

  // 話者名を取得するヘルパーメソッド
  getCharacterName(paragraph) {
    return paragraph.speaker || null;
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
          // メタタグを除去してから末尾の改行や空行を除去
          const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
          const trimmedText = textWithoutMetaTags.replace(/[\n\r\s]*$/, '');
          textContent += `「${trimmedText}」\n\n`;
        } else if (paragraph.type === 'monologue') {
          // モノローグは（）で囲む
          const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
          const trimmedText = textWithoutMetaTags.replace(/[\n\r\s]*$/, '');
          textContent += `（${trimmedText}）\n\n`;
        } else {
          // 地の文など
          // メタタグを除去してから末尾の改行や空行を除去
          const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
          const trimmedText = textWithoutMetaTags.replace(/[\n\r\s]*$/, '');
          textContent += `　${trimmedText}\n\n`;
        }
      });
    } else if (format === 'script') {
      paragraphs.forEach(paragraph => {
        if (!paragraph.text.trim()) return;
        
        // 台本形式では「セリフ」と「モノローグ」のみを表示
        if (paragraph.type !== 'dialogue' && paragraph.type !== 'monologue') {
          return;
        }
        
        // セリフタイプの場合は話者名を表示（設定されている場合のみ）
        const characterName = this.getCharacterName(paragraph);
        if (paragraph.type === 'dialogue' && characterName) {
          textContent += `${characterName}：\n`;
        } else if (paragraph.type === 'monologue' && characterName) {
          textContent += `${characterName}（心の声）：\n`;
        }
        
        // メタタグを除去してから末尾の改行や空行を除去
        const textWithoutMetaTags = this.metaTagParser.removeMetaTags(paragraph.text);
        const trimmedText = textWithoutMetaTags.replace(/[\n\r\s]*$/, '');
        
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

}

export { PreviewManager };