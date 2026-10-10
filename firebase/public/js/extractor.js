/**
 * Package Extractor - Extractor Module
 * UI連携・Web Worker管理・ツリー構造構築・ZIP生成
 */

export class PackageExtractor {
  constructor() {
    this.worker = null;
    this.assets = [];
    this.tree = null;
  }

  /**
   * .unitypackage ファイルを処理する
   * @param {File} file 
   * @param {Function} onProgress 
   * @returns {Promise<Array>} 解析済みアセット一覧
   */
  async extract(file, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        if (this.worker) {
          this.worker.terminate();
        }

        this.worker = new Worker('js/worker.js');

        this.worker.onmessage = (e) => {
          const { type, stage, percent, message, assets } = e.data;
          if (type === 'PROGRESS') {
            if (onProgress) onProgress({ stage, percent, message });
          } else if (type === 'COMPLETE') {
            this.assets = assets;
            this.tree = this.buildTree(assets);
            resolve(this.assets);
          } else if (type === 'ERROR') {
            reject(new Error(message));
          }
        };

        this.worker.onerror = (err) => {
          reject(new Error('Web Worker 内でエラーが発生しました: ' + err.message));
        };

        const arrayBuffer = await file.arrayBuffer();
        this.worker.postMessage({ type: 'EXTRACT', buffer: arrayBuffer }, [arrayBuffer]);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * フラットなアセット一覧からディレクトリ階層ツリーを構築
   */
  buildTree(assets) {
    const root = {
      name: 'root',
      path: '',
      isDirectory: true,
      children: new Map(),
      asset: null
    };

    for (const asset of assets) {
      const parts = asset.path.split('/').filter(p => p.length > 0);
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (isLast && !asset.isDirectory) {
          current.children.set(part, {
            name: part,
            path: asset.path,
            isDirectory: false,
            asset: asset,
            children: null
          });
        } else {
          if (!current.children.has(part)) {
            current.children.set(part, {
              name: part,
              path: parts.slice(0, i + 1).join('/'),
              isDirectory: true,
              children: new Map(),
              asset: isLast ? asset : null
            });
          }
          current = current.children.get(part);
        }
      }
    }

    return root;
  }

  /**
   * 単一ファイルをブラウザでダウンロード
   */
  downloadAsset(asset) {
    if (!asset.assetData) return;
    const blob = new Blob([asset.assetData]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 選択したアセット（または全体）をフォルダ構造を維持したZIPとして生成・ダウンロード
   * @param {Array} selectedAssets 
   * @param {string} zipFilename 
   * @param {Function} onProgress 
   */
  async downloadZip(selectedAssets, zipFilename = 'extracted_assets.zip', onProgress) {
    if (!window.fflate) {
      throw new Error('ZIPライブラリが読み込まれていません。');
    }

    const zipObj = {};
    const validAssets = selectedAssets.filter(a => a.assetData && a.assetData.byteLength > 0);

    if (validAssets.length === 0) {
      throw new Error('ダウンロード可能なファイルが選択されていません。');
    }

    for (const item of validAssets) {
      // パスの先頭スラッシュを削除
      const cleanPath = item.path.replace(/^\/+/, '');
      zipObj[cleanPath] = new Uint8Array(item.assetData);
    }

    if (onProgress) onProgress({ percent: 50, message: 'ZIPアーカイブを圧縮・生成中...' });

    const zipped = fflate.zipSync(zipObj, { level: 6 });
    const blob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onProgress) onProgress({ percent: 100, message: 'ダウンロード完了' });
  }
}
