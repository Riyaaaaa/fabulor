// カラムリサイズ管理モジュール

class ResizeManager {
  constructor() {
    this.resizeHandles = [];
    this.currentHandle = null;
    this.startX = 0;
    this.startWidths = {};
    this.minWidths = {
      projectSidebar: 200,
      sidebar: 250,
      editor: 400
    };
    
    this.initializeResizeHandles();
    this.loadSavedWidths();
  }

  initializeResizeHandles() {
    // 最初のリサイズハンドル（プロジェクトサイドバーとブロックリストの間）
    const handle1 = document.getElementById('resize-handle-1');
    if (handle1) {
      this.resizeHandles.push({
        element: handle1,
        leftPanel: '.project-sidebar',
        rightPanel: '.sidebar'
      });
    }

    // 2番目のリサイズハンドル（ブロックリストとエディタの間）
    const handle2 = document.getElementById('resize-handle-2');
    if (handle2) {
      this.resizeHandles.push({
        element: handle2,
        leftPanel: '.sidebar',
        rightPanel: '.editor'
      });
    }

    // 各ハンドルにイベントリスナーを追加
    this.resizeHandles.forEach(handle => {
      handle.element.addEventListener('mousedown', (e) => this.startResize(e, handle));
    });

    // ドキュメント全体のイベントリスナー
    document.addEventListener('mousemove', (e) => this.doResize(e));
    document.addEventListener('mouseup', () => this.stopResize());
  }

  startResize(e, handle) {
    e.preventDefault();
    this.currentHandle = handle;
    this.startX = e.clientX;
    
    // 現在の幅を記録
    const leftPanel = document.querySelector(handle.leftPanel);
    const rightPanel = document.querySelector(handle.rightPanel);
    
    if (leftPanel && rightPanel) {
      this.startWidths = {
        left: leftPanel.offsetWidth,
        right: rightPanel.offsetWidth
      };
    }

    // リサイズ中のスタイルを追加
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.element.classList.add('resizing');
  }

  doResize(e) {
    if (!this.currentHandle) return;

    const leftPanel = document.querySelector(this.currentHandle.leftPanel);
    const rightPanel = document.querySelector(this.currentHandle.rightPanel);
    
    if (!leftPanel || !rightPanel) return;

    const deltaX = e.clientX - this.startX;
    const newLeftWidth = this.startWidths.left + deltaX;
    const newRightWidth = this.startWidths.right - deltaX;

    // 最小幅の制約を適用
    const minLeftWidth = this.getMinWidth(this.currentHandle.leftPanel);
    const minRightWidth = this.getMinWidth(this.currentHandle.rightPanel);

    if (newLeftWidth >= minLeftWidth && newRightWidth >= minRightWidth) {
      leftPanel.style.width = `${newLeftWidth}px`;
      rightPanel.style.width = `${newRightWidth}px`;
    }
  }

  stopResize() {
    if (!this.currentHandle) return;

    // リサイズ中のスタイルを削除
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.currentHandle.element.classList.remove('resizing');

    // 幅を保存
    this.saveWidths();
    
    this.currentHandle = null;
  }

  getMinWidth(panelSelector) {
    switch (panelSelector) {
      case '.project-sidebar':
        return this.minWidths.projectSidebar;
      case '.sidebar':
        return this.minWidths.sidebar;
      case '.editor':
        return this.minWidths.editor;
      default:
        return 200;
    }
  }

  saveWidths() {
    const widths = {
      projectSidebar: document.querySelector('.project-sidebar')?.offsetWidth,
      sidebar: document.querySelector('.sidebar')?.offsetWidth,
      editor: document.querySelector('.editor')?.offsetWidth
    };

    localStorage.setItem('fabulor-column-widths', JSON.stringify(widths));
  }

  loadSavedWidths() {
    const savedWidths = localStorage.getItem('fabulor-column-widths');
    if (!savedWidths) return;

    try {
      const widths = JSON.parse(savedWidths);
      
      // 保存された幅を適用
      const projectSidebar = document.querySelector('.project-sidebar');
      const sidebar = document.querySelector('.sidebar');
      const editor = document.querySelector('.editor');

      if (projectSidebar && widths.projectSidebar) {
        projectSidebar.style.width = `${widths.projectSidebar}px`;
      }
      if (sidebar && widths.sidebar) {
        sidebar.style.width = `${widths.sidebar}px`;
      }
      if (editor && widths.editor) {
        editor.style.width = `${widths.editor}px`;
      }
    } catch (error) {
      console.error('Failed to load saved column widths:', error);
    }
  }
}

export { ResizeManager };