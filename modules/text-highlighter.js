// テキストハイライト機能モジュール
class TextHighlighter {
  constructor(metaTagParser) {
    this.metaTagParser = metaTagParser;
  }

  // テキストエリアにメタコマンドのハイライトを適用
  highlightTextArea(textArea) {
    if (!textArea) return;

    const text = textArea.value;
    const metaTags = this.metaTagParser.parseMetaTags(text);
    
    // 既存のハイライト要素をクリア
    this.clearHighlights(textArea);
    
    if (metaTags.length === 0) return;

    // ハイライト用のオーバーレイ要素を作成/取得
    let overlay = this.getOrCreateOverlay(textArea);
    
    // メタタグをハイライト表示
    this.renderHighlights(overlay, text, metaTags, textArea);
  }

  // ハイライト用のオーバーレイ要素を取得または作成
  getOrCreateOverlay(textArea) {
    const wrapper = textArea.parentElement;
    let overlay = wrapper.querySelector('.text-highlight-overlay');
    
    if (!overlay) {
      // テキストエリアを相対位置のコンテナでラップ
      if (!wrapper.classList.contains('text-input-wrapper')) {
        const newWrapper = document.createElement('div');
        newWrapper.className = 'text-input-wrapper';
        textArea.parentElement.insertBefore(newWrapper, textArea);
        newWrapper.appendChild(textArea);
      }
      
      // オーバーレイ要素を作成
      overlay = document.createElement('div');
      overlay.className = 'text-highlight-overlay';
      wrapper.appendChild(overlay);
      
      // テキストエリアのスタイルを同期
      this.syncOverlayStyles(overlay, textArea);
      
      // テキストエリアのイベントリスナーを追加
      textArea.addEventListener('input', () => {
        this.highlightTextArea(textArea);
      });
      
      textArea.addEventListener('scroll', () => {
        overlay.scrollTop = textArea.scrollTop;
        overlay.scrollLeft = textArea.scrollLeft;
      });
    }
    
    return overlay;
  }

  // オーバーレイのスタイルをテキストエリアと同期
  syncOverlayStyles(overlay, textArea) {
    const computedStyle = window.getComputedStyle(textArea);
    
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = textArea.offsetWidth + 'px';
    overlay.style.height = textArea.offsetHeight + 'px';
    overlay.style.padding = computedStyle.padding;
    overlay.style.border = computedStyle.border;
    overlay.style.fontSize = computedStyle.fontSize;
    overlay.style.fontFamily = computedStyle.fontFamily;
    overlay.style.lineHeight = computedStyle.lineHeight;
    overlay.style.whiteSpace = 'pre-wrap';
    overlay.style.wordWrap = 'break-word';
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.color = 'transparent';
    overlay.style.zIndex = '1';
    
    // テキストエリアの背景を透明にしてオーバーレイを見えるように
    textArea.style.position = 'relative';
    textArea.style.zIndex = '2';
    textArea.style.backgroundColor = 'transparent';
  }

  // ハイライトを描画
  renderHighlights(overlay, text, metaTags, textArea) {
    let html = '';
    let lastIndex = 0;
    
    metaTags.forEach(metaTag => {
      // メタタグ前のテキスト
      if (metaTag.position > lastIndex) {
        const beforeText = text.substring(lastIndex, metaTag.position);
        html += this.escapeHtml(beforeText);
      }
      
      // メタタグ自体をハイライト
      const tagHtml = this.createHighlightedTag(metaTag);
      html += tagHtml;
      
      lastIndex = metaTag.position + metaTag.length;
    });
    
    // 最後のメタタグ以降のテキスト
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      html += this.escapeHtml(remainingText);
    }
    
    overlay.innerHTML = html;
  }

  // ハイライトされたメタタグのHTMLを作成
  createHighlightedTag(metaTag) {
    const color = metaTag.color;
    const isError = !metaTag.isValid;
    
    let style = `color: ${color}; font-weight: bold;`;
    
    if (isError) {
      // エラーの場合は赤い波線を追加
      style += ` text-decoration: underline wavy ${this.metaTagParser.settings.error_color};`;
    }
    
    return `<span style="${style}" title="${this.getTooltipText(metaTag)}">${this.escapeHtml(metaTag.tag)}</span>`;
  }

  // ツールチップテキストを生成
  getTooltipText(metaTag) {
    if (!metaTag.isValid) {
      return `エラー: 不明なメタコマンド "${metaTag.type}"`;
    }
    
    const command = this.metaTagParser.metaCommands[metaTag.type];
    if (command) {
      return `${command.description}\n構文: ${command.syntax}`;
    }
    
    return metaTag.type;
  }

  // HTMLエスケープ
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ハイライトをクリア
  clearHighlights(textArea) {
    const wrapper = textArea.parentElement;
    const overlay = wrapper.querySelector('.text-highlight-overlay');
    if (overlay) {
      overlay.innerHTML = '';
    }
  }

  // すべてのハイライトを削除
  removeAllHighlights(textArea) {
    const wrapper = textArea.parentElement;
    const overlay = wrapper.querySelector('.text-highlight-overlay');
    if (overlay) {
      overlay.remove();
    }
    
    // テキストエリアのスタイルを元に戻す
    textArea.style.backgroundColor = '';
  }
}

export { TextHighlighter };