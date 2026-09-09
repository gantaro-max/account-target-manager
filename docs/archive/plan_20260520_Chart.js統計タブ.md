# 実装指示書：Chart.js 統計タブ

作成日: 2026-05-20

---

## 概要

新規「📈 統計」タブ（Tab 5）を追加し、Chart.js で以下の4グラフを表示する。

| # | グラフ | 種類 | 表示条件 |
|---|--------|------|----------|
| 1 | ステージ別案件数 | ドーナツ | 全ロール |
| 2 | 月別活動件数（直近12ヶ月） | 縦棒 | 全ロール |
| 3 | 受注 / 失注 / 進行中の比率 | ドーナツ | 全ロール |
| 4 | 担当者別案件数 | 横棒 | manager / admin のみ |

**スコープ**: member / leader は自担当分のみ、manager / admin は全担当者分。  
**ロード方式**: タブ初回クリック時に `getStatistics()` を1回呼ぶ（以降はキャッシュ）。「🔄 更新」ボタンで再取得。

---

## 変更対象ファイル

1. `src/コード_v2_9.js`
2. `src/index.html`
3. `src/js.html`
4. `src/js_stats.html` （新規作成）
5. `src/css.html`
6. `docs/TASKS.md`

---

## 1. `src/コード_v2_9.js` の変更

`getCsvData` の直後に `getStatistics()` を追加する。

```javascript
function getStatistics() {
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

  const projects = _getRows(SHEET.PROJECTS).filter((p) =>
    myHospIds.has(p.account_id),
  );
  const logs = _getRows(SHEET.LOGS).filter((l) =>
    myHospIds.has(l.account_id),
  );

  // 1. ステージ別案件数
  const stageCounts = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0 };
  projects.forEach((p) => {
    const s = String(p.current_stage || "0");
    if (s in stageCounts) stageCounts[s]++;
  });

  // 2. 月別活動件数（直近12ヶ月）
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

  // 3. 受注 / 失注 / 進行中
  let won = 0,
    lost = 0,
    inProgress = 0;
  projects.forEach((p) => {
    if (p.closing_status === "won") won++;
    else if (p.closing_status === "lost") lost++;
    else inProgress++;
  });

  // 4. 担当者別案件数（manager / admin のみ）
  let userCounts = null;
  if (isAll) {
    const users = _getRows(SHEET.USERS);
    const userNameMap = {};
    users.forEach((u) => {
      userNameMap[u.user_id] = u.name || u.user_id;
    });
    const countMap = {};
    accounts.forEach((h) => {
      if (h.assigned_user_id && !(h.assigned_user_id in countMap))
        countMap[h.assigned_user_id] = 0;
    });
    _getRows(SHEET.PROJECTS).forEach((p) => {
      const hosp = accounts.find((h) => h.id === p.account_id);
      if (!hosp || !hosp.assigned_user_id) return;
      if (!(hosp.assigned_user_id in countMap))
        countMap[hosp.assigned_user_id] = 0;
      countMap[hosp.assigned_user_id]++;
    });
    userCounts = Object.entries(countMap)
      .map(([uid, count]) => ({ name: userNameMap[uid] || uid, count }))
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
```

---

## 2. `src/index.html` の変更

### 2-1. Chart.js CDN を `<head>` 内の既存 `<script>` タグの前に追加

```html
<!-- Before: (最初の <script> タグの直前) -->

<!-- After: -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
```

### 2-2. タブヘッダーに「統計」タブを追加

```html
<!-- Before: -->
      <div class="tab admin-only" onclick="switchTab(4)" style="display: none">

<!-- After: -->
      <div class="tab" onclick="switchTab(5)">📈 統計</div>
      <div class="tab admin-only" onclick="switchTab(4)" style="display: none">
```

※ `switchTab` はDOMの `.tab` / `.content` の出現順でインデックスを決める。
新しいタブをTab 4（admin-only）の**前**に挿入するため、Tab 4は `onclick="switchTab(4)"` のままで正しい（DOMでの位置が5番目→インデックス4）。  
ただし以下に注意: **新タブをTab 4の前に挿入するとTab 4のDOMインデックスが5にずれる。** そのため、2-3で述べる`tab5`コンテンツをTab 4コンテンツの**前**に挿入し、`onclick` の番号も正しく揃える必要がある。

