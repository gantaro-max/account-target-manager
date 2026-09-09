// ============================================================
// 取引先ターゲット管理アプリ - Google Apps Script バックエンド
// v2.9
// ============================================================

const SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty("SHEET_ID");

const SHEET = {
  ACCOUNTS: "accounts",
  DEPARTMENTS: "departments",
  PROJECTS: "projects",
  LOGS: "activity_logs",
  REVIEWS: "monthly_reviews",
  CHECK_ITEMS: "review_check_items",
  USERS: "users",
  MASTER: "master_list",
  CAMPAIGNS: "campaigns",
  STAGE_HISTORY: "stage_history",
};

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// 1. エントリポイント
// ============================================================
function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("取引先ターゲット管理アプリ")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
    );
}

// ============================================================
// 2. 低レベルヘルパー
// ============================================================
function _ss() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
function _sheet(name) {
  const s = _ss().getSheetByName(name);
  if (!s) throw new Error(`シート "${name}" が見つかりません`);
  return s;
}
function _getRows(sheetName) {
  const data = _sheet(sheetName).getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map((row) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = row[i];
    });
    return o;
  });
}
function _sanitizeCell(v) {
  if (typeof v === "string" && /^[=+@]/.test(v)) return "'" + v;
  return v;
}
function _appendRow(sheetName, obj) {
  const sheet = _sheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map((h) => (obj[h] !== undefined ? obj[h] : "")));
}
function _updateById(sheetName, idCol, idVal, obj) {
  const sheet = _sheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf(idCol);
  if (idIdx === -1) return false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(idVal)) {
      const row = headers.map((h, j) =>
        obj[h] !== undefined ? obj[h] : data[i][j],
      );
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return true;
    }
  }
  return false;
}
function _deleteById(sheetName, idCol, idVal) {
  const sheet = _sheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf(idCol);
  if (idIdx === -1) return false;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIdx]) === String(idVal)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}
function _deleteAllByMatch(sheetName, idCol, idVal) {
  const sheet = _sheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf(idCol);
  if (idIdx === -1) return false;

  // 下から順に削除しないと行番号がズレるため逆ループ
  let deletedCount = 0;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idIdx]) === String(idVal)) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  return deletedCount > 0;
}
function _overwriteRows(sheetName, headers, rows) {
  const sheet = _sheet(sheetName);
  const existHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, existHeaders.length).clearContent();
  }
  if (rows.length === 0) return;
  const sorted = rows.map((row) =>
    existHeaders.map((h) => {
      const idx = headers.indexOf(h);
      return idx !== -1 ? row[idx] : "";
    }),
  );
  sheet.getRange(2, 1, sorted.length, existHeaders.length).setValues(sorted);
}

// ============================================================
// 3. 権限・マッピング
// ============================================================
function _getMyRole() {
  const email = Session.getActiveUser().getEmail();
  const users = _getRows(SHEET.USERS);
  const me = users.find((u) => u.user_id === email);
  return me ? me.role : "member";
}
function _requireRegisteredUser() {
  const email = String(Session.getActiveUser().getEmail() || "").trim();
  if (!email) throw new Error("この操作にはユーザー登録が必要です");
  const users = _getRows(SHEET.USERS);
  const me = users.find((u) => String(u.user_id || "").trim() === email);
  if (!me) throw new Error("この操作にはユーザー登録が必要です");
  return me;
}
function _requireAdmin() {
  if (_getMyRole() !== "admin")
    throw new Error("この操作には管理者権限が必要です");
}
function _requireManager() {
  const r = _getMyRole();
  if (r !== "admin" && r !== "manager")
    throw new Error("この操作には責任者以上の権限が必要です");
}

function _mapAccount(h) {
  return {
    id: h.id || "",
    code: h.code || "",
    name: h.name || "",
    addr: h.addr || "",
    corp: h.corp || "",
    beds: h.beds || "",
    partner: h.partner_name || "",
    deptList: h.dept_list || "",
    ward: h.ward_info || "",
    priority: h.priority || "mid",
    equipment: h.equipment || "",
    note: h.note || "",
    assignedUserId: h.assigned_user_id || "",
  };
}
function _mapDepartment(d) {
  return {
    id: d.id || "",
    accountId: d.account_id || "",
    name: d.name || "",
    keymanRole: d.keyman_role || "",
    keymanName: d.keyman_name || "",
  };
}
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
function _mapLog(l, tz) {
  let dateStr = "",
    year = 0,
    month = 0;
  if (l.visit_date) {
    const d = new Date(l.visit_date);
    if (!isNaN(d.getTime())) {
      dateStr = Utilities.formatDate(d, tz, "yyyy-MM-dd");
      year = d.getFullYear();
      month = d.getMonth() + 1;
    }
  }
  return {
    id: l.id || "",
    projectId: l.project_id || "",
    accountId: l.account_id || "",
    visitDate: dateStr,
    content: l.content || "",
    accompaniedBy: l.accompanied_by || "なし",
    estimateUrl: l.estimate_url || "",
    year,
    month,
  };
}
function _mapReview(r) {
  let key = "";
  if (r.year_month) {
    const d = new Date(r.year_month);
    key = isNaN(d.getTime())
      ? String(r.year_month)
      : `${d.getFullYear()}-${d.getMonth() + 1}`;
  }
  let checks = {};
  try {
    checks = r.self_check_answers ? JSON.parse(r.self_check_answers) : {};
  } catch (e) {}
  return {
    key,
    eval: r.evaluation || "",
    comment: r.manager_comment || "",
    checks,
  };
}
function _mapCheckItem(item) {
  return {
    id: item.id || "",
    text: item.text || "",
    sortOrder: Number(item.sort_order) || 0,
    isActive: item.is_active === true || item.is_active === "TRUE",
  };
}

// ============================================================
// 4. データ一括取得
// ============================================================
function getInitialData() {
  const email = Session.getActiveUser().getEmail();
  const tz = Session.getScriptTimeZone();

  const users = _getRows(SHEET.USERS);
  const myRecord = users.find((u) => u.user_id === email) || {};
  const myRole = myRecord.role || "member";
  const myName = myRecord.name || "未登録ユーザー";
  const allUsers = users.map((u) => ({
    email: u.user_id,
    name: u.name,
    role: u.role,
  }));

  const allAccounts = _getRows(SHEET.ACCOUNTS).map(_mapAccount);
  const isOwnScopeRole = myRole === "leader" || myRole === "member";
  const accounts = isOwnScopeRole
    ? allAccounts.filter((h) => h.assignedUserId === email)
    : allAccounts;
  const visibleAccountIds = new Set(accounts.map((h) => h.id));
  const departments = _getRows(SHEET.DEPARTMENTS)
    .map(_mapDepartment)
    .filter((d) => !isOwnScopeRole || visibleAccountIds.has(d.accountId));
  const projects = _getRows(SHEET.PROJECTS)
    .map((p) => _mapProject(p, tz))
    .filter((p) => !isOwnScopeRole || visibleAccountIds.has(p.accountId));
  const logs = _getRows(SHEET.LOGS)
    .map((l) => _mapLog(l, tz))
    .filter((l) => !isOwnScopeRole || visibleAccountIds.has(l.accountId));

  const leaderMemberUsers = allUsers.filter(
    (u) => u.role === "leader" || u.role === "member",
  );
  const leaderMemberEmails = new Set(leaderMemberUsers.map((u) => u.email));
  const userNameByEmail = {};
  leaderMemberUsers.forEach((u) => {
    userNameByEmail[u.email] = u.name || "";
  });
  const otherAccounts = isOwnScopeRole
    ? allAccounts
        .filter(
          (h) =>
            leaderMemberEmails.has(h.assignedUserId) &&
            h.assignedUserId !== email,
        )
        .map((h) => ({
          id: h.id,
          name: h.name,
          assignedUserId: h.assignedUserId,
          assignedUserName: userNameByEmail[h.assignedUserId] || "",
        }))
    : [];

  // 有効な設問だけでなく、論理削除(非表示)された設問も含めて全件取得する
  const checkItems = _getRows(SHEET.CHECK_ITEMS)
    .map(_mapCheckItem)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const reviews = {};
  _getRows(SHEET.REVIEWS).forEach((r) => {
    if (
      myRole !== "admin" &&
      myRole !== "manager" &&
      myRole !== "leader" &&
      r.user_id !== email
    )
      return;
    if (!reviews[r.user_id]) reviews[r.user_id] = {};
    const mapped = _mapReview(r);
    if (mapped.key)
      reviews[r.user_id][mapped.key] = {
        eval: mapped.eval,
        comment: mapped.comment,
        checks: mapped.checks,
      };
  });

  const masterAccounts = _getRows(SHEET.MASTER).map((m) => ({
    code: m.code || "",
    name: m.name || "",
    partner: m.partner || "",
    office: m.office || "",
    address: m.address || "",
  }));

  return {
    currentUser: { email, name: myName, role: myRole },
    allUsers,
    accounts,
    departments,
    projects,
    logs,
    checkItems,
    reviews,
    masterAccounts,
    otherAccounts,
  };
}

