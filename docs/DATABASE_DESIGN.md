# 取引先ターゲット管理アプリ - データベース設計書

## 1. データベース概要

本システムは Google スプレッドシートを永続化層（データベース）として使用します。
GAS（バックエンド）にて、シート上の物理名（ヘッダー行）とアプリケーション内の論理名をマッピングして制御しています。

## 2. テーブル定義 (シート構成)

### 2.1 accounts (取引先マスタ)

| 物理名 (Header)  | 論理名         | 説明                            |
| :--------------- | :------------- | :------------------------------ |
| id               | id             | 主キー (h + timestamp)          |
| code             | code           | 取引先コード (マスタ連携用)       |
| name             | name           | 取引先名 (必須)                   |
| addr             | addr           | 所在地                          |
| corp             | corp           | 法人名                          |
| beds             | beds           | 病床数                          |
| partner_name          | partner             | 担当パートナー名                        |
| dept_list        | deptList       | 診療科リスト                    |
| ward_info        | ward           | 病棟構成情報                    |
| priority         | priority       | 優先度 (high/mid/low)           |
| equipment        | equipment      | 導入機器情報                    |
| note             | note           | 特記事項                        |
| assigned_user_id | assignedUserId | 担当者のメールアドレス (所有権) |

### 2.2 departments (部署マスタ)

| 物理名 (Header) | 論理名     | 説明                    |
| :-------------- | :--------- | :---------------------- |
| id              | id         | 主キー (d + timestamp)  |
| account_id     | accountId | 外部キー (accounts.id) |
| name            | name       | 部署名                  |
| keyman_role     | keymanRole | キーマン役職            |
| keyman_name     | keymanName | キーマン氏名            |

### 2.3 projects (案件マスタ)

| 物理名 (Header)      | 論理名             | 説明                                                                     |
| :------------------- | :----------------- | :----------------------------------------------------------------------- |
| id                   | id                 | 主キー (p + timestamp)                                                   |
| account_id          | accountId         | 外部キー (accounts.id)                                                  |
| department_id        | departmentId       | 外部キー (departments.id)                                                |
| name                 | name               | 案件名（＝キャンペーン名）。キャンペーンマスターから選択 or 自由入力 ※2026-05-18仕様変更 |
| target_product       | targetProduct      | 対象製品                                                                 |
| current_stage        | currentStage       | 進捗ステージ (0〜4)                                                      |
| latest_note          | latestNote         | 最新の課題・メモ                                                         |
| next_action_date     | nextActionDate     | 次回予定日                                                               |
| next_action_text     | nextActionText     | ネクストアクション内容                                                   |
| next_action_assignee | nextActionAssignee | アクション担当者                                                         |
| closing_status       | closingStatus      | 受注(won) / 失注(lost)                                                   |
| calendar_event_id    | calendarEventId    | GoogleカレンダーイベントID（連携無効化中、空欄で運用）                   |

### 2.4 activity_logs (活動ログ)

| 物理名 (Header) | 論理名        | 説明                              |
| :-------------- | :------------ | :-------------------------------- |
| id              | id            | 主キー (l + timestamp)            |
| project_id      | projectId     | 外部キー (projects.id)            |
| account_id     | accountId    | 外部キー (accounts.id)           |
| visit_date      | visitDate     | 訪問日 (YYYY-MM-DD)               |
| content         | content       | 活動内容                          |
| accompanied_by  | accompaniedBy | 同行者 (パートナー/ベンダー等)            |
| estimate_url    | estimateUrl   | Googleドライブ上の添付ファイルURL |
| year            | year          | 訪問年 (集計用)                   |
| month           | month         | 訪問月 (集計用)                   |
| updated_at      | updatedAt     | 最終更新日時（作成時も設定）      |

### 2.5 campaigns (キャンペーンマスター) ※新規追加: 2026-05-18

キャンペーン（期間限定の重点取組）の定義を管理するテーブル。アプリ画面（キャンペーンマスター管理）から読み書き可能。

