// シンプルなメタコマンドハイライト機能
class SimpleHighlighter {
  constructor(metaTagParser) {
    this.metaTagParser = metaTagParser;
  }

  // テキストエリアの下に色付きプレビューを表示
  addHighlightPreview(textArea) {
    if (!textArea) return;

    // 既存のプレビューを削除
    this.removeHighlightPreview(textArea);

    const text = textArea.value;
    if (!text) return;

    const metaTags = this.metaTagParser.parseMetaTags(text);
    console.log('SimpleHighlighter: Found meta tags:', metaTags);

    if (metaTags.length === 0) return;

    // プレビューエリアを作成
    const preview = document.createElement('div');
    preview.className = 'meta-command-preview';

    // ハイライトされたテキストを生成
    let html = '';
    let lastIndex = 0;

    metaTags.forEach(metaTag => {
      // メタタグ前のテキスト
      if (metaTag.position > lastIndex) {
        const beforeText = text.substring(lastIndex, metaTag.position);
        html += this.escapeHtml(beforeText);
      }

      // メタタグをハイライト
      const isError = !metaTag.isValid;
      let className = '';
      
      if (isError) {
        className = 'meta-error';
      } else {
        className = `meta-${metaTag.type}`;
      }
      
      html += `<span class="${className}" title="${this.getTooltipText(metaTag)}">${this.escapeHtml(metaTag.tag)}</span>`;
      
      lastIndex = metaTag.position + metaTag.length;
    });

    // 最後のメタタグ以降のテキスト
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      html += this.escapeHtml(remainingText);
    }

    preview.innerHTML = html;
    
    // テキストエリアの後に挿入
    textArea.parentElement.insertBefore(preview, textArea.nextSibling);

    // テキストエリアにイベントリスナー追加
    if (!textArea.dataset.highlighterAttached) {
      textArea.addEventListener('input', () => {
        this.addHighlightPreview(textArea);
      });
      textArea.dataset.highlighterAttached = 'true';
    }
  }

  removeHighlightPreview(textArea) {
    const existing = textArea.parentElement.querySelector('.meta-command-preview');
    if (existing) {
      existing.remove();
    }
  }

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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export { SimpleHighlighter };