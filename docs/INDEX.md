# account-target-manager - ドキュメント索引

## エンドユーザー向け

| ドキュメント | 対象ロール | 概要 |
| :--- | :--- | :--- |
| [MANUAL_MEMBER.md](MANUAL_MEMBER.md) | `member` / `leader` | 担当者向け操作説明書（日常業務フロー・権限体系・FAQ） |
| [MANUAL_MANAGER.md](MANUAL_MANAGER.md) | `manager` / `admin` | 管理者向け操作説明書（全担当者閲覧・設問管理・キャンペーン管理） |

## 開発者・アーキテクト向け（推奨読書順）

| 順 | ドキュメント | 概要 |
| :-: | :--- | :--- |
| 0 | [SETUP.md](SETUP.md) | セットアップ手順・スクリプトプロパティ設定・デプロイ |
| 1 | [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | システム全体像・技術スタック・ファイル構成 |
| 2 | [REQUIREMENTS.md](REQUIREMENTS.md) | 機能要件・非機能要件（権限体系・制約事項） |
| 3 | [DATABASE_DESIGN.md](DATABASE_DESIGN.md) | シート定義・リレーション・カスケード削除ルール |
| 4 | [UI_FLOW.md](UI_FLOW.md) | タブ構成・画面遷移ロジック・共通UIコンポーネント |
| 5 | [PATTERNS.md](PATTERNS.md) | 実装パターン早見表（レビューの判断基準） |
| 6 | [TASKS.md](TASKS.md) | 開発タスク進捗・既知の制限事項 |

## 開発ワークフロー

| ドキュメント | 概要 |
| :--- | :--- |
| [../CLAUDE.md](../CLAUDE.md) | 設計AI（PM / Tech Lead）の定義 |
| [../AGENTS.md](../AGENTS.md) | 実装AI + レビューエージェント A〜D の定義 |
| [workflow/WORKFLOW.md](workflow/WORKFLOW.md) | 各工程の詳細と設計理由 |
| [workflow/CASE_STUDY.md](workflow/CASE_STUDY.md) | 適用結果・検証状況・限界 |
| [workflow/templates/](workflow/templates/) | 他プロジェクトへ移植するための雛形一式 |

## アーカイブ

`archive/` — 実装完了済みの指示書 36 本。参照は可能だが、**現在の仕様は上記ドキュメントを正とする**。

> 指示書は「その時点の意思決定の記録」であり、SSOT ではありません。
> 仕様が変わった場合は上記ドキュメントを更新し、過去の指示書は書き換えません。
