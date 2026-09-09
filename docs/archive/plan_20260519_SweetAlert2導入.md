# 実装指示書: SweetAlert2 導入によるダイアログ統一

## 背景・目的

現在のカスタムモーダル (`custom-alert-modal`) を廃止し、SweetAlert2 v11 に完全移行する。  
アニメーション付きのアイコン・スタイリングが自動で適用され、保守負担が減る。  
また `js_review.html`・`js_department.html`・`js_project.html`・`js_log.html` に残存している  
ネイティブ `confirm()` 5箇所も `showConfirm()` コールバックパターンに統一する。

**維持するもの:**  
- `showSaving()` — overlay スピナー（GAS 通信中の UI ブロック）  
- `showSuccess()` — トースト通知  
いずれも Swal とは用途が異なるため、現行のまま残す。

---

## 変更対象ファイル

1. `src/index.html`
2. `src/js_core.html`
3. `src/js_department.html`
4. `src/js_project.html`
5. `src/js_log.html`
6. `src/js_review.html`

---

## 変更詳細

---

### 1. `src/index.html`

#### 1-1. `<head>` に SweetAlert2 CDN を追加する

**場所**: 既存の Tom Select CDN 2行の**直後**に追加する。

**変更前:**
```html
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2/dist/css/tom-select.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/tom-select@2/dist/js/tom-select.complete.min.js"></script>
    <?!= include('css'); ?>
```

**変更後:**
```html
    <link href="https://cdn.jsdelivr.net/npm/tom-select@2/dist/css/tom-select.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/tom-select@2/dist/js/tom-select.complete.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js"></script>
    <?!= include('css'); ?>
```

#### 1-2. `custom-alert-modal` ブロックを丸ごと削除する

`</body>` 直前にある以下の全ブロック（line 1113〜1190）を削除する。  
削除後は `</body>` タグの直前が `</div>` (直前のタブコンテンツの閉じ) のみになる。

**削除対象（全体）:**
```html
    <div
      id="custom-alert-modal"
      style="
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 100000;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
      "
    >
      <div
        class="card"
        style="
          width: 90%;
          max-width: 400px;
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        "
      >
        <div
          id="alert-title"
          style="
            font-weight: bold;
            color: var(--navy);
            margin-bottom: 12px;
            font-size: 16px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
          "
        >
          通知
        </div>
        <div
          id="alert-message"
          style="
            font-size: 14px;
            line-height: 1.6;
            color: var(--text);
            margin-bottom: 20px;
            white-space: pre-wrap;
          "
        ></div>
        <div style="text-align: right">
          <button
            id="alert-cancel-btn"
            class="save-btn"
            onclick="closeAlert()"
            style="padding: 8px 24px; display: none; margin-right: 8px; background: #6b7280;"
          >
            キャンセル
          </button>
          <button
            id="alert-retry-btn"
            class="save-btn"
            onclick="const fn = window._retryFn; closeAlert(); if(fn) fn();"
            style="padding: 8px 24px; display: none; margin-right: 8px; background: var(--teal);"
          >
            再試行
          </button>
          <button
            id="alert-ok-btn"
            class="save-btn"
            onclick="const fn = window._confirmFn; closeAlert(); if(fn) fn();"
            style="padding: 8px 24px"
          >
            OK
          </button>
        </div>
      </div>
    </div>
```

---

### 2. `src/js_core.html`

`closeAlert()` 関数と、それに関連する4つのダイアログ関数を SweetAlert2 ベースに置き換える。  
`showSaving()` と `showSuccess()` は**変更しない**。

#### 2-1. `closeAlert()` 関数を削除する

**削除対象（全体）:**
```javascript
  function closeAlert() {
    const modal = $("custom-alert-modal");
    if (modal) modal.style.display = "none";
    const retryBtn = $("alert-retry-btn");
    if (retryBtn) retryBtn.style.display = "none";
    const cancelBtn = $("alert-cancel-btn");
    if (cancelBtn) cancelBtn.style.display = "none";
    const okBtn = $("alert-ok-btn");
    if (okBtn) {
      okBtn.textContent = "OK";
      okBtn.style.background = "";
    }
    window._retryFn = null;
    window._confirmFn = null;
  }
```

