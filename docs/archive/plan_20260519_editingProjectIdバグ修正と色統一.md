# 実装指示書 - editingProjectId リセットバグ修正 & targetProduct 色統一

**作成日**: 2026-05-19
**対象ブランチ**: main
**担当**: Codex

---

## 1. 概要

2件の修正を行う。いずれも `src/js_account.html` のみが対象。

1. **バグ修正**: 案件編集中（tabIdx=3）に別の取引先を選択しても `editingProjectId` がリセットされず、誤って別取引先の案件を上書きできてしまう
2. **色統一**: `renderBasicInfo()` 内の対象製品表示が `var(--muted)` のまま（他箇所はすでに `var(--gray)` に修正済み）

---

## 2. 修正① editingProjectId リセットバグ

### 変更対象

`src/js_account.html` の `changeAccount()` 関数内、既存の `cancelEditLog()` ガードの直後・`renderAll()` の直前に1行追加する。

```javascript
// 変更前
    if (tabIdx === 0 && typeof cancelEditLog === "function") cancelEditLog();
    renderAll();

// 変更後
    if (tabIdx === 0 && typeof cancelEditLog === "function") cancelEditLog();
    if (tabIdx === 3 && typeof cancelEditProject === "function") cancelEditProject();
    renderAll();
```

### 補足

- `typeof cancelEditProject === "function"` のガードはロード順の安全策（`cancelEditProject` は `js_project.html` で定義）。
- `tabIdx === 3` のとき（取引先登録・編集タブ）のみリセット。他のタブ（0, 1）は対象外。
- `cancelEditProject()` は `editingProjectId = null` を行い、フォームボタンを「案件を追加」に戻す。

---

## 3. 修正② renderBasicInfo() 内の targetProduct 文字色統一

### 変更対象

`src/js_account.html` の `renderBasicInfo()` 内、案件一覧行の `targetProduct` 表示スパン。

```javascript
// 変更前
color:var(--muted);

// 変更後
color:var(--gray);
```

対象箇所の文字列（前後コンテキスト）:

```
<span style="font-size:11px; color:var(--muted); margin-left:8px;">(${p.targetProduct || ""})</span>
```

↓

```
<span style="font-size:11px; color:var(--gray); margin-left:8px;">(${p.targetProduct || ""})</span>
```

`replace_all=False` で1箇所のみ（他のファイルは既に修正済みのため、このファイル内のこの1箇所のみ対象）。

---

## 4. 完了条件 (Definition of Done)

- [ ] 案件編集中（「更新」ボタンが表示された状態）に取引先セレクトで別の取引先に切り替えると、フォームが「案件を追加」状態にリセットされる
- [ ] フォームリセット後、新しく選択した取引先の案件一覧・部署リストが正しく表示される
- [ ] 活動ログタブ（tabIdx=0）の動作に影響がない
- [ ] `renderBasicInfo()` の対象製品表示が `var(--gray)` になっている
- [ ] `node --check` で構文エラーなし