function getAccountDetailBulk(accountIds) {
  const email = Session.getActiveUser().getEmail();
  const tz = Session.getScriptTimeZone();

  const users = _getRows(SHEET.USERS);
  const me = users.find((u) => u.user_id === email) || {};
  const myRole = me.role || "member";
  if (myRole !== "leader" && myRole !== "member") {
    throw new Error("他担当者取引先の詳細参照権限がありません");
  }

  const leaderMemberEmails = new Set(
    users
      .filter((u) => u.role === "leader" || u.role === "member")
      .map((u) => u.user_id),
  );

  const allAccounts = _getRows(SHEET.ACCOUNTS).map(_mapAccount);
  const validIds = (accountIds || []).filter((id) => {
    const h = allAccounts.find((h) => h.id === id);
    return (
      h &&
      leaderMemberEmails.has(h.assignedUserId) &&
      h.assignedUserId !== email
    );
  });

  if (validIds.length === 0) return {};

  const allDepts = _getRows(SHEET.DEPARTMENTS).map(_mapDepartment);
  const allProjects = _getRows(SHEET.PROJECTS).map((p) => _mapProject(p, tz));
  const allLogs = _getRows(SHEET.LOGS).map((l) => _mapLog(l, tz));

  const result = {};
  validIds.forEach((id) => {
    result[id] = {
      departments: allDepts.filter((d) => d.accountId === id),
      projects: allProjects.filter((p) => p.accountId === id),
      logs: allLogs.filter((l) => l.accountId === id),
    };
  });
  return result;
}

function getAccountDetail(accountId) {
  const email = Session.getActiveUser().getEmail();
  const tz = Session.getScriptTimeZone();

  const users = _getRows(SHEET.USERS);
  const me = users.find((u) => u.user_id === email) || {};
  const myRole = me.role || "member";
  if (myRole !== "leader" && myRole !== "member") {
    throw new Error("他担当者取引先の詳細参照権限がありません");
  }

  const leaderMemberEmails = new Set(
    users
      .filter((u) => u.role === "leader" || u.role === "member")
      .map((u) => u.user_id),
  );

  const account = _getRows(SHEET.ACCOUNTS)
    .map(_mapAccount)
    .find((h) => h.id === accountId);
  if (!account) throw new Error("指定された取引先が見つかりません");
  if (!leaderMemberEmails.has(account.assignedUserId)) {
    throw new Error("指定された取引先は参照対象外です");
  }
  if (account.assignedUserId === email) {
    throw new Error("自分の担当取引先は初期データから参照してください");
  }

  return {
    departments: _getRows(SHEET.DEPARTMENTS)
      .map(_mapDepartment)
      .filter((d) => d.accountId === accountId),
    projects: _getRows(SHEET.PROJECTS)
      .map((p) => _mapProject(p, tz))
      .filter((p) => p.accountId === accountId),
    logs: _getRows(SHEET.LOGS)
      .map((l) => _mapLog(l, tz))
      .filter((l) => l.accountId === accountId),
  };
}

function getActivePlans() {
  const sheet = _ss().getSheetByName(SHEET.CAMPAIGNS);
  if (!sheet) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  const idxName = headers.indexOf("name");
  const idxStartDate = headers.indexOf("start_date");
  const idxEndDate = headers.indexOf("end_date");
  const idxDesc = headers.indexOf("description");
  const idxItem = headers.indexOf("item");

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[idxName]) continue;

    const start = row[idxStartDate] ? new Date(row[idxStartDate]) : null;
    const end = row[idxEndDate] ? new Date(row[idxEndDate]) : null;

    const isActive = (!start || start <= today) && (!end || end >= today);
    if (!isActive) continue;

    result.push({
      name: String(row[idxName]),
      description: idxDesc >= 0 ? String(row[idxDesc] || "") : "",
      item: idxItem >= 0 ? String(row[idxItem] || "") : "",
    });
  }
  return result;
}

function getPlans() {
  _requireManager();
  const sheet = _ss().getSheetByName(SHEET.CAMPAIGNS);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  const headers = rows[0];
  const idx = {
    id: headers.indexOf("id"),
    name: headers.indexOf("name"),
    description: headers.indexOf("description"),
    item: headers.indexOf("item"),
    startDate: headers.indexOf("start_date"),
    endDate: headers.indexOf("end_date"),
  };
  const tz = Session.getScriptTimeZone();
  return rows
    .slice(1)
    .filter((r) => r[idx.id])
    .map((r) => ({
      id: String(r[idx.id] || ""),
      name: String(r[idx.name] || ""),
      description: String(r[idx.description] || ""),
      item: String(r[idx.item] || ""),
      startDate: r[idx.startDate]
        ? Utilities.formatDate(new Date(r[idx.startDate]), tz, "yyyy-MM-dd")
        : "",
      endDate: r[idx.endDate]
        ? Utilities.formatDate(new Date(r[idx.endDate]), tz, "yyyy-MM-dd")
        : "",
    }));
}

function saveCampaign(campaign) {
  _requireManager();
  const campaignName = String(campaign.name || "").trim();
  if (!campaignName) throw new Error("キャンペーン名は必須です");

  if (campaign.id) {
    _updateById(SHEET.CAMPAIGNS, "id", campaign.id, {
      name: campaignName,
      description: campaign.description || "",
      item: campaign.item || "",
      start_date: campaign.startDate || "",
      end_date: campaign.endDate || "",
    });
    return { ok: true, id: campaign.id };
  }

  const newId = "cp" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
  _appendRow(SHEET.CAMPAIGNS, {
    id: newId,
    name: campaignName,
    description: campaign.description || "",
    item: campaign.item || "",
    start_date: campaign.startDate || "",
    end_date: campaign.endDate || "",
  });
  return { ok: true, id: newId };
}

function deleteCampaign(campaignId) {
  _requireManager();
  return { ok: _deleteById(SHEET.CAMPAIGNS, "id", campaignId) };
}