#### 2-2. `showAlert()` を置き換える

**変更前:**
```javascript
  function showAlert(message, title = "通知", isError = false) {
    const modal = $("custom-alert-modal");
    const titleEl = $("alert-title");
    const msgEl = $("alert-message");
    if (!modal || !titleEl || !msgEl) {
      alert((title ? title + "\n" : "") + message);
      return;
    }
    titleEl.textContent = title;
    titleEl.style.color = isError ? "#DC2626" : "var(--navy)";
    msgEl.textContent = message;
    modal.style.display = "flex";
  }
```

**変更後:**
```javascript
  function showAlert(message, title = "通知", isError = false) {
    Swal.fire({
      title: title,
      html: message.replace(/\n/g, "<br>"),
      icon: isError ? "error" : "info",
      confirmButtonColor: isError ? "#DC2626" : "#0891b2",
      confirmButtonText: "OK",
    });
  }
```

#### 2-3. `showConfirm()` を置き換える（オプション引数 `confirmText` を追加）

**変更前:**
```javascript
  function showConfirm(message, title, onConfirm) {
    window._confirmFn = onConfirm;
    const cancelBtn = $("alert-cancel-btn");
    if (cancelBtn) cancelBtn.style.display = "inline-block";
    const okBtn = $("alert-ok-btn");
    if (okBtn) {
      okBtn.textContent = "削除する";
      okBtn.style.background = "#DC2626";
    }
    showAlert(message, title, true);
  }
```

**変更後:**
```javascript
  function showConfirm(message, title, onConfirm, confirmText = "削除する") {
    Swal.fire({
      title: title,
      html: message.replace(/\n/g, "<br>"),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: confirmText,
      cancelButtonText: "キャンセル",
    }).then((result) => {
      if (result.isConfirmed && onConfirm) onConfirm();
    });
  }
```

#### 2-4. `showError()` を置き換える

**変更前:**
```javascript
  function showError(e, context = "") {
    if ($("overlay")) $("overlay").style.display = "none";
    console.error(e);
    const detail = e.message || String(e);
    const msg = context ? `${context}\n\n詳細: ${detail}` : `詳細: ${detail}`;
    showAlert(msg, "エラーが発生しました", true);
  }
```

**変更後:**
```javascript
  function showError(e, context = "") {
    if ($("overlay")) $("overlay").style.display = "none";
    console.error(e);
    const detail = e.message || String(e);
    const msg = context ? `${context}\n\n詳細: ${detail}` : `詳細: ${detail}`;
    Swal.fire({
      title: "エラーが発生しました",
      html: msg.replace(/\n/g, "<br>"),
      icon: "error",
      confirmButtonColor: "#DC2626",
      confirmButtonText: "OK",
    });
  }
```

#### 2-5. `showErrorWithRetry()` を置き換える

**変更前:**
```javascript
  function showErrorWithRetry(e, context, retryFn) {
    window._retryFn = retryFn;
    const retryBtn = $("alert-retry-btn");
    if (retryBtn) retryBtn.style.display = "inline-block";
    showError(e, context);
  }
```

**変更後:**
```javascript
  function showErrorWithRetry(e, context, retryFn) {
    if ($("overlay")) $("overlay").style.display = "none";
    console.error(e);
    const detail = e.message || String(e);
    const msg = context ? `${context}\n\n詳細: ${detail}` : `詳細: ${detail}`;
    Swal.fire({
      title: "エラーが発生しました",
      html: msg.replace(/\n/g, "<br>"),
      icon: "error",
      showCancelButton: true,
      confirmButtonColor: "#0891b2",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "再試行",
      cancelButtonText: "閉じる",
    }).then((result) => {
      if (result.isConfirmed && retryFn) retryFn();
    });
  }
```

---

### 3. `src/js_department.html` — `delDept()` 内の `confirm()` を置き換える