> **代替案（推奨・安全）**: Tab 4 の**後**に追加する方式。タブヘッダーとコンテンツを両方末尾に追加すればインデックスのズレが起きない。以下はこの方式で記述する。

```html
<!-- Before: -->
    </div>

<!-- After (タブ一覧の </div> の直前に追加): -->
      <div class="tab" onclick="switchTab(5)">📈 統計</div>
    </div>
```

### 2-3. Tab 5 コンテンツを追加（Tab 4 コンテンツ `<div class="content" id="tab4">` の閉じタグの直後）

```html
    <div class="content" id="tab5">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:700; font-size:16px; color:var(--navy);">📈 営業統計ダッシュボード</span>
        <button class="control-btn" onclick="reloadStats()">🔄 更新</button>
      </div>
      <div id="stats-loading" class="section-note" style="display:none;">読み込み中...</div>
      <div id="stats-grid" class="stats-grid">
        <div class="card">
          <div class="card-title">ステージ別案件数</div>
          <canvas id="chart-stage" height="260"></canvas>
        </div>
        <div class="card">
          <div class="card-title">月別活動件数（直近12ヶ月）</div>
          <canvas id="chart-monthly" height="260"></canvas>
        </div>
        <div class="card">
          <div class="card-title">受注 / 失注 / 進行中</div>
          <canvas id="chart-closing" height="260"></canvas>
        </div>
        <div class="card" id="chart-users-card" style="display:none;">
          <div class="card-title">担当者別案件数</div>
          <canvas id="chart-users" height="260"></canvas>
        </div>
      </div>
    </div>
```

---

## 3. `src/js.html` の変更

`switchTab` 関数の末尾に統計タブ初期化フックを追加する。

```javascript
// Before:
  function switchTab(idx) {
    collectBasicInfo();
    document
      .querySelectorAll(".content")
      .forEach((c, i) => c.classList.toggle("active", i === idx));
    document
      .querySelectorAll(".tab")
      .forEach((t, i) => t.classList.toggle("active", i === idx));
    renderAll();
  }

// After:
  function switchTab(idx) {
    collectBasicInfo();
    document
      .querySelectorAll(".content")
      .forEach((c, i) => c.classList.toggle("active", i === idx));
    document
      .querySelectorAll(".tab")
      .forEach((t, i) => t.classList.toggle("active", i === idx));
    renderAll();
    if (idx === 5 && typeof initStatsTab === "function") initStatsTab();
  }
```

---

## 4. `src/js_stats.html` （新規作成）