// ============================================================
// カレンダーイベント Upsert ヘルパー
// ============================================================
function _syncCalendarEvent(
  projId,
  projName,
  hospName,
  nextActionDate,
  nextActionText,
  existingEventId,
) {
  // カレンダー連携を無効化中。
  // 理由: GAS はスクリプトオーナーの CalendarApp として動作するため、
  // 全イベントがオーナー1人のカレンダーに集約され、担当者個人のカレンダーに反映されない。
  // 再有効化には担当者ごとの OAuth トークン取得・管理の仕組みが必要。
  // 設計が固まり次第 TASKS.md のカレンダー連携タスクを参照して実装すること。
  return existingEventId || "";
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const title = hospName ? `[${hospName}] ${projName}` : projName;
    const description = nextActionText || "";

    if (!nextActionDate) {
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
      const ev = cal.getEventById(existingEventId);
      if (ev) {
        ev.setTitle(title);
        ev.setDescription(description);
        ev.setAllDayDate(dateObj);
        return existingEventId;
      }
    }

    const newEv = cal.createAllDayEvent(title, dateObj, { description });
    const newId = newEv.getId();
    _updateById(SHEET.PROJECTS, "id", projId, { calendar_event_id: newId });
    return newId;
  } catch (e) {
    console.error("カレンダー同期エラー:", e);
    return existingEventId || "";
  }
}

// ============================================================
// 5. CRUD関数
// ============================================================

function deleteCheckItem(id) {
  _requireManager();
  const ok = _deleteById(SHEET.CHECK_ITEMS, "id", id);
  return { ok };
}

// 並び順だけでなく、設問データ全体を一括で上書き保存する
function updateCheckItemOrder(items) {
  _requireManager();
  _overwriteRows(
    SHEET.CHECK_ITEMS,
    ["id", "text", "sort_order", "is_active"],
    items.map((item) => [item.id, item.text, item.sortOrder, item.isActive]),
  );
  return { ok: true };
}

function saveLog(logData) {
  _requireRegisteredUser();
  _appendRow(SHEET.LOGS, {
    id: logData.id,
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: _sanitizeCell(logData.content),
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
    updated_at: new Date(),
  });
  return { ok: true };
}
function updateLog(logData) {
  _requireRegisteredUser();
  const ok = _updateById(SHEET.LOGS, "id", logData.id, {
    project_id: logData.projectId,
    account_id: logData.accountId,
    visit_date: logData.visitDate,
    content: _sanitizeCell(logData.content),
    accompanied_by: logData.accompaniedBy || "なし",
    estimate_url: logData.estimateUrl || "",
    updated_at: new Date(),
  });
  return { ok };
}
function deleteLog(id) {
  _requireRegisteredUser();
  return { ok: _deleteById(SHEET.LOGS, "id", id) };
}
function updateProject(projData) {
  const email = Session.getActiveUser().getEmail();
  const projects = _getRows(SHEET.PROJECTS);
  const existingProject = projects.find((p) => p.id === projData.id);
  const existingCalendarEventId =
    projData.calendarEventId ||
    (existingProject ? existingProject.calendar_event_id || "" : "");
  const oldStage = existingProject
    ? String(existingProject.current_stage || "0")
    : null;
  const newStage = String(projData.currentStage || "0");
  const ok = _updateById(SHEET.PROJECTS, "id", projData.id, {
    department_id: projData.departmentId, // 部署の変更にも対応
    name: projData.name || "", // 名前変更に対応
    target_product: projData.targetProduct || "", // 商材変更に対応
    current_stage: newStage,
    latest_note: projData.latestNote || "",
    next_action_date: projData.nextActionDate || "",
    next_action_text: projData.nextActionText || "",
    next_action_assignee: projData.nextActionAssignee || "",
    closing_status: projData.closingStatus || "",
    updated_at: new Date(),
  });
  if (ok) {
    if (oldStage !== null && oldStage !== newStage) {
      _appendStageHistory(projData.id, projData.accountId, newStage, email);
    }
    const accounts = _getRows(SHEET.ACCOUNTS);
    const hosp = accounts.find((h) => h.id === projData.accountId);
    const hospName = hosp ? hosp.name || "" : "";
    _syncCalendarEvent(
      projData.id,
      projData.name,
      hospName,
      projData.nextActionDate || "",
      projData.nextActionText || "",
      existingCalendarEventId,
    );
  }
  return { ok };
}
function _appendStageHistory(projectId, accountId, stage, changedBy, userNameMap) {
  let displayName = changedBy;
  if (userNameMap) {
    displayName = userNameMap[changedBy] || changedBy;
  } else {
    const users = _getRows(SHEET.USERS);
    const user = users.find((u) => u.user_id === changedBy);
    displayName = user && user.name ? user.name : changedBy;
  }
  _appendRow(SHEET.STAGE_HISTORY, {
    id: Utilities.getUuid(),
    project_id: projectId,
    account_id: accountId,
    stage: String(stage),
    changed_at: new Date(),
    changed_by: displayName,
  });
}
function saveProject(projData) {
  const email = Session.getActiveUser().getEmail();
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
    const hosp = accounts.find((h) => h.id === projData.accountId);
    const hospName = hosp ? hosp.name || "" : "";
    _syncCalendarEvent(
      projData.id,
      projData.name,
      hospName,
      projData.nextActionDate,
      projData.nextActionText,
      "",
    );
  }
  _appendStageHistory(projData.id, projData.accountId, "0", email);
  return { ok: true };
}
function deleteProject(id) {
  try {
    const projects = _getRows(SHEET.PROJECTS);
    const proj = projects.find((p) => p.id === id);
    if (proj && proj.calendar_event_id) {
      const ev = CalendarApp.getDefaultCalendar().getEventById(
        proj.calendar_event_id,
      );
      if (ev) ev.deleteEvent();
    }
  } catch (e) {
    console.error("カレンダーイベント削除エラー:", e);
  }
  // 1. 案件本体を削除
  const ok = _deleteById(SHEET.PROJECTS, "id", id);
  // 2. この案件に紐づく活動ログ・ステージ変更履歴も全て削除
  _deleteAllByMatch(SHEET.LOGS, "project_id", id);
  _deleteAllByMatch(SHEET.STAGE_HISTORY, "project_id", id);

  return { ok };
}

// 部署の更新
function updateDepartment(deptData) {
  const ok = _updateById(SHEET.DEPARTMENTS, "id", deptData.id, {
    name: deptData.name || "",
    keyman_role: deptData.keymanRole || "",
    keyman_name: deptData.keymanName || "",
  });
  return { ok };
}

