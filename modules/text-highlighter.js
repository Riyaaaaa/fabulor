// テキストハイライト機能モジュール
class TextHighlighter {
  constructor(metaTagParser) {
    this.metaTagParser = metaTagParser;
  }

  // テキストエリアにメタコマンドのハイライトを適用
  highlightTextArea(textArea) {
    if (!textArea) {
      console.log('TextHighlighter: textArea is null');
      return;
    }

    const text = textArea.value;
    console.log('TextHighlighter: Highlighting text:', text);
    
    const metaTags = this.metaTagParser.parseMetaTags(text);
    console.log('TextHighlighter: Found meta tags:', metaTags);
    
    // ハイライト用のオーバーレイ要素を作成/取得
    let overlay = this.getOrCreateOverlay(textArea);
    
    // スタイルを再同期（位置ずれ防止）
    this.syncOverlayStyles(overlay, textArea);
    
    // メタタグがない場合も通常テキストを表示
    this.renderHighlights(overlay, text, metaTags, textArea);
    console.log('TextHighlighter: Highlighting applied');
  }

  // ハイライト用のオーバーレイ要素を取得または作成
  getOrCreateOverlay(textArea) {
    let wrapper = textArea.parentElement;
    
    // wrapperがtext-input-wrapperでない場合は作成
    if (!wrapper.classList.contains('text-input-wrapper')) {
      const newWrapper = document.createElement('div');
      newWrapper.className = 'text-input-wrapper';
      textArea.parentElement.insertBefore(newWrapper, textArea);
      newWrapper.appendChild(textArea);
      wrapper = newWrapper;
    }
    
    let overlay = wrapper.querySelector('.text-highlight-overlay');
    
    if (!overlay) {
      // オーバーレイ要素を作成
      overlay = document.createElement('div');
      overlay.className = 'text-highlight-overlay';
      wrapper.appendChild(overlay);
      
      // テキストエリアのスタイルを同期
      this.syncOverlayStyles(overlay, textArea);
      
      // テキストエリアのイベントリスナーを追加（重複防止）
      if (!textArea.dataset.textHighlighterAttached) {
        textArea.addEventListener('input', () => {
          this.highlightTextArea(textArea);
        });
        
        textArea.addEventListener('scroll', () => {
          overlay.scrollTop = textArea.scrollTop;
          overlay.scrollLeft = textArea.scrollLeft;
        });
        
        // リサイズ時の再同期
        const resizeObserver = new ResizeObserver(() => {
          this.syncOverlayStyles(overlay, textArea);
        });
        resizeObserver.observe(textArea);
        
        textArea.dataset.textHighlighterAttached = 'true';
      }
    }
    
    return overlay;
  }

  // オーバーレイのスタイルをテキストエリアと同期
  syncOverlayStyles(overlay, textArea) {
    const computedStyle = window.getComputedStyle(textArea);
    
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    
    // テキストエリアと全く同じサイズと位置
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    
    // パディングを正確にコピー
    overlay.style.paddingLeft = computedStyle.paddingLeft;
    overlay.style.paddingRight = computedStyle.paddingRight;
    overlay.style.paddingTop = computedStyle.paddingTop;
    overlay.style.paddingBottom = computedStyle.paddingBottom;
    
    // ボーダーとマージンをリセット
    overlay.style.border = 'none';
    overlay.style.margin = '0';
    
    // フォント関連を完全同期
    overlay.style.fontSize = computedStyle.fontSize;
    overlay.style.fontFamily = computedStyle.fontFamily;
    overlay.style.fontWeight = computedStyle.fontWeight;
    overlay.style.fontStyle = computedStyle.fontStyle;
    overlay.style.fontVariant = computedStyle.fontVariant;
    overlay.style.lineHeight = computedStyle.lineHeight;
    overlay.style.letterSpacing = computedStyle.letterSpacing;
    overlay.style.wordSpacing = computedStyle.wordSpacing;
    overlay.style.textIndent = computedStyle.textIndent;
    overlay.style.textAlign = computedStyle.textAlign;
    overlay.style.textTransform = computedStyle.textTransform;
    overlay.style.direction = computedStyle.direction;
    overlay.style.unicodeBidi = computedStyle.unicodeBidi;
    
    overlay.style.whiteSpace = computedStyle.whiteSpace;
    overlay.style.wordWrap = computedStyle.wordWrap;
    overlay.style.wordBreak = computedStyle.wordBreak;
    overlay.style.overflowWrap = computedStyle.overflowWrap;
    overlay.style.tabSize = computedStyle.tabSize;
    overlay.style.overflow = 'hidden';
    overlay.style.pointerEvents = 'none';
    overlay.style.backgroundColor = 'transparent';
    overlay.style.color = '#e0e0e0';  // 通常テキストも表示
    overlay.style.zIndex = '10';  // オーバーレイを最前面に
    overlay.style.boxSizing = computedStyle.boxSizing;
    
    // テキストエリアの背景を透明にしてオーバーレイを見えるように
    textArea.style.position = 'relative';
    textArea.style.zIndex = '5';  // テキストエリアを中間層に（カーソル表示のため）
    textArea.style.backgroundColor = 'transparent';
    textArea.style.color = 'transparent';  // テキストを透明にしてオーバーレイのテキストのみ表示
    textArea.style.caretColor = '#e0e0e0';  // カーソルの色を明示的に設定
    
    console.log('...オーバーレイスタイル同期完了');
  }

  // ハイライトを描画
  renderHighlights(overlay, text, metaTags, textArea) {
    let html = '';
    let lastIndex = 0;
    
    if (metaTags.length === 0) {
      // メタタグがない場合は全テキストをそのまま表示
      html = this.escapeHtml(text);
    } else {
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
    }
    
    overlay.innerHTML = html;
  }

  // ハイライトされたメタタグのHTMLを作成
  createHighlightedTag(metaTag) {
    const isError = !metaTag.isValid;
    let className = 'meta-overlay-base';
    
    if (isError) {
      className += ' meta-overlay-error';
    } else {
      className += ` meta-overlay-${metaTag.type}`;
    }
    
    // 文字幅を変更しないよう、余分な装飾は最小限に
    return `<span class="${className}">${this.escapeHtml(metaTag.tag)}</span>`;
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