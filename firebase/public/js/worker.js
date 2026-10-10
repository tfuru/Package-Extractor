/**
 * Package Extractor - Web Worker for .unitypackage (tar.gz) processing
 * Uses fflate for gzip decompression.
 */

importScripts('https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js');

self.onmessage = async function (e) {
  const { type, buffer } = e.data;
  if (type === 'EXTRACT') {
    try {
      await processPackage(buffer);
    } catch (err) {
      self.postMessage({ type: 'ERROR', message: err.message || '展開処理中にエラーが発生しました。' });
    }
  }
};

/**
 * .unitypackage (tar.gz) を解凍・解析する
 */
async function processPackage(arrayBuffer) {
  self.postMessage({ type: 'PROGRESS', stage: 'decompressing', percent: 10, message: 'gzip アーカイブを解凍中...' });

  const compressedData = new Uint8Array(arrayBuffer);
  let decompressed;
  try {
    decompressed = fflate.gunzipSync(compressedData);
  } catch (err) {
    throw new Error('gzip の解凍に失敗しました。ファイルが破損しているか、対応フォーマットではありません。');
  }

  self.postMessage({ type: 'PROGRESS', stage: 'parsing_tar', percent: 40, message: 'TAR アーカイブを解析中...' });

  // TAR アーカイブのファイルをパース
  const rawFiles = parseTar(decompressed);

  self.postMessage({ type: 'PROGRESS', stage: 'reconstructing', percent: 70, message: 'Unity アセットを再構成中...' });

  // GUIDごとのフォルダ構造に整理
  // 各GUID配下に: pathname, asset, asset.meta, preview.png
  const guidMap = new Map();

  for (const file of rawFiles) {
    // パス形式例: "7a8bc.../pathname", "./7a8bc.../asset", etc.
    const cleanName = file.name.replace(/^\.\//, '');
    const parts = cleanName.split('/');
    if (parts.length < 2) continue;

    const guid = parts[0];
    const itemType = parts[1]; // pathname, asset, asset.meta, preview.png

    if (!guidMap.has(guid)) {
      guidMap.set(guid, {});
    }
    const entry = guidMap.get(guid);

    if (itemType === 'pathname') {
      entry.pathname = new TextDecoder('utf-8').decode(file.data).trim();
    } else if (itemType === 'asset') {
      entry.assetData = file.data;
      entry.size = file.data.byteLength;
    } else if (itemType === 'asset.meta') {
      entry.metaData = new TextDecoder('utf-8').decode(file.data);
    } else if (itemType === 'preview.png') {
      entry.previewData = file.data;
    }
  }

  // アセット一覧の作成
  const assets = [];
  const transferList = [];

  for (const [guid, item] of guidMap.entries()) {
    if (!item.pathname) continue; // パス名のないものは除外

    // ディレクトリや実体データ
    const assetObj = {
      guid: guid,
      path: item.pathname,
      name: item.pathname.split('/').pop(),
      size: item.size || 0,
      isDirectory: !item.assetData,
      meta: item.metaData || null,
      assetData: item.assetData || null,
      previewData: item.previewData || null
    };

    if (item.assetData) {
      transferList.push(item.assetData.buffer);
    }
    if (item.previewData) {
      transferList.push(item.previewData.buffer);
    }

    assets.push(assetObj);
  }

  self.postMessage({ type: 'PROGRESS', stage: 'completed', percent: 100, message: '解析完了' });

  // メインスレッドへ返却
  self.postMessage({
    type: 'COMPLETE',
    assets: assets
  }, transferList);
}

/**
 * 標準 TAR フォーマットの簡易パーサー (POSIX ustar 準拠)
 */
function parseTar(buffer) {
  const files = [];
  let offset = 0;
  const totalLength = buffer.byteLength;

  while (offset < totalLength - 512) {
    // 512バイトのヘッダ
    const headerBlock = buffer.subarray(offset, offset + 512);

    // ヘッダが全て0（終端マーカー）かチェック
    let isZero = true;
    for (let i = 0; i < 512; i++) {
      if (headerBlock[i] !== 0) {
        isZero = false;
        break;
      }
    }
    if (isZero) break;

    // ファイル名 (0 - 100)
    let fileName = readString(headerBlock, 0, 100);

    // ファイルサイズ (124 - 136, 8進数)
    const sizeStr = readString(headerBlock, 124, 12).trim();
    const fileSize = parseInt(sizeStr, 8) || 0;

    // タイプフラグ (156)
    const typeFlag = String.fromCharCode(headerBlock[156]);

    // ustar プレフィックス (345 - 500)
    const ustar = readString(headerBlock, 257, 5);
    if (ustar === 'ustar') {
      const prefix = readString(headerBlock, 345, 155);
      if (prefix) {
        fileName = prefix + '/' + fileName;
      }
    }

    offset += 512;

    // 通常ファイル(0または\0)またはその他のデータ
    if (fileSize > 0) {
      const fileData = buffer.slice(offset, offset + fileSize);
      files.push({
        name: fileName,
        size: fileSize,
        type: typeFlag,
        data: fileData
      });
    }

    // TARは512バイト境界にパディングされる
    offset += Math.ceil(fileSize / 512) * 512;
  }

  return files;
}

function readString(buf, start, length) {
  let end = start;
  const max = start + length;
  while (end < max && buf[end] !== 0) {
    end++;
  }
  return new TextDecoder('utf-8').decode(buf.subarray(start, end));
}
