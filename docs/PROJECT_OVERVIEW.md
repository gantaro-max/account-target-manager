# 取引先ターゲット管理アプリ - プロジェクト概要

## 1. システム概要

本プロジェクトは、Google Apps Script (GAS) を基盤とした、BtoB営業活動管理ツール（SFA/CRM）です。スプレッドシートをデータベースとして活用し、取引先・部署・案件の階層構造で営業状況を可視化します。

## 2. 技術スタック

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend**: Google Apps Script (Web App)
- **Database**: Google Spreadsheet
- **Storage**: Google Drive (見積書・資料の添付用)
- **外部ライブラリ (CDN)**:
  - [Tom Select v2](https://tom-select.js.org/) — 取引先セレクトボックスの検索・絞り込み
  - [SweetAlert2 v11](https://sweetalert2.github.io/) — 削除確認・エラー通知のアニメーションダイアログ
  - [Chart.js v4](https://www.chartjs.org/) — 統計タブのドーナツ・棒グラフ描画

## 3. ファイル構成

| ファイル | 役割 |
| :--- | :--- |
| `/src/index.html` | UIのメインスケルトン（タブ・モーダル・CDN読み込み） |
| `/src/css.html` | モダンなレスポンシブデザイン定義 |
| `/src/js_core.html` | 状態管理（State）・共通UIユーティリティ（showAlert / showConfirm / showError 等） |
| `/src/js.html` | アプリ初期化・タブ切り替え・取引先セレクト制御 |
| `/src/js_account.html` | 取引先マスター登録・編集・削除・マスター参照ロジック |
| `/src/js_department.html` | 部署の登録・編集・カスケード削除ロジック |
| `/src/js_project.html` | 案件の登録・編集・削除・ステージ管理ロジック |
| `/src/js_log.html` | 活動ログの記録・編集・削除・ファイル添付ロジック |
| `/src/js_review.html` | 月次レビュー・セルフチェック・設問管理・サマリー描画ロジック |
| `/src/js_quick_add.html` | クイック登録ウィザード（取引先→部署→案件の連続登録）ロジック |
| `/src/js_stats.html` | 統計タブ（Chart.js グラフ描画・ビュー切替・担当者フィルタ）ロジック |
| `/src/コード.js` | サーバーサイド（GAS）のスプレッドシート操作・ファイル管理・メール通知 |

## 4. データ階層

```
取引先 (Accounts)
  └─ 部署 (Departments)
       └─ 案件 (Projects)
            └─ 活動ログ (Activity Logs)
```

## 5. 関連ドキュメント

| ドキュメント | 内容 |
| :--- | :--- |
| [REQUIREMENTS.md](REQUIREMENTS.md) | 機能要件・非機能要件 |
| [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | シート定義・リレーション設計 |
| [UI_FLOW.md](UI_FLOW.md) | 画面構成・タブ遷移 |
| [TASKS.md](TASKS.md) | 開発タスク・既知の制限事項 |
| [MANUAL_MEMBER.md](MANUAL_MEMBER.md) | 営業担当者向け操作説明書 |
| [INDEX.md](INDEX.md) | ドキュメント索引（全ドキュメントの概要と読書順） |
