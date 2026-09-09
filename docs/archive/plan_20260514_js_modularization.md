# 実装指示書：JavaScriptロジックのモジュール化

- **作成日**: 2026-05-14
- **対象タスク**: TASKS.md §1「JavaScriptロジックのさらなるモジュール化」
- **関連ファイル**: `src/js.html`（1775行）, `src/index.html`

---

## 1. 現状の問題点

`js.html` が 1775 行・60 関数を抱えており、特定の機能を探すのが困難。
`js_core.html`（状態管理）と `js.html`（全業務ロジック）の 2 ファイル構成で、責務が混在している。

---

## 2. 分割方針

GAS の HTML サービスでは `<?= include('ファイル名') ?>` でファイルを埋め込めるため、同じ仕組みで分割する。

### 新規作成するファイルと収容する関数

#### `src/js_account.html` — 取引先管理

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `updateAccountSelectOptions` | 101 | 取引先選択プルダウンの更新 |
| `changeAccount` | 137 | Tab3 取引先切り替え |
| `_checkDuplicateAccount` | 207 | 重複チェック（内部） |
| `submitNewAccount` | 236 | 取引先新規登録送信 |
| `updateAccountProfile` | 279 | 取引先情報更新 |
| `handleDeleteAccount` | 295 | 取引先削除処理 |
| `renderBasicInfo` | 1413 | 取引先基本情報タブ描画 |
| `initRefSelectors` | 1474 | 参照用セレクタ初期化 |
| `updateRefPartnerOptions` | 1485 | 参照用MSセレクタ更新 |
| `updateRefAccountOptions` | 1499 | 参照用取引先セレクタ更新 |
| `applyRefData` | 1511 | 参照データ反映 |

#### `src/js_department.html` — 部署管理

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `editDept` | 409 | 部署編集モード開始 |
| `cancelEditDept` | 423 | 部署編集キャンセル |
| `addDept` | 432 | 部署保存（新規/更新） |
| `delDept` | 472 | 部署削除 |

#### `src/js_project.html` — 案件管理

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `editProject` | 507 | 案件編集モード開始 |
| `cancelEditProject` | 521 | 案件編集キャンセル |
| `addProject` | 529 | 案件保存（新規/更新） |
| `delProject` | 577 | 案件削除 |
| `toggleActionButtons` | 596 | アクションボタン表示切替 |
| `handleLogProjChange` | 614 | 案件セレクト変更時処理 |
| `loadProjectDataToForm` | 824 | 案件データをフォームにロード |
| `toggleClosingForm` | 858 | クロージングフォーム表示切替 |

#### `src/js_log.html` — 活動ログ管理

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `editLog` | 624 | ログ編集モード開始 |
| `cancelEditLog` | 651 | ログ編集キャンセル |
| `deleteLog` | 669 | ログ削除 |
| `addLogAndUpdateProject` | 685 | ログ保存（メイン処理） |
| `proceedToSaveLogAndProject` | 755 | ログ・案件の実保存（内部） |
| `renderTimelineLogs` | 1043 | 活動履歴タイムライン描画 |
| `renderActivities` | 1071 | Tab0 案件一覧・ログ描画 |

#### `src/js_review.html` — レビュー・設問管理

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `changeSummaryUser` | 190 | サマリー対象ユーザー切替 |
| `changeMonth` | 338 | 対象月切替 |
| `collectBasicInfo` | 362 | 基本情報収集 |
| `saveReviewAuto` | 382 | レビュー自動保存 |
| `renderAdminCheckItems` | 920 | 設問管理タブ描画 |
| `hideCheckItem` | 949 | 設問非表示 |
| `showCheckItem` | 965 | 設問表示 |
| `addCheckItem` | 974 | 設問追加 |
| `moveCheckItem` | 991 | 設問並び替え |
| `saveCheckItemOrder` | 1008 | 設問順序保存 |
| `deleteCheckItemPhysical` | 1017 | 設問物理削除 |
| `renderSummary` | 1273 | Tab2 サマリー描画 |

#### `src/js_quick_add.html` — クイック登録モーダル

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `openQuickAddModal` | 1563 | クイック登録モーダルを開く |
| `closeQuickAddModal` | 1615 | モーダルを閉じる |
| `toggleQaDeptFields` | 1619 | 部署フィールド表示切替 |
| `executeQuickAdd` | 1624 | クイック登録実行 |
| `initQaRefSelectors` | 1726 | 参照セレクタ初期化 |
| `updateQaRefPartnerOptions` | 1738 | パートナー参照セレクタ更新 |
| `updateQaRefAccountOptions` | 1750 | 取引先参照セレクタ更新 |
| `applyQaRefData` | 1762 | 参照データ反映 |

#### `src/js.html` — 残留（初期化・全体制御）

| 関数名 | 現行行番号 | 概要 |
|--------|-----------|------|
| `init` | 13 | アプリ初期化 |
| `switchTab` | 126 | タブ切り替え |
| `handleT0AccountChange` | 329 | Tab0 取引先切替 |
| `updatePartnerDisplay` | 356 | パートナー表示更新 |
| `updateStageFilter` | 351 | ステージフィルタ更新 |
| `renderAll` | 908 | 全描画呼び出し |
| `renderDashboard` | 1207 | Tab1 ダッシュボード描画 |
| `saveAll` | 868 | クラウド同期 |

---

## 3. 実装手順

### Step 1: index.html への `include` 追加

`index.html` の末尾、`js.html` の `include` の前に新ファイルを順番に追加する。
依存関係（`js_core.html` → 各モジュール → `js.html`）を守ること。

```html
<!-- 既存 -->
<?= include('js_core') ?>

<!-- 追加（順番を守ること） -->
<?= include('js_account') ?>
<?= include('js_department') ?>
<?= include('js_project') ?>
<?= include('js_log') ?>
<?= include('js_review') ?>
<?= include('js_quick_add') ?>

<!-- 既存（最後） -->
<?= include('js') ?>
```

### Step 2: 各ファイルの作成

新規ファイルは以下のスケルトンで作成し、対応する関数を `js.html` から**切り取り**で移動する。

```html
<script>
  // js_○○.html
  // （対応する関数をここに貼り付け）
</script>
```

### Step 3: `js.html` の残留確認

移動後の `js.html` が「初期化・全体制御」の関数のみになっていることを確認する。
参照関係（グローバル変数、他関数の呼び出し）に漏れがないことを確認する。

### Step 4: `コード_v2_9.js` への include 登録

`コード_v2_9.js` の `include` 関数が返すテンプレートに新ファイルが列挙されているか確認し、必要なら追加する。

---

## 4. 注意事項

- **グローバル変数の参照**: `db`, `editingDeptId`, `editingProjectId`, `editingLogId`, `currentUserEmail` 等は `js_core.html` で定義済みのため、各モジュールからそのまま参照可能。
- **関数間の呼び出し**: GAS の HTML include は同一スコープに展開されるため、モジュール間の関数呼び出しは変更不要。
- **移動は「切り取り」**: `js.html` から関数を削除しつつ新ファイルへ移動する。コピー後の削除忘れに注意。
- **定数の扱い**: `STAGE_LABELS` などの定数は `js_core.html` に既にあるため移動不要。

---

## 5. 完了条件

- [ ] `js.html` が 300 行以下になっている
- [ ] 各モジュールファイルが正しい関数セットを持っている
- [ ] アプリを開いた際にコンソールエラーが出ない
- [ ] Tab0〜Tab4 のすべての機能が従来通り動作する
- [ ] クイック登録モーダルが正常に開閉・保存できる
- [ ] クラウド同期が正常に完了する
