# 実装指示書 - Round 3: Google カレンダー連携

**作成日**: 2026-05-19
**対象ブランチ**: main
**担当**: Codex

---

## 1. 概要

案件の「次回アクション日」を Google カレンダーに自動同期する。

- 案件を新規登録（`saveProject`）かつ `nextActionDate` が入力されていれば → カレンダーイベントを作成し、生成されたイベントIDを `calendar_event_id` カラムに保存する
- 案件を更新（`updateProject`）したとき → `nextActionDate` があればイベントを作成/更新、なければイベントを削除する
- 案件を削除（`deleteProject`）したとき → カレンダーイベントも削除する

**フロントエンドの変更なし**。`src/コード_v2_9.js` のみ変更する。

---

## 2. スプレッドシートの準備（手動作業・コード変更なし）

`projects` シートの最右列に `calendar_event_id` カラムを追加する（Codexの作業対象外・ユーザーが実施）。

ヘッダー名: `calendar_event_id`（スネークケース）

---

## 3. `src/コード_v2_9.js` の変更

### 3-1. `_mapProject()` — `calendarEventId` フィールドを追加

```javascript
// 変更前
  function _mapProject(p, tz) {
    return {
      id: p.id || "",
      departmentId: p.department_id || "",
      accountId: p.account_id || "",
      name: p.name || "",
      targetProduct: p.target_product || "",
      currentStage: String(p.current_stage || "0"),
      latestNote: p.latest_note || "",
      nextActionDate: p.next_action_date
        ? Utilities.formatDate(new Date(p.next_action_date), tz, "yyyy-MM-dd")
        : "",
      nextActionText: p.next_action_text || "",
      nextActionAssignee: p.next_action_assignee || "",
      closingStatus: p.closing_status || "",
    };
  }

// 変更後
  function _mapProject(p, tz) {
    return {
      id: p.id || "",
      departmentId: p.department_id || "",
      accountId: p.account_id || "",
      name: p.name || "",
      targetProduct: p.target_product || "",
      currentStage: String(p.current_stage || "0"),
      latestNote: p.latest_note || "",
      nextActionDate: p.next_action_date
        ? Utilities.formatDate(new Date(p.next_action_date), tz, "yyyy-MM-dd")
        : "",
      nextActionText: p.next_action_text || "",
      nextActionAssignee: p.next_action_assignee || "",
      closingStatus: p.closing_status || "",
      calendarEventId: p.calendar_event_id || "",
    };
  }
```

### 3-2. カレンダー同期ヘルパー関数の追加

`_mapProject()` の直前（または `getActivePlans()` の後）に追加する。

```javascript
// ============================================================
// カレンダーイベント Upsert ヘルパー
// ============================================================
function _syncCalendarEvent(projId, projName, hospName, nextActionDate, nextActionText, existingEventId) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const title = hospName ? `[${hospName}] ${projName}` : projName;
    const description = nextActionText || "";

    if (!nextActionDate) {
      // 次回アクション日が空 → イベント削除
      if (existingEventId) {
        const ev = cal.getEventById(existingEventId);
        if (ev) ev.deleteEvent();
      }
      _updateById(SHEET.PROJECTS, "id", projId, { calendar_event_id: "" });
      return "";
    }

    const dateObj = new Date(nextActionDate + "T00:00:00");
    if (isNaN(dateObj.getTime())) return existingEventId || "";

    if (existingEventId) {
      // 既存イベントを更新
      const ev = cal.getEventById(existingEventId);
      if (ev) {
        ev.setTitle(title);
        ev.setDescription(description);
        ev.setAllDayDate(dateObj);
        return existingEventId;
      }
    }

    // 新規作成
    const newEv = cal.createAllDayEvent(title, dateObj, { description });
    const newId = newEv.getId();
    _updateById(SHEET.PROJECTS, "id", projId, { calendar_event_id: newId });
    return newId;
  } catch (e) {
    console.error("カレンダー同期エラー:", e);
    return existingEventId || "";
  }
}
```

### 3-3. `saveProject()` — 新規案件登録時にイベント作成

`_appendRow()` 呼び出しの後にカレンダー同期を追加する。

