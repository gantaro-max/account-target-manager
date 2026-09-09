# 実装指示書：ファイルアップロードのバリデーション強化

- **作成日**: 2026-05-14
- **対象タスク**: TASKS.md §1「ファイルアップロードのバリデーション強化」
- **関連ファイル**: `src/js.html`

---

## 1. 現状の問題点

| # | 問題 | 箇所 |
|---|------|------|
| 1 | クライアント側にファイルサイズチェックが一切ない | `js.html:720-741` |
| 2 | ファイル種別チェックがなく、任意のファイルが送信できる | `js.html:720-741` |
| 3 | 大容量ファイルを送信するとGASのタイムアウト／ペイロード上限エラーが発生し、ユーザーに不親切なエラーが表示される | `コード_v2_9.js:773-786` |

---

## 2. 実装方針

### 2-1. バリデーション関数を追加する

`js.html` の `addLogAndUpdateProject` 関数（行 685）の冒頭付近、ファイル取得直後にバリデーション関数を呼び出す。

**追加する定数（`js.html` 上部 or バリデーション関数内）:**

```javascript
const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const FILE_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/vnd.partner-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
```

**バリデーション関数（`js.html` に追加）:**

```javascript
function validateUploadFile(file) {
  if (!file) return null; // ファイル未選択は正常
  if (file.size > FILE_MAX_BYTES) {
    return `ファイルサイズが上限（10MB）を超えています。\n選択したファイル: ${(file.size / 1024 / 1024).toFixed(1)}MB`;
  }
  if (!FILE_ALLOWED_TYPES.includes(file.type)) {
    return `対応していないファイル形式です。\nPDF / 画像（JPG, PNG）/ Excel / Word のみ添付できます。`;
  }
  return null; // エラーなし
}
```

### 2-2. `addLogAndUpdateProject` にバリデーションを組み込む

現在の `js.html:720` の `if (file) {` ブロックの直前に呼び出しを追加する。

**変更前（js.html:718-721）:**
```javascript
showSaving(); // 保存中画面を表示

if (file) {
  // ファイルが選択されている場合は先にGASへアップロード
```

**変更後:**
```javascript
// ファイルバリデーション
const fileError = validateUploadFile(file);
if (fileError) {
  showAlert(fileError, "ファイルエラー", true);
  return;
}

showSaving(); // 保存中画面を表示

if (file) {
  // ファイルが選択されている場合は先にGASへアップロード
```

### 2-3. ファイル選択時のプレビュー表示（任意・推奨）

ユーザーがファイルを選択した瞬間にバリデーションを実行し、問題があればすぐ通知する。
`index.html` のファイル input に `onchange` ハンドラーを追加する:

```html
<!-- 既存の input type="file" に onchange を追加 -->
<input
  type="file"
  id="log-estimate-file"
  onchange="
    const err = validateUploadFile(this.files[0]);
    const hint = document.getElementById('file-size-hint');
    if (err) {
      showAlert(err, 'ファイルエラー', true);
      this.value = '';
      if (hint) hint.textContent = '';
    } else if (this.files[0]) {
      if (hint) hint.textContent = '✓ ' + this.files[0].name + ' (' + (this.files[0].size / 1024 / 1024).toFixed(1) + 'MB)';
    }
  "
/>
<div id="file-size-hint" style="font-size:11px; color:var(--teal); margin-top:4px;"></div>
```

---

## 3. 変更ファイルまとめ

| ファイル | 変更内容 |
|----------|---------|
| `src/js.html` | `validateUploadFile` 関数を追加、`addLogAndUpdateProject` に呼び出しを組み込む |
| `src/index.html` | ファイル input に `onchange` バリデーション + `file-size-hint` の表示要素を追加（任意） |

---

## 4. 完了条件

- [ ] 10MB を超えるファイルを添付しようとすると、カスタムモーダルでエラーが表示され保存処理が止まる
- [ ] 非対応形式（例: `.zip`, `.exe`）を選択するとエラーが表示される
- [ ] 正常なファイル（PDF 5MB 等）は従来通り添付できる
- [ ] ファイル未選択のまま保存しても問題なく動作する

> **依存関係**: `showAlert` の実装が完了していること（`campaign_20260514_error_handling.md` を先に実装する）
