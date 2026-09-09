# セットアップ手順

## 前提

- Googleアカウント（Workspace 推奨。`appsscript.json` の `access` が `DOMAIN` のため）
- [clasp](https://github.com/google/clasp)（ローカルから反映する場合）

## 1. スプレッドシートを準備する

新規スプレッドシートを作成し、以下の10シートを用意します。
各シートの列定義は [DATABASE_DESIGN.md](DATABASE_DESIGN.md) を参照してください。

| シート名 | 用途 |
| :--- | :--- |
| `accounts` | 取引先マスタ |
| `departments` | 部署 |
| `projects` | 案件 |
| `activity_logs` | 活動ログ |
| `monthly_reviews` | 月次レビュー |
| `review_check_items` | セルフチェック設問 |
| `users` | ユーザーとロール |
| `master_list` | 取引先マスター（登録時の検索補完用） |
| `campaigns` | キャンペーン |
| `stage_history` | 案件ステージの変更履歴 |

### users シートの初期登録

最低1人、自分を `admin` として登録します。`user_id` はGoogleアカウントのメールアドレスです。

| user_id | name | role |
| :--- | :--- | :--- |
| you@example.com | 山田太郎 | admin |

ロールは `admin` / `manager` / `leader` / `member` の4種類です。

## 2. GASプロジェクトを作成する

スプレッドシートの `拡張機能 > Apps Script` から作成するか、スタンドアロンで新規作成します。

`src/` 配下のファイルをGASエディタに配置します。clasp を使う場合は次の通りです。

```bash
npm install
clasp login
clasp create --type webapp --title "account-target-manager"
clasp push
```

## 3. スクリプトプロパティを設定する

`プロジェクトの設定 > スクリプト プロパティ` で以下を登録します。

| キー | 値 | 必須 |
| :--- | :--- | :--- |
| `SHEET_ID` | 手順1で作成したスプレッドシートのID | **必須** |
| `SAVE_FOLDER_ID` | 添付ファイルの保存先GoogleドライブフォルダのID | 添付機能を使う場合 |

> IDはURLから取得します。
> スプレッドシート: `https://docs.google.com/spreadsheets/d/<ここがID>/edit`
> フォルダ: `https://drive.google.com/drive/folders/<ここがID>`

**スプレッドシートIDをコードに直接書かないでください。** 本アプリは全て
`PropertiesService.getScriptProperties()` 経由で参照する設計になっています。

## 4. デプロイする

`デプロイ > 新しいデプロイ > 種類の選択: ウェブアプリ` を選択します。

| 項目 | 設定値 |
| :--- | :--- |
| 次のユーザーとして実行 | 自分（`USER_DEPLOYING`） |
| アクセスできるユーザー | 組織内のユーザー（`DOMAIN`） |

初回アクセス時にOAuth認可を求められます。必要なスコープは `appsscript.json` に定義済みです
（スプレッドシート・ドライブ・外部リクエスト・メールアドレス取得・カレンダー）。

## 5. 任意: メールリマインダーを有効にする

期限超過の案件を担当者へ通知する機能です。
GASエディタの `トリガー` から、以下を設定します。

| 項目 | 設定値 |
| :--- | :--- |
| 実行する関数 | `sendOverdueReminders` |
| イベントのソース | 時間主導型 |
| 時間ベースのタイマー | 日付ベースのタイマー（午前8時〜9時など） |

## 既知の制限事項

- **Googleカレンダー連携**: 実装済みですが無効化しています。`executeAs: USER_DEPLOYING` の制約により、
  全ユーザーのイベントがデプロイ者のカレンダーに集約されてしまうためです。
  `_syncCalendarEvent()` の早期 return を外せば再有効化できます。
- **GASの実行時間**: 1実行あたり6分の上限があります。データ量が増えた場合は
  一括同期の単位を分割する必要があります。
