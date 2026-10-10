# Package Extractor

ブラウザ上で Unity Package（`.unitypackage`）を展開し、内部のファイルを抽出・ダウンロードできるWebツールです。  
Unityエディタを起動することなく、パッケージ内に含まれるテクスチャ、3Dモデル、スクリプト、音声などのアセットを手軽に取り出すことができます。

---

## 主な特徴

- **完全クライアントサイド処理**
  - 選択した `.unitypackage` はサーバーにアップロードされず、ブラウザ内でのみ安全かつ高速に解凍・処理されます。
- **フォルダ階層の完全復元**
  - パッケージ内の各アセットパス（`pathname`）を解析し、Unityプロジェクト上の元のディレクトリ構造をツリー形式で再現します。
- **プレビュー機能**
  - 画像テクスチャ（PNG, JPG等）やテキスト/スクリプト（C#, Shader, JSON等）の事前確認が可能です。
- **柔軟なエクスポート**
  - ファイル単体の個別ダウンロード
  - 選択したファイル、またはフォルダ構造を維持したまま一括ZIPダウンロード
- **検索・フィルタリング**
  - 拡張子（テクスチャ、モデル、スクリプト等）による絞り込みやファイル名検索

---

## 内部の仕組み

`.unitypackage` の実体は `tar.gz` 圧縮アーカイブです。内部には各アセットごとにGUIDを名前に持つディレクトリが格納されています。

| ファイル名 | 説明 |
| :--- | :--- |
| `pathname` | プロジェクト内の相対パス（例: `Assets/Textures/logo.png`）が記録されたテキスト |
| `asset` | アセットの実体バイナリデータ |
| `asset.meta` | Unityのメタデータ（YAML形式） |
| `preview.png` | エディタ用サムネイル画像（存在する場合） |

本ツールではブラウザ上で `tar.gz` をストリーム/インメモリ展開し、上記ファイルを突合・再構成してユーザーに提供します。

---

## 技術スタック

| 分類 | 技術 / ライブラリ | 用途 |
| :--- | :--- | :--- |
| **ホスティング** | Firebase Hosting | 静的Webホスティング・CDN配信 |
| **フロントエンド** | HTML5 / CSS3 / Vanilla JavaScript | UI構築およびロジック |
| **解凍処理** | fflate (または pako) | 高速なブラウザ内 tar.gz 解凍 |
| **ZIP作成** | JSZip (または fflate) | 抽出アセットの一括ZIPアーカイブ生成 |
| **並列処理** | Web Workers | 大容量パッケージ処理時のUIブロッキング防止 |

---

## ディレクトリ構成（予定）

```text
PackageExtractor/
├── README.md                  # プロジェクトドキュメント
└── firebase/                  # Firebase プロジェクトルート
    ├── firebase.json          # Firebase Hosting 設定
    ├── .firebaserc            # Firebase プロジェクト設定
    └── public/                # 公開ディレクトリ（Webコード）
        ├── index.html         # メインUI画面
        ├── css/
        │   └── style.css      # スタイル定義
        └── js/
            ├── app.js         # UI操作・イベントハンドリング
            ├── extractor.js   # unitypackage 解析・展開ロジック
            └── worker.js      # バックグラウンド解凍用 Web Worker
```

---

## 開発・セットアップ手順

### 必要要件
- Node.js (v18以上推奨)
- Firebase CLI (`npm install -g firebase-tools`)

### ローカル実行
静的ファイルで構成されているため、任意のローカルWebサーバーで実行可能です。

```bash
# プロジェクトルートから実行する場合 (例: npx serve)
npx serve firebase/public

# または Firebase ディレクトリで Emulator を使用する場合
cd firebase
firebase emulators:start --only hosting
```

---

## デプロイ手順

Firebase Hosting へのデプロイは `firebase/` ディレクトリ配下から行います。

```bash
cd firebase

# 初回のみログインおよびプロジェクト設定
firebase login
firebase use <project-id>

# Hosting へのデプロイ
firebase deploy --only hosting
```

## ローカル実行

```bash
cd firebase
firebase emulators:start

open http://localhost:5000/login
```

---

## 注意事項・制約

- **メモリ制限**: ブラウザのJavaScriptヒープメモリ上限を超える極めて大容量のパッケージ（数GB以上）の場合、メモリ不足エラーが発生する可能性があります。
- **セキュリティ・プライバシー**: すべての処理はお手元の端末（ブラウザ）内で完結し、外部サーバーへのデータ送信は一切行われません。