function saveDepartment(deptData) {
  _appendRow(SHEET.DEPARTMENTS, {
    id: deptData.id,
    account_id: deptData.accountId,
    name: deptData.name || "",
    keyman_role: deptData.keymanRole || "",
    keyman_name: deptData.keymanName || "",
  });
  return { ok: true };
}
function deleteDepartmentWithCascade(departmentId) {
  // 1. 紐づく案件のIDリストを取得（ログ削除に必要）
  const projectSheet = _sheet(SHEET.PROJECTS);
  const projectData = projectSheet.getDataRange().getValues();
  const pHeaders = projectData[0];
  const pIdIdx = pHeaders.indexOf("id");
  const pDeptIdx = pHeaders.indexOf("department_id");

  const projectIds = projectData
    .slice(1)
    .filter((row) => String(row[pDeptIdx]) === String(departmentId))
    .map((row) => row[pIdIdx]);

  // 2. 部署本体・案件を削除
  _deleteById(SHEET.DEPARTMENTS, "id", departmentId);
  _deleteAllByMatch(SHEET.PROJECTS, "department_id", departmentId);

  // 3. 紐づく活動ログ・ステージ変更履歴を削除（案件IDごとに実行）
  projectIds.forEach((pid) => {
    _deleteAllByMatch(SHEET.LOGS, "project_id", pid);
    _deleteAllByMatch(SHEET.STAGE_HISTORY, "project_id", pid);
  });

  return { ok: true };
}
function saveNewAccount(hospData) {
  const userEmail = Session.getActiveUser().getEmail();

  // ── 重複チェック（最終防衛ライン） ──────────────────────────────────
  const existing = _getRows(SHEET.ACCOUNTS);
  const trimCode = String(hospData.code || "").trim();
  const trimName = String(hospData.name || "").trim();

  if (trimName) {
    // 名前が空のときはスキップ（必須バリデーションは呼び出し元で実施済み）
    const duplicate = existing.find((h) => {
      if (trimCode !== "") {
        // code あり → code が入っている既存行と比較
        const hCode = String(h.code || "").trim();
        return hCode !== "" && hCode === trimCode;
      } else {
        // code なし → 担当者の登録取引先内で名前の完全一致を確認
        return (
          String(h.assigned_user_id || "") === userEmail &&
          String(h.name || "").trim() === trimName
        );
      }
    });

    if (duplicate) {
      const reason =
        trimCode !== "" ? `コード「${trimCode}」` : `取引先名「${trimName}」`;
      throw new Error(
        `重複エラー: 同じ${reason}の取引先が既に存在します（既存ID: ${duplicate.id}）`,
      );
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  _appendRow(SHEET.ACCOUNTS, {
    id: hospData.id,
    code: hospData.code || "",
    name: hospData.name || "",
    addr: hospData.addr || "",
    corp: hospData.corp || "",
    beds: hospData.beds || "",
    partner_name: hospData.partner || "",
    dept_list: hospData.deptList || "",
    ward_info: hospData.ward || "",
    priority: hospData.priority || "mid",
    equipment: hospData.equipment || "",
    note: hospData.note || "",
    assigned_user_id: userEmail,
  });
  return { ok: true };
}
function updateAccount(hospData) {
  const ok = _updateById(SHEET.ACCOUNTS, "id", hospData.id, {
    code: hospData.code || "",
    name: hospData.name || "",
    addr: hospData.addr || "",
    corp: hospData.corp || "",
    beds: hospData.beds || "",
    partner_name: hospData.partner || "",
    dept_list: hospData.deptList || "",
    ward_info: hospData.ward || "",
    priority: hospData.priority || "mid",
    equipment: hospData.equipment || "",
    note: hospData.note || "",
  });
  return { ok };
}
function deleteAccountWithCascade(accountId) {
  _requireAdmin(); // 取引先削除は管理者のみとするのが安全です

  // 1. 取引先本体を削除
  _deleteById(SHEET.ACCOUNTS, "id", accountId);
  // 2. 紐づく部署を削除
  _deleteAllByMatch(SHEET.DEPARTMENTS, "account_id", accountId);
  // 3. 紐づく案件を削除
  _deleteAllByMatch(SHEET.PROJECTS, "account_id", accountId);
  // 4. 紐づく活動ログ・ステージ変更履歴を削除
  _deleteAllByMatch(SHEET.LOGS, "account_id", accountId);
  _deleteAllByMatch(SHEET.STAGE_HISTORY, "account_id", accountId);

  return { ok: true };
}

function _buildCsv(headers, rows) {
  const esc = (v) => {
    const s = String(v == null ? "" : v);
    return s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  return "\ufeff" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

function getCsvData(type) {
  const email = Session.getActiveUser().getEmail();
  const role = _getMyRole();
  const isAll = role === "admin" || role === "manager";
  const tz = Session.getScriptTimeZone();

  const accounts = _getRows(SHEET.ACCOUNTS);
  const myHospIds = new Set(
    accounts
      .filter((h) => isAll || h.assigned_user_id === email)
      .map((h) => h.id),
  );

  const users = _getRows(SHEET.USERS);
  const userNameMap = {};
  users.forEach((u) => {
    userNameMap[u.user_id] = u.name || u.user_id;
  });

  const hospMap = {};
  accounts.forEach((h) => {
    hospMap[h.id] = { name: h.name, userId: h.assigned_user_id };
  });

  if (type === "logs") {
    const projects = _getRows(SHEET.PROJECTS);
    const departments = _getRows(SHEET.DEPARTMENTS);
    const logs = _getRows(SHEET.LOGS);

    const projMap = {};
    projects.forEach((p) => {
      projMap[p.id] = { name: p.name, deptId: p.department_id };
    });
    const deptMap = {};
    departments.forEach((d) => {
      deptMap[d.id] = d.name;
    });

    const headers = [
      "担当者名",
      "取引先名",
      "部署名",
      "案件名",
      "訪問日",
      "活動内容",
      "同行者",
      "添付URL",
      "更新日時",
    ];
    const rows = logs
      .filter((l) => myHospIds.has(l.account_id))
      .map((l) => {
        const proj = projMap[l.project_id] || {};
        const hosp = hospMap[l.account_id] || {};
        return [
          userNameMap[hosp.userId] || hosp.userId || "",
          hosp.name || "",
          deptMap[proj.deptId] || "",
          proj.name || "",
          l.visit_date && !isNaN(new Date(l.visit_date).getTime())
            ? Utilities.formatDate(new Date(l.visit_date), tz, "yyyy/MM/dd")
            : "",
          l.content || "",
          l.accompanied_by || "",
          l.estimate_url || "",
          l.updated_at
            ? Utilities.formatDate(new Date(l.updated_at), tz, "yyyy-MM-dd HH:mm")
            : "",
        ];
      });

    return _buildCsv(headers, rows);
  }

  if (type === "projects") {
    const STAGE_LABELS_CSV = [
      "0：未接触",
      "1：初回訪問済",
      "2：ニーズ確認中",
      "3：提案実施中",
      "4：クロージング",
    ];
    const projects = _getRows(SHEET.PROJECTS);
    const departments = _getRows(SHEET.DEPARTMENTS);
    const deptMap = {};
    departments.forEach((d) => {
      deptMap[d.id] = d.name;
    });

    const headers = [
      "担当者名",
      "取引先名",
      "部署名",
      "案件名",
      "対象製品",
      "進捗ステージ",
      "最新課題メモ",
      "次回予定日",
      "ネクストアクション",
      "アクション担当者",
      "受注/失注",
    ];
    const rows = projects
      .filter((p) => myHospIds.has(p.account_id))
      .map((p) => {
        const hosp = hospMap[p.account_id] || {};
        const stageNum = parseInt(p.current_stage, 10) || 0;
        return [
          userNameMap[hosp.userId] || hosp.userId || "",
          hosp.name || "",
          deptMap[p.department_id] || "",
          p.name || "",
          p.target_product || "",
          STAGE_LABELS_CSV[stageNum] || String(stageNum),
          p.latest_note || "",
          p.next_action_date || "",
          p.next_action_text || "",
          p.next_action_assignee || "",
          p.closing_status || "",
        ];
      });

    return _buildCsv(headers, rows);
  }

  throw new Error("不正なtype: " + type);
}

function getProjectReport(nameQuery) {
  _requireRegisteredUser();
  const tz = Session.getScriptTimeZone();

  const accounts = _getRows(SHEET.ACCOUNTS);
  const projects = _getRows(SHEET.PROJECTS);
  const logs = _getRows(SHEET.LOGS);
  const users = _getRows(SHEET.USERS);
  const masterList = _getRows(SHEET.MASTER);
  const departments = _getRows(SHEET.DEPARTMENTS);

  const accountMap = {};
  accounts.forEach(function(h) {
    accountMap[h.id] = h;
  });

  const userMap = {};
  users.forEach(function(u) {
    userMap[u.user_id] = u;
  });

  const masterMap = {};
  masterList.forEach(function(m) {
    const code = String(m.code || "").trim();
    if (code) masterMap[code] = m;
  });

  const departmentMap = {};
  departments.forEach(function(d) {
    departmentMap[d.id] = d;
  });

  const STAGE_LABELS = [
    "0：未接触",
    "1：初回訪問済",
    "2：ニーズ確認中",
    "3：提案実施中",
    "4：クロージング",
  ];

  function normalizeStr(str) {
    return String(str || "").normalize("NFKC").toLowerCase();
  }

  function formatDate(value) {
    if (!value) return "";
    if (
      Object.prototype.toString.call(value) === "[object Date]" &&
      !isNaN(value.getTime())
    ) {
      return Utilities.formatDate(value, tz, "yyyy-MM-dd");
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(value);
    return isNaN(d.getTime()) ? s : Utilities.formatDate(d, tz, "yyyy-MM-dd");
  }

  const normalizedQuery = normalizeStr(nameQuery || "");
  if (!normalizedQuery) return null;

  const matchedProjects = projects.filter(function(p) {
    return normalizeStr(p.name).indexOf(normalizedQuery) !== -1;
  });

  if (matchedProjects.length === 0) return null;

  const logsByProject = {};
  logs.forEach(function(l) {
    if (!logsByProject[l.project_id]) logsByProject[l.project_id] = [];
    logsByProject[l.project_id].push(l);
  });
  Object.keys(logsByProject).forEach(function(pid) {
    logsByProject[pid].sort(function(a, b) {
      return String(b.visit_date || "") < String(a.visit_date || "") ? -1 : 1;
    });
  });

  const headers = [
    "担当者名",
    "code",
    "拠点名",
    "パートナー名",
    "取引先名",
    "住所",
    "案件名",
    "部署",
    "キーマン",
    "進捗ステージ",
    "備考",
    "訪問日",
    "対象製品",
    "活動内容",
  ];

  const rows = [];
  matchedProjects.forEach(function(project) {
    const account = accountMap[project.account_id] || {};
    const user = userMap[account.assigned_user_id] || {};
    const accountCode = String(account.code || "").trim();
    const master = (accountCode ? masterMap[accountCode] : null) || {};
    const stageNum = Number(project.current_stage);
    const stageLabel =
      STAGE_LABELS[stageNum] !== undefined
        ? STAGE_LABELS[stageNum]
        : String(project.current_stage || "");
    const department = departmentMap[project.department_id] || {};

    const base = [
      user.name || "",
      account.code || "",
      master.office || "",
      account.partner_name || "",
      account.name || "",
      String(account.addr || "").trim() || master.address || "",
      project.name || "",
      department.name || "",
      [department.keyman_role, department.keyman_name].filter(Boolean).join(" "),
      stageLabel,
      project.latest_note || "",
    ];

    const projectLogs = logsByProject[project.id] || [];
    if (projectLogs.length === 0) {
      rows.push(base.concat(["", "", ""]));
    } else {
      projectLogs.forEach(function(log) {
        rows.push(base.concat([
          formatDate(log.visit_date),
          log.target_product || "",
          log.content || "",
        ]));
      });
    }
  });

  return _buildCsv(headers, rows);
}


function getAccountReport(accountId) {
  const me = _requireRegisteredUser();
  const email = String(me.user_id || Session.getActiveUser().getEmail() || "").trim();
  const role = me.role || _getMyRole();
  const isAll = role === "admin" || role === "manager";
  const tz = Session.getScriptTimeZone();

  const accounts = _getRows(SHEET.ACCOUNTS);
  let scopedAccounts = accounts.filter(function(h) {
    return isAll || String(h.assigned_user_id || "").trim() === email;
  });

  if (accountId !== "all") {
    scopedAccounts = scopedAccounts.filter(function(h) {
      return String(h.id || "") === String(accountId || "");
    });
  }

  if (scopedAccounts.length === 0) return null;

  const users = _getRows(SHEET.USERS);
  const departments = _getRows(SHEET.DEPARTMENTS);
  const projects = _getRows(SHEET.PROJECTS);
  const logs = _getRows(SHEET.LOGS);

  const accountMap = {};
  const scopedAccountIds = new Set();
  scopedAccounts.forEach(function(h) {
    accountMap[h.id] = h;
    scopedAccountIds.add(h.id);
  });

  const userMap = {};
  users.forEach(function(u) {
    userMap[u.user_id] = u;
  });

  const departmentMap = {};
  departments.forEach(function(d) {
    departmentMap[d.id] = d;
  });

  const latestLogMap = {};
  logs.forEach(function(log) {
    const projectId = log.project_id;
    if (!projectId) return;
    const current = latestLogMap[projectId];
    if (!current || formatDate(log.visit_date) > formatDate(current.visit_date)) {
      latestLogMap[projectId] = log;
    }
  });

  const STAGE_LABELS = [
    "0：未接触",
    "1：初回訪問済",
    "2：ニーズ確認中",
    "3：提案実施中",
    "4：クロージング",
  ];

  function formatDate(value) {
    if (!value) return "";
    if (
      Object.prototype.toString.call(value) === "[object Date]" &&
      !isNaN(value.getTime())
    ) {
      return Utilities.formatDate(value, tz, "yyyy-MM-dd");
    }
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(value);
    return isNaN(d.getTime()) ? s : Utilities.formatDate(d, tz, "yyyy-MM-dd");
  }

  function stageLabel(value) {
    const s = String(value == null ? "" : value).trim();
    return /^[0-4]$/.test(s) ? STAGE_LABELS[Number(s)] : s;
  }

  function closingLabel(value) {
    if (value === "won") return "受注";
    if (value === "lost") return "失注";
    return "";
  }

  const headers = [
    "担当者名",
    "取引先名",
    "パートナー名",
    "部署名",
    "キーマン",
    "案件名",
    "対象製品",
    "進捗ステージ",
    "受注失注",
    "最新課題メモ",
    "次回アクション日",
    "次回アクション内容",
    "アクション担当者",
    "直近訪問日",
    "直近活動内容",
    "直近同行者",
  ];

  const rows = projects
    .filter(function(project) {
      return scopedAccountIds.has(project.account_id);
    })
    .map(function(project) {
      const account = accountMap[project.account_id] || {};
      const user = userMap[account.assigned_user_id] || {};
      const department = departmentMap[project.department_id] || {};
      const latestLog = latestLogMap[project.id] || {};
      const assignedUserId = account.assigned_user_id || "";

      return [
        user.name || assignedUserId,
        account.name || "",
        account.partner_name || "",
        department.name || "",
        [department.keyman_role, department.keyman_name].filter(Boolean).join(" "),
        project.name || "",
        project.target_product || "",
        stageLabel(project.current_stage),
        closingLabel(project.closing_status),
        project.latest_note || "",
        formatDate(project.next_action_date),
        project.next_action_text || "",
        project.next_action_assignee || "",
        formatDate(latestLog.visit_date),
        latestLog.content || "",
        latestLog.accompanied_by || "",
      ];
    });

  if (rows.length === 0) return null;

  rows.sort(function(a, b) {
    return (
      String(a[0] || "").localeCompare(String(b[0] || ""), "ja") ||
      String(a[1] || "").localeCompare(String(b[1] || ""), "ja") ||
      String(a[3] || "").localeCompare(String(b[3] || ""), "ja")
    );
  });

  return _buildCsv(headers, rows);
}

function getAccountListCsv() {
  _requireManager();

  const accounts = _getRows(SHEET.ACCOUNTS).map(_mapAccount);
  if (accounts.length === 0) return null;

  const users = _getRows(SHEET.USERS);
  const userNameMap = {};
  const priorityLabels = { high: "高", mid: "中", low: "低" };

  users.forEach(function(u) {
    userNameMap[u.user_id] = u.name || "";
  });

  function sanitizeAccountListCell(value) {
    const sanitized = _sanitizeCell(value);
    if (typeof sanitized === "string" && /^\s*[-=+@]/.test(sanitized)) {
      return "'" + sanitized;
    }
    return sanitized;
  }

  const headers = [
    "担当者名",
    "取引先コード",
    "取引先名",
    "担当パートナー名",
    "優先度",
    "特記事項",
  ];
  const rows = accounts
    .map(function(h) {
      return [
        sanitizeAccountListCell(userNameMap[h.assignedUserId] || ""),
        sanitizeAccountListCell(h.code || ""),
        sanitizeAccountListCell(h.name || ""),
        sanitizeAccountListCell(h.partner || ""),
        sanitizeAccountListCell(priorityLabels[h.priority] || h.priority || ""),
        sanitizeAccountListCell(h.note || ""),
      ];
    })
    .sort(function(a, b) {
      return (
        String(a[0] || "").localeCompare(String(b[0] || ""), "ja") ||
        String(a[2] || "").localeCompare(String(b[2] || ""), "ja")
      );
    });

  return _buildCsv(headers, rows);
}


function getUnifiedCsv(params) {
  var me = _requireRegisteredUser();
  var email = String(me.user_id || Session.getActiveUser().getEmail() || "").trim();
  var role = me.role || _getMyRole();
  var isAll = role === "admin" || role === "manager";
  var tz = Session.getScriptTimeZone();

  params = params || {};
  var accountId = params.accountId || "all";
  var projectId = params.projectId || "all";
  var dateMode = params.dateMode || "all";
  var dateFrom = params.dateFrom || null;
  var dateTo = params.dateTo || null;

  var accounts = _getRows(SHEET.ACCOUNTS);
  var departments = _getRows(SHEET.DEPARTMENTS);
  var projects = _getRows(SHEET.PROJECTS);
  var logs = _getRows(SHEET.LOGS);
  var users = _getRows(SHEET.USERS);

  var userNameMap = {};
  users.forEach(function(u) {
    userNameMap[u.user_id] = u.name || u.user_id;
  });

  var accountMap = {};
  accounts.forEach(function(h) {
    accountMap[h.id] = h;
  });

  var departmentMap = {};
  departments.forEach(function(d) {
    departmentMap[d.id] = d.name;
  });

  var scopedAccountIds = new Set();
  accounts.forEach(function(h) {
    if (isAll || String(h.assigned_user_id || "").trim() === email) {
      scopedAccountIds.add(h.id);
    }
  });

  if (accountId !== "all") {
    scopedAccountIds = new Set(
      Array.from(scopedAccountIds).filter(function(id) {
        return String(id || "") === String(accountId || "");
      }),
    );
  }

  if (scopedAccountIds.size === 0) return null;

  var scopedProjects = projects.filter(function(p) {
    if (!scopedAccountIds.has(p.account_id)) return false;
    if (projectId !== "all" && String(p.id || "") !== String(projectId || "")) return false;
    return true;
  });

  if (scopedProjects.length === 0) return null;

  var STAGE_LABELS = [
    "0：未接触",
    "1：初回訪問済",
    "2：ニーズ確認中",
    "3：提案実施中",
    "4：クロージング",
  ];

  function formatDate(value, format) {
    if (!value) return "";
    var d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return "";
    return Utilities.formatDate(d, tz, format || "yyyy/MM/dd");
  }

  function sanitizeUnifiedCsvCell(value) {
    var sanitized = _sanitizeCell(value);
    if (typeof sanitized === "string" && /^\s*[-=+@]/.test(sanitized)) {
      return "'" + sanitized;
    }
    return sanitized;
  }

  var recentCutoff = null;
  var todayEnd = null;
  if (dateMode === "recent") {
    recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 30);
    recentCutoff.setHours(0, 0, 0, 0);
    todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
  }

  var rangeFrom = dateMode === "range" && dateFrom ? new Date(dateFrom) : null;
  if (rangeFrom && !isNaN(rangeFrom.getTime())) {
    rangeFrom.setHours(0, 0, 0, 0);
  }
  var rangeTo = null;
  if (dateMode === "range" && dateTo) {
    rangeTo = new Date(dateTo);
    if (!isNaN(rangeTo.getTime())) {
      rangeTo.setHours(23, 59, 59, 999);
    }
  }

  function passDateFilter(visitDate) {
    if (dateMode === "all") return true;
    var d = visitDate ? new Date(visitDate) : null;
    if (!d || isNaN(d.getTime())) return false;
    if (dateMode === "recent") return d >= recentCutoff && d <= todayEnd;
    if (dateMode === "range") {
      if (rangeFrom && d < rangeFrom) return false;
      if (rangeTo && d > rangeTo) return false;
      return true;
    }
    return true;
  }

  var logsByProject = {};
  logs.forEach(function(l) {
    if (!l.project_id) return;
    if (!logsByProject[l.project_id]) logsByProject[l.project_id] = [];
    logsByProject[l.project_id].push(l);
  });

  var headers = [
    "担当者名",
    "取引先コード",
    "取引先名",
    "担当MS",
    "部署名",
    "案件名",
    "対象製品",
    "進捗ステージ",
    "受注/失注",
    "最新課題メモ",
    "ネクストアクション",
    "アクション担当者",
    "次回予定日",
    "訪問日",
    "活動内容",
    "同行者",
    "添付URL",
    "更新日時",
  ];
  var rows = [];

  scopedProjects.forEach(function(p) {
    var account = accountMap[p.account_id] || {};
    var stageNum = parseInt(p.current_stage, 10) || 0;
    var projectCols = [
      userNameMap[account.assigned_user_id] || account.assigned_user_id || "",
      account.code || "",
      account.name || "",
      account.partner_name || "",
      departmentMap[p.department_id] || "",
      p.name || "",
      p.target_product || "",
      STAGE_LABELS[stageNum] || String(p.current_stage || ""),
      p.closing_status || "",
      p.latest_note || "",
      p.next_action_text || "",
      p.next_action_assignee || "",
      p.next_action_date || "",
    ].map(sanitizeUnifiedCsvCell);

    var filteredLogs = (logsByProject[p.id] || [])
      .filter(function(l) {
        return passDateFilter(l.visit_date);
      })
      .sort(function(a, b) {
        return new Date(b.visit_date) - new Date(a.visit_date);
      });

    if (filteredLogs.length === 0) {
      rows.push(projectCols.concat(["", "", "", "", ""]));
    } else {
      filteredLogs.forEach(function(l) {
        rows.push(
          projectCols.concat([
            formatDate(l.visit_date),
            l.content || "",
            l.accompanied_by || "",
            l.estimate_url || "",
            formatDate(l.updated_at, "yyyy-MM-dd HH:mm"),
          ].map(sanitizeUnifiedCsvCell)),
        );
      });
    }
  });

  if (rows.length === 0) return null;
  return _buildCsv(headers, rows);
}

function getStatistics(targetUserId) {
  const email = Session.getActiveUser().getEmail();
  const role = _getMyRole();
  const isAll = role === "admin" || role === "manager";
  const tz = Session.getScriptTimeZone();

  let filterEmail = null;
  if (!isAll) {
    filterEmail = email;
  } else if (targetUserId) {
    filterEmail = targetUserId;
  }

  const accounts = _getRows(SHEET.ACCOUNTS);
  const myHospIds = new Set(
    accounts
      .filter((h) => filterEmail === null || h.assigned_user_id === filterEmail)
      .map((h) => h.id),
  );

  const projects = _getRows(SHEET.PROJECTS).filter((p) =>
    myHospIds.has(p.account_id),
  );
  const logs = _getRows(SHEET.LOGS).filter((l) =>
    myHospIds.has(l.account_id),
  );

  const stageCounts = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 };
  projects.forEach((p) => {
    const s = String(p.current_stage || "0");
    if (s in stageCounts) stageCounts[s]++;
  });

  const monthMap = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthMap[Utilities.formatDate(d, tz, "yyyy-MM")] = 0;
  }
  logs.forEach((l) => {
    if (!l.visit_date) return;
    const d = new Date(l.visit_date);
    if (isNaN(d.getTime())) return;
    const key = Utilities.formatDate(d, tz, "yyyy-MM");
    if (key in monthMap) monthMap[key]++;
  });

  let won = 0;
  let lost = 0;
  let inProgress = 0;
  projects.forEach((p) => {
    if (p.closing_status === "won") won++;
    else if (p.closing_status === "lost") lost++;
    else inProgress++;
  });

  let userCounts = null;
  if (isAll) {
    const users = _getRows(SHEET.USERS);
    const userNameMap = {};
    users.forEach((u) => {
      userNameMap[u.user_id] = u.name || u.user_id;
    });

    const scopedAccounts = accounts.filter((h) =>
      filterEmail === null || h.assigned_user_id === filterEmail,
    );

    const hospUserMap = {};
    scopedAccounts.forEach((h) => {
      if (h.assigned_user_id) hospUserMap[h.id] = h.assigned_user_id;
    });

    const countMap = {};
    scopedAccounts.forEach((h) => {
      if (h.assigned_user_id && !(h.assigned_user_id in countMap)) {
        countMap[h.assigned_user_id] = 0;
      }
    });

    projects.forEach((p) => {
      const uid = hospUserMap[p.account_id];
      if (!uid) return;
      if (!(uid in countMap)) countMap[uid] = 0;
      countMap[uid]++;
    });

    userCounts = Object.entries(countMap)
      .map(([uid, count]) => ({ name: userNameMap[uid] || uid, uid, count }))
      .sort((a, b) => b.count - a.count);
  }

  return {
    stageCounts,
    monthlyLogs: Object.entries(monthMap).map(([month, count]) => ({
      month,
      count,
    })),
    closing: { won, lost, inProgress },
    userCounts,
    isAll,
  };
}

function getStageHistory(projectId) {
  const tz = Session.getScriptTimeZone();
  return _getRows(SHEET.STAGE_HISTORY)
    .filter((r) => String(r.project_id) === String(projectId))
    .map((r) => ({
      stage: String(r.stage || "0"),
      changedAt: r.changed_at
        ? Utilities.formatDate(new Date(r.changed_at), tz, "yyyy-MM-dd HH:mm")
        : "",
      changedBy: String(r.changed_by || ""),
    }))
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
}

// ============================================================
// 6. 月次レビュー保存
// ============================================================
function _formatYm(val) {
  if (!val) return "";
  if (val instanceof Date) return `${val.getFullYear()}-${val.getMonth() + 1}`;
  const str = String(val);
  if (str.includes("-")) {
    const parts = str.split("-");
    return `${parts[0]}-${parseInt(parts[1], 10)}`;
  }
  return str;
}

function saveMonthlyReview(reviewData) {
  const email = Session.getActiveUser().getEmail();
  const role = _getMyRole();
  const targetUser = reviewData.userId || email;

  if (targetUser !== email && role !== "admin" && role !== "manager")
    throw new Error("他人の評価を更新する権限がありません");

  const sheet = _sheet(SHEET.REVIEWS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const ymIdx = headers.indexOf("year_month");
  const uidIdx = headers.indexOf("user_id");
  const searchYm = _formatYm(reviewData.yearMonth);

  let targetRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (
      _formatYm(data[i][ymIdx]) === searchYm &&
      String(data[i][uidIdx]) === targetUser
    ) {
      targetRow = i + 1;
      break;
    }
  }

  const checksJson = JSON.stringify(reviewData.checks || {});

  if (targetRow !== -1) {
    const updateObj = { self_check_answers: checksJson };
    if (role === "admin" || role === "manager") {
      updateObj.evaluation = reviewData.eval || "";
      updateObj.manager_comment = reviewData.comment || "";
    }
    const updatedRow = headers.map((h, j) =>
      updateObj[h] !== undefined ? updateObj[h] : data[targetRow - 1][j],
    );
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([updatedRow]);
  } else {
    const newRecord = {
      year_month: searchYm,
      user_id: targetUser,
      evaluation:
        role === "admin" || role === "manager" ? reviewData.eval || "" : "",
      manager_comment:
        role === "admin" || role === "manager" ? reviewData.comment || "" : "",
      self_check_answers: checksJson,
    };
    _appendRow(SHEET.REVIEWS, newRecord);
  }
  return { ok: true };
}

// ============================================================
// 7. 担当分のみ差分セーフ同期
// ============================================================
/**
 * syncMyData(snapshot)
 *
 * 呼び出したユーザーの「担当取引先に紐づくデータだけ」を対象に
 * Upsert（存在すれば更新、なければ追記）＋孤立行削除を行う。
 * 他ユーザーの行には一切触れないため、複数人同時利用でも安全。
 *
 * 対象シート: accounts / departments / projects / activity_logs
 * ※ monthly_reviews は saveMonthlyReview() が既に Upsert 済みのため対象外
 */
function syncMyData(snapshot) {
  const email = Session.getActiveUser().getEmail();

  // ── 1. 自分が担当する取引先IDセットを snapshot から確定 ──────────────────
  // admin は全取引先を持つ可能性があるが、送信されてきた snapshot の範囲だけを扱う
  const myHospIds = new Set((snapshot.accounts || []).map((h) => h.id));

  // ── 2. accounts: 自分の担当行のみ Upsert ─────────────────────────────
  _upsertRows(
    SHEET.ACCOUNTS,
    "id",
    (snapshot.accounts || []).map((h) => ({
      id: h.id,
      code: h.code || "",
      name: h.name || "",
      addr: h.addr || "",
      corp: h.corp || "",
      beds: h.beds || "",
      partner_name: h.partner || "",
      dept_list: h.deptList || "",
      ward_info: h.ward || "",
      priority: h.priority || "mid",
      equipment: h.equipment || "",
      note: h.note || "",
      assigned_user_id: email, // 担当者は必ず自分
    })),
  );

  // ── 3. departments: 自分の担当取引先IDに属する行のみ Upsert + 孤立削除 ──
  const snapDeptIds = new Set((snapshot.departments || []).map((d) => d.id));

  _upsertRows(
    SHEET.DEPARTMENTS,
    "id",
    (snapshot.departments || []).map((d) => ({
      id: d.id,
      account_id: d.accountId,
      name: d.name || "",
      keyman_role: d.keymanRole || "",
      keyman_name: d.keymanName || "",
    })),
  );

  // snapshot に存在しない部署（=削除済み）で自分の取引先に属するものを削除
  _deleteOrphanRows(
    SHEET.DEPARTMENTS,
    "account_id",
    myHospIds,
    "id",
    snapDeptIds,
  );

  // ── 4. projects: 同様に Upsert + 孤立削除 ─────────────────────────────
  const snapProjIds = new Set((snapshot.projects || []).map((p) => p.id));
  const existingCalendarEventIds = {};
  const existingStages = {};
  _getRows(SHEET.PROJECTS).forEach((p) => {
    existingCalendarEventIds[p.id] = p.calendar_event_id || "";
    existingStages[p.id] = String(p.current_stage || "0");
  });

  _upsertRows(
    SHEET.PROJECTS,
    "id",
    (snapshot.projects || []).map((p) => ({
      id: p.id,
      department_id: p.departmentId,
      account_id: p.accountId,
      name: p.name || "",
      target_product: p.targetProduct || "",
      current_stage: p.currentStage || "0",
      latest_note: p.latestNote || "",
      next_action_date: p.nextActionDate || "",
      next_action_text: p.nextActionText || "",
      next_action_assignee: p.nextActionAssignee || "",
      closing_status: p.closingStatus || "",
      calendar_event_id:
        p.calendarEventId || existingCalendarEventIds[p.id] || "",
      updated_at: new Date(),
    })),
  );

  const _stageHistoryUserMap = {};
  _getRows(SHEET.USERS).forEach((u) => {
    _stageHistoryUserMap[u.user_id] = u.name || u.user_id;
  });

  (snapshot.projects || []).forEach((p) => {
    const newStage = String(p.currentStage || "0");
    const oldStage = existingStages[p.id];
    if (oldStage === undefined) {
      _appendStageHistory(p.id, p.accountId, newStage, email, _stageHistoryUserMap);
    } else if (oldStage !== newStage) {
      _appendStageHistory(p.id, p.accountId, newStage, email, _stageHistoryUserMap);
    }
  });

  _deleteOrphanRows(
    SHEET.PROJECTS,
    "account_id",
    myHospIds,
    "id",
    snapProjIds,
  );
  _deleteOrphanRows(
    SHEET.STAGE_HISTORY,
    "account_id",
    myHospIds,
    "project_id",
    snapProjIds,
  );

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

  _deleteOrphanRows(SHEET.LOGS, "account_id", myHospIds, "id", snapLogIds);

  return getInitialData();
}

// ── 内部ヘルパー ──────────────────────────────────────────────────────────

/**
 * _upsertRows(sheetName, pkCol, records)
 * records 配列の各行を「pkCol の値」をキーにして
 * 既存行があれば上書き更新、なければ末尾追記する。
 * 他ユーザーの行は pkCol が一致しない限り触れない。
 */
function _upsertRows(sheetName, pkCol, records) {
  if (!records || records.length === 0) return;

  const sheet = _sheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const pkIdx = headers.indexOf(pkCol);
  if (pkIdx === -1)
    throw new Error(`${sheetName}: PK列 "${pkCol}" が見つかりません`);

  // シートの既存 pk → 行番号(1始まり) のマップを作成
  const pkToRowNum = {};
  for (let i = 1; i < data.length; i++) {
    pkToRowNum[String(data[i][pkIdx])] = i + 1; // getRange は 1始まり
  }

  records.forEach((rec) => {
    const pkVal = String(rec[pkCol]);
    const rowValues = headers.map((h) => (rec[h] !== undefined ? rec[h] : ""));

    if (pkToRowNum[pkVal]) {
      // 既存行を上書き
      sheet
        .getRange(pkToRowNum[pkVal], 1, 1, headers.length)
        .setValues([rowValues]);
    } else {
      // 新規追記
      sheet.appendRow(rowValues);
    }
  });
}

/**
 * _deleteOrphanRows(sheetName, scopeCol, scopeSet, pkCol, keepSet)
 * 「scopeCol の値が scopeSet に含まれる行」= 自分の担当スコープ内の行のうち
 * 「pkCol の値が keepSet に含まれない行」= snapshot に存在しない（削除済み）行
 * を物理削除する。scopeSet 外（他ユーザーの行）は絶対に触れない。
 */
function _deleteOrphanRows(sheetName, scopeCol, scopeSet, pkCol, keepSet) {
  const sheet = _sheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const scopeIdx = headers.indexOf(scopeCol);
  const pkIdx = headers.indexOf(pkCol);
  if (scopeIdx === -1 || pkIdx === -1) return;

  // 下から削除しないと行番号がズレる
  for (let i = data.length - 1; i >= 1; i--) {
    const scopeVal = String(data[i][scopeIdx]);
    const pkVal = String(data[i][pkIdx]);
    if (scopeSet.has(scopeVal) && !keepSet.has(pkVal)) {
      sheet.deleteRow(i + 1);
    }
  }
}

// ==========================================
// ファイルアップロード処理
// ==========================================

const ESTIMATE_FOLDER_ID =
  PropertiesService.getScriptProperties().getProperty("SAVE_FOLDER_ID");

function uploadEstimateFile(fileObj) {
  try {
    const folder = DriveApp.getFolderById(ESTIMATE_FOLDER_ID);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileObj.data),
      fileObj.mimeType,
      fileObj.fileName,
    );
    const file = folder.createFile(blob);
    return { ok: true, url: file.getUrl() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================================
// 期限超過アクション リマインダーメール送信
// ※GASエディタで時間ドリブントリガー（毎日・午前8時台）に設定すること
// ============================================================
function sendOverdueReminders() {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  const users = _getRows(SHEET.USERS);
  const projects = _getRows(SHEET.PROJECTS);
  const accounts = _getRows(SHEET.ACCOUNTS);

  // 期限超過の案件（クロージング除く）
  const overdue = projects.filter(
    (p) =>
      p.next_action_date &&
      String(p.next_action_date).slice(0, 10) < today &&
      String(p.current_stage || "0") !== "4",
  );

  if (overdue.length === 0) return;

  // 担当者名 → 担当者オブジェクト の逆引きマップ
  const nameToUser = {};
  users.forEach((u) => {
    if (u.name) nameToUser[u.name] = u;
  });

  // 担当者ごとにグループ化
  const byAssignee = {};
  overdue.forEach((p) => {
    const key = p.next_action_assignee || "未設定";
    if (!byAssignee[key]) byAssignee[key] = [];
    byAssignee[key].push(p);
  });

  Object.entries(byAssignee).forEach(([assigneeName, items]) => {
    const user = nameToUser[assigneeName];
    if (!user || !user.user_id) return;

    const hospMap = {};
    accounts.forEach((h) => {
      hospMap[h.id] = h.name || h.id;
    });

    const lines = items.map((p) => {
      const hName = hospMap[p.account_id] || p.account_id;
      const dueStr = String(p.next_action_date).slice(0, 10);
      return `・[${hName}] ${p.name}\n  期限: ${dueStr}　内容: ${p.next_action_text || "（未入力）"}`;
    });

    const subject = `【リマインド】期限超過のネクストアクションが ${items.length} 件あります`;
    const body = [
      `${assigneeName} さん`,
      "",
      "以下の案件でネクストアクションの期限が過ぎています。",
      "取引先ターゲット管理アプリより確認・更新をお願いします。",
      "",
      ...lines,
      "",
      "---",
      "このメールはシステムから自動送信されています。",
    ].join("\n");

    MailApp.sendEmail({
      to: user.user_id,
      subject,
      body,
      name: "取引先ターゲット管理システム",
    });
  });
}
