# 実装指示書：エラーハンドリングの改善

- **作成日**: 2026-05-14
- **対象タスク**: TASKS.md §1「エラーハンドリングの改善」
- **関連ファイル**: `src/js_core.html`, `src/js.html`, `src/index.html`

---

## 1. 現状の問題点

| # | 問題 | 箇所 |
|---|------|------|
| 1 | `showError()` がブラウザネイティブの `alert()` を使用しており、デザインが崩れ操作感が悪い | `js_core.html:52` |
| 2 | `showAlert(msg, title)` が `js.html:239, 245` で呼ばれているが、どこにも定義されていない（未実装バグ） | `js.html:239, 245` |
| 3 | エラー時の再試行（リトライ）機能がない。特にクラウド同期失敗時にユーザーが手動で再実行できない | `js.html:880-904` |
| 4 | エラーメッセージが `e.message || e` のみで、どの操作が失敗したか分からない | `js_core.html:52` |

---

## 2. 実装方針

### 2-1. `showAlert` / `showError` を共通カスタムモーダルに統一する

既存の `custom-alert-modal`（`index.html:1073-1133`）を活用し、`js_core.html` に `showAlert` と改良版 `showError` を実装する。

```javascript
// js_core.html の showError の下に追加

function showAlert(message, title = "通知", isError = false) {
  const modal = $("custom-alert-modal");
  const titleEl = $("alert-title");
  const msgEl = $("alert-message");
  if (!modal || !titleEl || !msgEl) {
    alert((title ? title + "\n" : "") + message);
    return;
  }
  titleEl.textContent = title;
  titleEl.style.color = isError ? "var(--red, #DC2626)" : "var(--navy)";
  msgEl.textContent = message;
  modal.style.display = "flex";
}

function closeAlert() {
  const modal = $("custom-alert-modal");
  if (modal) modal.style.display = "none";
}
```

既存の `showError` を以下に差し替える:

```javascript
// js_core.html:49-53 を置き換え
function showError(e, context = "") {
  if ($("overlay")) $("overlay").style.display = "none";
  console.error(e);
  const detail = e.message || String(e);
  const msg = context ? `${context}\n\n詳細: ${detail}` : `詳細: ${detail}`;
  showAlert(msg, "エラーが発生しました", true);
}
```

### 2-2. 操作別エラーコンテキストを追加する

`js.html` の各 `withFailureHandler` を、エラー内容が分かる形に更新する。
**対象と推奨メッセージ:**

| 操作 | コンテキスト文字列 |
|------|-----------------|
| `saveNewAccount` | `"取引先の新規登録に失敗しました"` |
| `updateAccount` | `"取引先情報の更新に失敗しました"` |
| `deleteAccountWithCascade` | `"取引先の削除に失敗しました"` |
| `saveDepartment` / `updateDepartment` | `"部署の保存に失敗しました"` |
| `saveProject` / `updateProject` | `"案件の保存に失敗しました"` |
| `saveLog` / `updateLog` | `"活動ログの保存に失敗しました"` |
| `uploadEstimateFile` | `"ファイルのアップロードに失敗しました"` |
| `syncMyData` | `"クラウド同期に失敗しました"` |

変更前:
```javascript
.withFailureHandler(showError)
```
変更後（例: 案件保存）:
```javascript
.withFailureHandler((e) => showError(e, "案件の保存に失敗しました"))
```

### 2-3. クラウド同期のリトライ機能を追加する

`js.html:880-904` の `saveAll()` 呼び出し（`syncMyData`）失敗時に、リトライボタンを表示する。

**実装方法**: `showError` の代わりに専用のリトライ付きエラーハンドラーを使う。

`index.html` の `custom-alert-modal` の OK ボタン横に「再試行」ボタンを追加し、`alert-retry-btn` という ID を付与する:

```html
<!-- index.html の closeAlert ボタンの前に追加 -->
<button
  id="alert-retry-btn"
  class="save-btn"
  style="padding: 8px 24px; display: none; margin-right: 8px; background: var(--teal);"
  onclick="closeAlert(); if(window._retryFn) window._retryFn();"
>
  再試行
</button>
```

`js_core.html` に `showErrorWithRetry` を追加:

```javascript
function showErrorWithRetry(e, context, retryFn) {
  window._retryFn = retryFn;
  const retryBtn = $("alert-retry-btn");
  if (retryBtn) retryBtn.style.display = "inline-block";
  showError(e, context);
}
```

`closeAlert()` でリトライ状態をリセット:
```javascript
function closeAlert() {
  const modal = $("custom-alert-modal");
  if (modal) modal.style.display = "none";
  const retryBtn = $("alert-retry-btn");
  if (retryBtn) retryBtn.style.display = "none";
  window._retryFn = null;
}
```

`js.html` の `saveAll()` のエラーハンドラーを変更:
```javascript
// saveAll() 内の withFailureHandler を変更
.withFailureHandler((e) => showErrorWithRetry(e, "クラウド同期に失敗しました", saveAll))
```

---

## 3. 変更ファイルまとめ

| ファイル | 変更内容 |
|----------|---------|
| `src/js_core.html` | `showError` を差し替え、`showAlert` / `closeAlert` / `showErrorWithRetry` を新規追加 |
| `src/js.html` | 全 `withFailureHandler(showError)` をコンテキスト付きに変更、`saveAll` にリトライ対応 |
| `src/index.html` | `custom-alert-modal` に「再試行」ボタン（`alert-retry-btn`）を追加 |

---

## 4. 完了条件

- [ ] `showAlert("テスト", "通知")` を呼んだ時にカスタムモーダルが表示される
- [ ] `showError(new Error("test"), "テスト操作")` でエラーモーダルにコンテキストが表示される
- [ ] GAS 通信失敗時（ネット切断等）に `alert()` が出なくなっている
- [ ] クラウド同期失敗時に「再試行」ボタンが表示され、押すと再実行される
- [ ] `showAlert` が呼ばれていた `js.html:239, 245` で正しくモーダルが表示される