```html
<script>
  // ── 統計タブ ─────────────────────────────────────────────────────────────

  let _statsLoaded = false;
  const _statsCharts = {};

  const STAGE_COLORS = ["#94a3b8", "#3b82f6", "#f59e0b", "#0891b2", "#22c55e"];

  function initStatsTab() {
    if (_statsLoaded) return;
    $("stats-loading").style.display = "block";
    $("stats-grid").style.display = "none";
    google.script.run
      .withSuccessHandler((data) => {
        _statsLoaded = true;
        $("stats-loading").style.display = "none";
        $("stats-grid").style.display = "grid";
        _renderStats(data);
      })
      .withFailureHandler((e) => {
        $("stats-loading").textContent = "読み込みエラー: " + e.message;
      })
      .getStatistics();
  }

  function reloadStats() {
    _statsLoaded = false;
    Object.values(_statsCharts).forEach((c) => {
      if (c) c.destroy();
    });
    Object.keys(_statsCharts).forEach((k) => delete _statsCharts[k]);
    initStatsTab();
  }

  function _renderStats(data) {
    // 1. ステージ別案件数（ドーナツ）
    _statsCharts.stage = new Chart($("chart-stage"), {
      type: "doughnut",
      data: {
        labels: STAGE_LABELS,
        datasets: [
          {
            data: ["0", "1", "2", "3", "4"].map(
              (s) => data.stageCounts[s] || 0,
            ),
            backgroundColor: STAGE_COLORS,
            borderWidth: 1,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        cutout: "60%",
      },
    });

    // 2. 月別活動件数（縦棒）
    _statsCharts.monthly = new Chart($("chart-monthly"), {
      type: "bar",
      data: {
        labels: data.monthlyLogs.map((m) => m.month),
        datasets: [
          {
            label: "活動件数",
            data: data.monthlyLogs.map((m) => m.count),
            backgroundColor: "rgba(8,145,178,0.7)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    });

    // 3. 受注 / 失注 / 進行中（ドーナツ）
    _statsCharts.closing = new Chart($("chart-closing"), {
      type: "doughnut",
      data: {
        labels: ["進行中", "受注", "失注"],
        datasets: [
          {
            data: [
              data.closing.inProgress,
              data.closing.won,
              data.closing.lost,
            ],
            backgroundColor: ["#3b82f6", "#22c55e", "#ef4444"],
            borderWidth: 1,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        cutout: "60%",
      },
    });

    // 4. 担当者別案件数（横棒、manager / admin のみ）
    if (data.isAll && data.userCounts && data.userCounts.length > 0) {
      $("chart-users-card").style.display = "block";
      _statsCharts.users = new Chart($("chart-users"), {
        type: "bar",
        data: {
          labels: data.userCounts.map((u) => u.name),
          datasets: [
            {
              label: "案件数",
              data: data.userCounts.map((u) => u.count),
              backgroundColor: "rgba(15,23,42,0.7)",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
        },
      });
    }
  }
</script>
```

---

## 5. `src/css.html` の変更

既存の `.control-btn` スタイルブロック付近（適切な箇所）に追記する。

```css
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
```

---

## 6. `docs/TASKS.md` の変更

```markdown
// Before:
- [ ] **ダッシュボード統計の可視化 (Chart.js)**
  - 案件の進捗ステージ別件数を円グラフ・バーチャートで表示。GAS 側に統計まとめ返し関数を追加する。

// After:
- [x] **ダッシュボード統計の可視化 (Chart.js)**
  - 案件の進捗ステージ別件数を円グラフ・バーチャートで表示。GAS 側に統計まとめ返し関数を追加する。
  - 新規「📈 統計」タブを追加。ステージ別案件数・月別活動件数・受注比率のドーナツ/棒グラフを表示。
  - manager/admin は担当者別案件数グラフも追加表示。初回クリック時にGAS呼び出し、以降キャッシュ。
  - 実装指示書: `docs/archive/campaign_20260520_Chart.js統計タブ.md`
```

---

## DoD（完了条件）チェックリスト

- [ ] 1. `コード_v2_9.js`: `getStatistics()` を追加（ステージ別・月別・受注比・担当者別）
- [ ] 2. `index.html`: Chart.js CDN `<script>` を `<head>` に追加
- [ ] 3. `index.html`: 「📈 統計」タブヘッダーを末尾に追加（`switchTab(5)`）
- [ ] 4. `index.html`: Tab 5 コンテンツ div を末尾に追加（4 canvas + 更新ボタン）
- [ ] 5. `js.html`: `switchTab` に `if (idx === 5) initStatsTab()` を追加
- [ ] 6. `js_stats.html`: 新規作成（`initStatsTab` / `reloadStats` / `_renderStats`）
- [ ] 7. `css.html`: `.stats-grid` の2カラムグリッドを追加
- [ ] 8. `docs/TASKS.md`: 該当タスクを `[x]` に更新

---

## 注意事項

- `STAGE_LABELS` は `js_core.html` でグローバル定義済み。`js_stats.html` から参照可能。
- Chart.js の `$("chart-stage")` はキャンバス DOM 要素を返す。`$(id)` は既存の `document.getElementById` ラッパー。
- `reloadStats()` は既存のチャートインスタンスを `destroy()` してから再描画する（メモリリーク防止）。
- Tab 5 を末尾に追加する方式のため、既存 Tab 0〜4 の `switchTab(n)` 番号変更は不要。