**変更前** (`delDept()` の line 74 付近):
```javascript
    if (!confirm(msg)) return;

    showSaving();

    // 2. ログ削除のために、関連する案件IDを特定しておく
    const relatedProjectIds = db.projects
      .filter((p) => p.departmentId === id)
      .map((p) => p.id);

    // 3. GAS側の連動削除関数を実行
    google.script.run
      .withSuccessHandler(() => {
        // 4. 成功したらメモリ上のデータ（db）も一括で削除
        db.departments = db.departments.filter((d) => d.id !== id);
        db.projects = db.projects.filter((p) => p.departmentId !== id);
        db.logs = db.logs.filter(
          (l) => !relatedProjectIds.includes(l.projectId),
        );

        showSuccess();
        // 再描画（タブ3なので取引先詳細を更新）
        changeAccount(3, t3HospId);
      })
      .withFailureHandler((e) => showError(e, "部署の削除に失敗しました"))
      .deleteDepartmentWithCascade(id);
```

**変更後** (同箇所全体を置き換える):
```javascript
    showConfirm(msg, "⚠️ 削除の確認", () => {
      showSaving();

      // 2. ログ削除のために、関連する案件IDを特定しておく
      const relatedProjectIds = db.projects
        .filter((p) => p.departmentId === id)
        .map((p) => p.id);

      // 3. GAS側の連動削除関数を実行
      google.script.run
        .withSuccessHandler(() => {
          // 4. 成功したらメモリ上のデータ（db）も一括で削除
          db.departments = db.departments.filter((d) => d.id !== id);
          db.projects = db.projects.filter((p) => p.departmentId !== id);
          db.logs = db.logs.filter(
            (l) => !relatedProjectIds.includes(l.projectId),
          );

          showSuccess();
          // 再描画（タブ3なので取引先詳細を更新）
          changeAccount(3, t3HospId);
        })
        .withFailureHandler((e) => showError(e, "部署の削除に失敗しました"))
        .deleteDepartmentWithCascade(id);
    });
```

**注意**: `delDept()` 関数の末尾の閉じカッコ `}` はそのまま維持し、`showConfirm()` の `)` + `;` を追加するだけ。

---

### 4. `src/js_project.html` — `delProject()` 内の `confirm()` を置き換える

**変更前** (`delProject()` の line 99〜114):
```javascript
    if (
      !confirm(
        "この案件を完全に削除しますか？\n※誤って削除した場合、復元できません。",
      )
    )
      return;

    db.projects = db.projects.filter((p) => p.id !== id);
    db.logs = db.logs.filter((l) => l.projectId !== id);
    renderBasicInfo();
    renderActivities();
    showSaving();
    google.script.run
      .withSuccessHandler(showSuccess)
      .withFailureHandler((e) => showError(e, "案件の削除に失敗しました"))
      .deleteProject(id);
```

**変更後:**
```javascript
    showConfirm(
      "この案件を完全に削除しますか？\n※誤って削除した場合、復元できません。",
      "⚠️ 削除の確認",
      () => {
        db.projects = db.projects.filter((p) => p.id !== id);
        db.logs = db.logs.filter((l) => l.projectId !== id);
        renderBasicInfo();
        renderActivities();
        showSaving();
        google.script.run
          .withSuccessHandler(showSuccess)
          .withFailureHandler((e) => showError(e, "案件の削除に失敗しました"))
          .deleteProject(id);
      }
    );
```

---

### 5. `src/js_log.html` — `deleteLog()` 内の `confirm()` を置き換える

**変更前** (`deleteLog()` の line 73〜85):
```javascript
    if (!confirm("この活動ログを完全に削除しますか？")) return;

    // 画面上のデータから削除
    db.logs = db.logs.filter((l) => l.id !== id);
    cancelEditLog();
    renderActivities();

    // バックエンドに削除リクエスト
    showSaving();
    google.script.run
      .withSuccessHandler(showSuccess)
      .withFailureHandler((e) => showError(e, "活動ログの削除に失敗しました"))
      .deleteLog(id);
```

**変更後:**
```javascript
    showConfirm("この活動ログを完全に削除しますか？", "⚠️ 削除の確認", () => {
      // 画面上のデータから削除
      db.logs = db.logs.filter((l) => l.id !== id);
      cancelEditLog();
      renderActivities();

      // バックエンドに削除リクエスト
      showSaving();
      google.script.run
        .withSuccessHandler(showSuccess)
        .withFailureHandler((e) => showError(e, "活動ログの削除に失敗しました"))
        .deleteLog(id);
    });
```

---

