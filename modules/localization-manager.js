// ローカライゼーション管理モジュール
import { escapeCSV, rowsToCSV } from './csv-utils.js';

class LocalizationManager {
  constructor() {
    this.projectPath = null;
  }

  setProjectPath(projectPath) {
    this.projectPath = projectPath;
  }

  getProjectPath() {
    return this.projectPath;
  }

  /**
   * シーンのローカライゼーションCSVファイルを更新
   * @param {string} projectPath - プロジェクトパス
   * @param {string} sceneFileName - シーンのファイル名（例: scene1.json）
   * @param {Array} paragraphs - シーンの段落データ
   * @returns {Promise<Object>} - 結果オブジェクト {success: boolean, message: string, error?: string}
   */
  async updateLocalizationCSV(projectPath, sceneFileName, paragraphs) {
    try {
      // ローカライズ対象のブロック（テキストを持つブロック）のみを抽出
      const localizableBlocks = paragraphs.filter(p => p.text && p.text.trim());

      if (localizableBlocks.length === 0) {
        return {
          success: false,
          message: 'ローカライズ対象のブロックがありません'
        };
      }

      // CSVファイル名を生成（例: scene1.json → scene1.csv）
      const csvFileName = sceneFileName.replace(/\.json$/, '.csv');

      // メインプロセスにCSV更新を依頼
      const result = await window.electronAPI.updateLocalizationCSV(
        projectPath,
        csvFileName,
        localizableBlocks
      );

      return result;
    } catch (error) {
      console.error('ローカライゼーションCSV更新エラー:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * すべてのシーンのローカライゼーションファイルを一括更新
   * @param {string} projectPath - プロジェクトパス
   * @param {Array} scenes - シーン一覧
   * @returns {Promise<Object>} - 結果オブジェクト
   */
  async updateAllLocalizationCSVs(projectPath, scenes) {
    try {
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const scene of scenes) {
        // シーンファイルが存在しない場合はスキップ
        if (!scene.exists) {
          console.warn(`シーンファイルが存在しません: ${scene.fileName}`);
          continue;
        }

        // シーンデータを読み込み
        try {
          const loadResult = await window.electronAPI.loadScene(projectPath, scene._fileName);

          if (!loadResult.success || !loadResult.data.paragraphs) {
            console.warn(`シーン "${scene.name}" のデータが読み込めませんでした`);
            errorCount++;
            continue;
          }

          // ローカライゼーションCSVを更新
          const updateResult = await this.updateLocalizationCSV(
            projectPath,
            scene._fileName,
            loadResult.data.paragraphs
          );

          if (updateResult.success) {
            successCount++;
            results.push({
              sceneName: scene.name,
              success: true
            });
          } else {
            errorCount++;
            results.push({
              sceneName: scene.name,
              success: false,
              error: updateResult.error || updateResult.message
            });
          }
        } catch (error) {
          console.error(`シーン "${scene.name}" の処理中にエラー:`, error);
          errorCount++;
          results.push({
            sceneName: scene.name,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: errorCount === 0,
        successCount,
        errorCount,
        results
      };
    } catch (error) {
      console.error('全シーンローカライゼーション更新エラー:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * CSVデータを生成（id, jp, en, cn カラム）
   * @param {Array} blocks - ローカライズ対象のブロック
   * @param {Array} existingRecords - 既存のCSVレコード（オプション）
   * @returns {string} - CSV文字列
   */
  generateLocalizationCSV(blocks, existingRecords = []) {
    // 既存レコードをMapに変換（idをキーとする）
    const existingMap = new Map();
    existingRecords.forEach(record => {
      if (record.id) {
        existingMap.set(record.id, record);
      }
    });

    // ヘッダー行
    const headers = ['id', 'jp', 'en', 'cn'];
    const rows = [headers];

    // 各ブロックに対してレコードを作成
    blocks.forEach(block => {
      const existingRecord = existingMap.get(block.id);

      const row = [
        escapeCSV(block.id),
        escapeCSV(block.text || ''), // jp列は常に最新のテキストで更新
        existingRecord ? escapeCSV(existingRecord.en || '') : '', // en列は既存値を保持
        existingRecord ? escapeCSV(existingRecord.cn || '') : ''  // cn列は既存値を保持
      ];

      rows.push(row);
    });

    return rowsToCSV(rows);
  }
}

export { LocalizationManager };