```javascript
// 変更前
function saveProject(projData) {
  _appendRow(SHEET.PROJECTS, {
    id: projData.id,
    department_id: projData.departmentId,
    account_id: projData.accountId,
    name: projData.name || "",
    target_product: projData.targetProduct || "",
    current_stage: "0",
    latest_note: "",
    next_action_date: "",
    next_action_text: "",
    next_action_assignee: "",
    closing_status: "",
    updated_at: new Date(),
  });
  return { ok: true };
}

// 変更後
function saveProject(projData) {
  _appendRow(SHEET.PROJECTS, {
    id: projData.id,
    department_id: projData.departmentId,
    account_id: projData.accountId,
    name: projData.name || "",
    target_product: projData.targetProduct || "",
    current_stage: "0",
    latest_note: "",
    next_action_date: "",
    next_action_text: "",
    next_action_assignee: "",
    closing_status: "",
    calendar_event_id: "",
    updated_at: new Date(),
  });
  if (projData.nextActionDate) {
    const accounts = _getRows(SHEET.ACCOUNTS);
    const hosp = accounts.find(h => h.id === projData.accountId);
    const hospName = hosp ? (hosp.name || "") : "";
    _syncCalendarEvent(
      projData.id, projData.name, hospName,
      projData.nextActionDate, projData.nextActionText, ""
    );
  }
  return { ok: true };
}
```

### 3-4. `updateProject()` — 案件更新時にイベントを更新/削除

```javascript
// 変更前
function updateProject(projData) {
  const ok = _updateById(SHEET.PROJECTS, "id", projData.id, {
    department_id: projData.departmentId,
    name: projData.name || "",
    target_product: projData.targetProduct || "",
    current_stage: projData.currentStage,
    latest_note: projData.latestNote || "",
    next_action_date: projData.nextActionDate || "",
    next_action_text: projData.nextActionText || "",
    next_action_assignee: projData.nextActionAssignee || "",
    closing_status: projData.closingStatus || "",
    updated_at: new Date(),
  });
  return { ok };
}

// 変更後
function updateProject(projData) {
  const ok = _updateById(SHEET.PROJECTS, "id", projData.id, {
    department_id: projData.departmentId,
    name: projData.name || "",
    target_product: projData.targetProduct || "",
    current_stage: projData.currentStage,
    latest_note: projData.latestNote || "",
    next_action_date: projData.nextActionDate || "",
    next_action_text: projData.nextActionText || "",
    next_action_assignee: projData.nextActionAssignee || "",
    closing_status: projData.closingStatus || "",
    updated_at: new Date(),
  });
  if (ok) {
    const accounts = _getRows(SHEET.ACCOUNTS);
    const hosp = accounts.find(h => h.id === projData.accountId);
    const hospName = hosp ? (hosp.name || "") : "";
    _syncCalendarEvent(
      projData.id, projData.name, hospName,
      projData.nextActionDate || "", projData.nextActionText || "",
      projData.calendarEventId || ""
    );
  }
  return { ok };
}
```

### 3-5. `deleteProject()` — 案件削除時にイベントを削除

```javascript
// 変更前
function deleteProject(id) {
  const ok = _deleteById(SHEET.PROJECTS, "id", id);
  _deleteAllByMatch(SHEET.LOGS, "project_id", id);
  return { ok };
}

// 変更後
function deleteProject(id) {
  // カレンダーイベントの削除（存在する場合）
  try {
    const projects = _getRows(SHEET.PROJECTS);
    const proj = projects.find(p => p.id === id);
    if (proj && proj.calendar_event_id) {
      const ev = CalendarApp.getDefaultCalendar().getEventById(proj.calendar_event_id);
      if (ev) ev.deleteEvent();
    }
  } catch (e) {
    console.error("カレンダーイベント削除エラー:", e);
  }
  const ok = _deleteById(SHEET.PROJECTS, "id", id);
  _deleteAllByMatch(SHEET.LOGS, "project_id", id);
  return { ok };
}
```

---

## 4. 補足・注意事項

- `_syncCalendarEvent()` 内の `_updateById()` は `calendar_event_id` だけを書き戻す。スプレッドシートにこのカラムが存在しない場合は何も書き込まれないため、**スプレッドシートへのカラム追加をユーザーが先に実施してから本変更をデプロイすること**。
- CalendarApp はデフォルトカレンダー（本人のGoogleカレンダー）を使用する。共有カレンダーを使いたい場合は `CalendarApp.getCalendarById(id)` に変更する（将来の拡張）。
- エラー時は `console.error` に記録してスローせず、保存処理は継続させる（カレンダー連携の失敗で案件保存を妨げない）。

---

## 5. 完了条件 (Definition of Done)

- [ ] `_mapProject()` に `calendarEventId` フィールドが追加されている
- [ ] `_syncCalendarEvent()` ヘルパーが追加されている
- [ ] 案件新規登録時（`saveProject`）に `nextActionDate` があればカレンダーイベントが作成される
- [ ] 案件更新時（`updateProject`）に `nextActionDate` を変更するとカレンダーイベントが更新される
- [ ] 案件更新時に `nextActionDate` を空にするとカレンダーイベントが削除される
- [ ] 案件削除時（`deleteProject`）にカレンダーイベントも削除される
- [ ] カレンダー操作中にエラーが発生しても案件の保存/削除処理は継続される
- [ ] GASエディタで構文エラーなし
