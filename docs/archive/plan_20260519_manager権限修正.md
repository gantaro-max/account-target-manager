# 実装指示書 - manager権限の閲覧スコープ修正

**作成日**: 2026-05-19
**対象ブランチ**: main
**担当**: Codex

---

## 1. 概要

manager（責任者）権限に関する2点の仕様修正を行う。

1. **全取引先の閲覧**: managerは担当取引先だけでなく、全取引先の活動ログ・案件情報を閲覧できるようにする
2. **サマリーのユーザー選択を限定**: managerのサマリータブに表示するユーザー選択は `leader` と `member` のみ（managerに担当取引先はないため）
3. **保存ボタンの非表示**: managerは閲覧専用のため、グローバル同期ボタンを非表示にする

**変更ファイル**: `src/index.html`、`src/js.html`

---

## 2. `src/index.html` の変更

### 2-1. グローバル同期ボタンに `manager-hidden` クラスを追加

```html
<!-- 変更前 -->
        <button id="global-sync-btn" class="save-btn" onclick="saveAll()">
          ☁️ クラウド同期
        </button>

<!-- 変更後 -->
        <button id="global-sync-btn" class="save-btn manager-hidden" onclick="saveAll()">
          ☁️ クラウド同期
        </button>
```

---

## 3. `src/js.html` の変更

### 3-1. `init()` — 取引先データのロードフィルター

`getInitialData` の `withSuccessHandler` 内、`db.accounts` 代入箇所を変更する。

```javascript
// 変更前
        if (currentUserRole === "admin") {
          db.accounts = serverData.accounts || [];
        } else {
          db.accounts = (serverData.accounts || []).filter(
            (h) => h.assignedUserId === currentUserEmail,
          );
        }

// 変更後
        if (currentUserRole === "admin" || currentUserRole === "manager") {
          db.accounts = serverData.accounts || [];
        } else {
          db.accounts = (serverData.accounts || []).filter(
            (h) => h.assignedUserId === currentUserEmail,
          );
        }
```

### 3-2. `init()` — サマリーのユーザー選択フィルター

`selectableUsers` の定義を変更する。

```javascript
// 変更前
          const selectableUsers = allUsers.filter((u) => u.role !== "admin");

// 変更後
          const selectableUsers =
            currentUserRole === "manager"
              ? allUsers.filter(
                  (u) => u.role === "leader" || u.role === "member",
                )
              : allUsers.filter((u) => u.role !== "admin");
```

---

## 4. 完了条件 (Definition of Done)

- [ ] managerでログイン時、全取引先がTab 0・Tab 1の取引先選択プルダウンに表示される
- [ ] managerのサマリーユーザー選択に `leader` と `member` のユーザーのみ表示される（`manager` は含まない）
- [ ] managerのヘッダーにあるグローバル同期ボタン（☁️ クラウド同期）が非表示になっている
- [ ] admin・leader・member の動作は変わらない
- [ ] `node --check` で構文エラーなし