### 6. `src/js_review.html` — `confirm()` 2箇所を置き換える

#### 6-1. `hideCheckItem()` (line 101〜106 付近)

**変更前:**
```javascript
    if (
      !confirm(
        "この設問を非表示にしますか？\n※担当者の入力画面からは消えますが、管理画面には残り、過去の回答データも保持されます。",
      )
    )
      return;

    const item = db.checkItems.find((q) => q.id === id);
    if (item) item.isActive = false;

    renderAdminCheckItems();
    renderSummary();
```

**変更後:**
```javascript
    showConfirm(
      "この設問を非表示にしますか？\n※担当者の入力画面からは消えますが、管理画面には残り、過去の回答データも保持されます。",
      "設問の非表示確認",
      () => {
        const item = db.checkItems.find((q) => q.id === id);
        if (item) item.isActive = false;
        renderAdminCheckItems();
        renderSummary();
      },
      "非表示にする"
    );
```

#### 6-2. `deleteCheckItemPhysical()` (line 170〜189 付近)

**変更前:**
```javascript
    if (
      !confirm(
        "【警告】この設問を完全に削除しますか？\nデータベースから行が直接削除され、復元できなくなります。",
      )
    )
      return;

    db.checkItems = db.checkItems.filter((q) => q.id !== id);
    db.checkItems.forEach((item, i) => {
      item.sortOrder = i + 1;
    });

    renderAdminCheckItems();
    renderSummary();

    showSaving();
    google.script.run
      .withSuccessHandler(showSuccess)
      .withFailureHandler((e) => showError(e, "設問の削除に失敗しました"))
      .deleteCheckItem(id);
```

**変更後:**
```javascript
    showConfirm(
      "【警告】この設問を完全に削除しますか？\nデータベースから行が直接削除され、復元できなくなります。",
      "⚠️ 削除の確認",
      () => {
        db.checkItems = db.checkItems.filter((q) => q.id !== id);
        db.checkItems.forEach((item, i) => {
          item.sortOrder = i + 1;
        });

        renderAdminCheckItems();
        renderSummary();

        showSaving();
        google.script.run
          .withSuccessHandler(showSuccess)
          .withFailureHandler((e) => showError(e, "設問の削除に失敗しました"))
          .deleteCheckItem(id);
      }
    );
```

---

## 完了条件 (Definition of Done)

1. SweetAlert2 v11 の CSS + JS CDN が `<head>` に追加されている。
2. `custom-alert-modal` の div ブロックが `index.html` から削除されている。
3. `js_core.html` の `closeAlert()` 関数が削除されている。
4. `showAlert()` / `showConfirm()` / `showError()` / `showErrorWithRetry()` が Swal ベースで実装されている。
5. `showConfirm()` に 4番目の任意引数 `confirmText = "削除する"` が追加されている。
6. `js_department.html`・`js_project.html`・`js_log.html`・`js_review.html` からネイティブ `confirm()` が消えており、`showConfirm()` コールバックパターンに置き換わっている（計5箇所）。
7. `showSaving()` / `showSuccess()` は変更されていない。
8. 各ファイルの `node --check` が通る。

---

## 補足・注意事項

- **`html:` に `replace(/\n/g, "<br>")`**: メッセージ文字列内の `\n` を `<br>` に変換してから `html:` に渡すことで、改行が正しくレンダリングされる。渡す文字列はすべてソースコード内のハードコード値であり、ユーザー入力を含まないため XSS リスクはない。
- **`showConfirm()` 第4引数**: `hideCheckItem()` のみ `"非表示にする"` を渡す。削除系はすべてデフォルト (`"削除する"`) のままでよい。
- **`AppCore.run` の `withFailureHandler`**: `showError(error)` を呼んでいるが、これは `js_core.html` の `showError()` を呼ぶため自動で Swal に切り替わる。`AppCore.run` 自体の変更は不要。
- **`showSaving()` と Swal の z-index 競合**: SweetAlert2 のデフォルト z-index は 1060。現行 overlay は z-index を未指定（CSS クラス `overlay` で定義）。通常は GAS 通信中に Swal が開くケースはないため競合しないが、念のため `AppCore.run` の overlay と Swal が同時に表示されないことを動作確認すること。
