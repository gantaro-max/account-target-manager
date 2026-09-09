# 実装指示書：活動ログ updated_at 追加

作成日: 2026-05-20

---

## 概要

`activity_logs` シートに `updated_at` 列を追加し、ログの作成・更新日時をスプレッドシート上で確認できるようにする。フロントエンド（`_mapLog` / UI）への変更は不要。

---

## 事前作業（スプレッドシート）— 実装前に必ず実施

スプレッドシートの `activity_logs` シートを開き、既存ヘッダー行の**末尾列**に以下を追加する：

```
updated_at
```

列の位置は既存列（id, project_id, account_id, visit_date, content, accompanied_by, estimate_url, year, month）の右隣。

---

## 変更対象ファイル

1. `src/コード_v2_9.js`
2. `docs/DATABASE_DESIGN.md`

---

## 1. `src/コード_v2_9.js` の変更

### 1-1. `saveLog()` に `updated_at` を追加（line 543付近）

```javascript
// Before:
function saveLog(logData) {
  _appendRow(SHEET.LOGS, {
    id: logData.id,
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: logData.content,
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
  });
  return { ok: true };
}

// After:
function saveLog(logData) {
  _appendRow(SHEET.LOGS, {
    id: logData.id,
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: logData.content,
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
    updated_at: new Date(),
  });
  return { ok: true };
}
```

---

### 1-2. `updateLog()` に `updated_at` を追加（line 555付近）

```javascript
// Before:
function updateLog(logData) {
  const ok = _updateById(SHEET.LOGS, "id", logData.id, {
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: logData.content,
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
  });
  return { ok };
}

// After:
function updateLog(logData) {
  const ok = _updateById(SHEET.LOGS, "id", logData.id, {
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: logData.content,
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
    updated_at: new Date(),
  });
  return { ok };
}
```

---

### 1-3. `syncMyData()` でログの `updated_at` を保持（line 949付近）

`_upsertRows` はシートの全列をレコードの値で上書きするため、`updated_at` をマップに含めない場合は空欄で上書きされる。既存ログの `updated_at` を事前にキャプチャして保持する。

```javascript
// Before:
  // ── 5. activity_logs: 同様に Upsert + 孤立削除 ────────────────────────
  const snapLogIds = new Set((snapshot.logs || []).map((l) => l.id));

  _upsertRows(
    SHEET.LOGS,
    "id",
    (snapshot.logs || []).map((l) => ({
      id: l.id,
      project_id: l.projectId,
      account_id: l.accountId,
      visit_date: l.visitDate || "",
      content: l.content || "",
      accompanied_by: l.accompaniedBy || "なし",
      estimate_url: l.estimateUrl || "",
    })),
  );

// After:
  // ── 5. activity_logs: 同様に Upsert + 孤立削除 ────────────────────────
  const snapLogIds = new Set((snapshot.logs || []).map((l) => l.id));

  const existingLogUpdatedAt = {};
  _getRows(SHEET.LOGS).forEach((l) => {
    if (l.updated_at) existingLogUpdatedAt[l.id] = l.updated_at;
  });

  _upsertRows(
    SHEET.LOGS,
    "id",
    (snapshot.logs || []).map((l) => ({
      id: l.id,
      project_id: l.projectId,
      account_id: l.accountId,
      visit_date: l.visitDate || "",
      content: l.content || "",
      accompanied_by: l.accompaniedBy || "なし",
      estimate_url: l.estimateUrl || "",
      updated_at: existingLogUpdatedAt[l.id] || new Date(),
    })),
  );
```

---

## 2. `docs/DATABASE_DESIGN.md` の変更

`2.4 activity_logs` テーブル定義に `updated_at` 行を追加する。

```markdown
| updated_at     | updatedAt     | 最終更新日時（作成時も設定）      |
```

既存の `month` 行の下に追記する。

---

## DoD（完了条件）チェックリスト

- [ ] 1. （事前作業）スプレッドシートの `activity_logs` シートに `updated_at` 列を追加
- [ ] 2. `saveLog()`: `updated_at: new Date()` を `_appendRow` のオブジェクトに追加
- [ ] 3. `updateLog()`: `updated_at: new Date()` を `_updateById` のオブジェクトに追加
- [ ] 4. `syncMyData()`: `existingLogUpdatedAt` キャプチャを追加し、upsert マップに `updated_at: existingLogUpdatedAt[l.id] || new Date()` を追加
- [ ] 5. `DATABASE_DESIGN.md`: `activity_logs` テーブルに `updated_at` 列の定義を追加

---

## 注意事項

- `syncMyData` で `_getRows(SHEET.LOGS)` を追加するが、`_upsertRows` も内部で同シートを読む。シート読み取りが2回になるが、GAS Workspace プランの実行時間上限（30分）に対して問題のないレベル。
- `_mapLog()` および `db.logs` の変更は不要。フロントエンドには `updatedAt` を返さない。