| 物理名 (Header) | 論理名        | 説明                                                                 |
| :-------------- | :------------ | :------------------------------------------------------------------- |
| id              | id            | 主キー (任意の一意文字列)                                            |
| name            | name          | キャンペーン名（必須）                                                       |
| description     | description   | 説明・備考                                                           |
| item            | item          | 対象製品名                                                           |
| start_date      | startDate     | 開始日 (YYYY-MM-DD)                                                  |
| end_date        | endDate       | 終了日 (YYYY-MM-DD)                                                  |


### 2.6 stage_history（ステージ変更履歴）※新規追加: 2026-05-20

| 物理名 (Header) | 論理名     | 説明                                  |
| :-------------- | :--------- | :------------------------------------ |
| id              | id         | 主キー (UUID)                         |
| project_id      | projectId  | 外部キー (projects.id)                |
| account_id     | accountId | 外部キー (accounts.id)（孤立削除用） |
| stage           | stage      | 変更後ステージ (0〜4)                 |
| changed_at      | changedAt  | 変更日時                              |
| changed_by      | changedBy  | 変更者メールアドレス                  |

### 2.7 monthly_reviews (月次レビュー)

| 物理名 (Header)    | 論理名    | 説明                            |
| :----------------- | :-------- | :------------------------------ |
| year_month         | yearMonth | 対象年月 (YYYY-M)               |
| user_id            | userId    | 担当者メールアドレス            |
| evaluation         | eval      | 管理者評価 (A/B/C)              |
| manager_comment    | comment   | フィードバックコメント          |
| self_check_answers | checks    | セルフチェック回答 (JSON文字列) |

### 2.8 review_check_items (設問マスタ)

| 物理名 (Header) | 論理名    | 説明                    |
| :-------------- | :-------- | :---------------------- |
| id              | id        | 主キー (q + timestamp)  |
| text            | text      | 設問文                  |
| sort_order      | sortOrder | 並び順 (1, 2, 3...)     |
| is_active       | isActive  | 有効フラグ (TRUE/FALSE) |

### 2.9 users (ユーザー管理)

| 物理名 (Header) | 論理名     | 説明                                                                     |
| :-------------- | :--------- | :----------------------------------------------------------------------- |
| user_id         | userId     | メールアドレス (認証キー)                                                |
| name            | name       | アプリ内での表示名                                                       |
| role            | role       | 権限レベル (admin / manager / leader / member) ※2026-05-19に4段階へ拡張 |
| is_active       | isActive   | 論理削除フラグ (TRUE=有効 / FALSE=退職・異動済み)。デフォルト TRUE。管理者がスプレッドシートで直接編集 |
| sort_order      | sortOrder  | 担当者セレクター・グラフの表示順 (整数)。NULL の場合は末尾に表示。管理者がスプレッドシートで直接編集 |

**`is_active = FALSE` の挙動**:
- 担当者セレクター全般・統計グラフから除外される（退職者が選択肢に出ない）
- 担当者引継ぎ機能の「離任者（移管元）」選択にのみ表示される（移管操作のため）
- 過去の活動ログ・ステージ変更履歴に残る記録は保持される（論理削除のみ、物理削除なし）

## 3. リレーションシップと整合性

### 3.1 階層構造

データは以下の階層で管理されており、下位階層は常に上位階層の `id` を参照します。
`取引先 (Accounts)` ＞ `部署 (Departments)` ＞ `案件 (Projects)` ＞ `活動ログ (Logs)`

### 3.2 連鎖削除 (Cascade Delete)

スプレッドシートには物理的な外部キー制約が存在しないため、プログラム側で以下の整合性を維持しています：

- **取引先削除**: 関連するすべての部署、案件、ログ、ステージ変更履歴を物理削除。
- **部署削除**: 関連するすべての案件、ログ、ステージ変更履歴を物理削除。
- **案件削除**: 関連するすべてのログ、ステージ変更履歴を物理削除。

### 3.3 既知の制限：カレンダーイベントの孤立

`deleteProject` はGoogleカレンダーイベントを削除するが、`deleteDepartmentWithCascade` と `deleteAccountWithCascade` は配下の案件のカレンダーイベントを削除しない。現在はカレンダー連携を無効化・空欄運用しているため実害なし。カレンダー連携を再有効化する際は、両関数に案件IDを収集してイベントを削除する処理を追加すること。
