# 実装パターン早見表

Agent-C・Agent-D・実装AI が「実装パターンの一貫性」を判断する際の共通リファレンス。

## このドキュメントの目的

「既存コードと同じ書き方にする」は人間には伝わりますが、AIエージェントには伝わりません。
毎回コードベース全体を読ませるのは非効率で、しかも読む範囲によって結論がブレます。

そこで **「同じことをする方法は1つに固定し、表として明示する」** 方針を取ります。
これにより「一貫性」という主観的な観点が、チェックリストで機械的に検証できる観点に変わります。

## 運用ルール

- 新しいパターンが確立されたタイミングで**随時追記**する（最初から網羅しようとしない）
- 同じ用途に2つ目の書き方が現れたら、**どちらかを正解に決めて**表を更新し、既存コードごと寄せる
- 表にないパターンを実装AIが新規に採用した場合、Agent-C はそれを**指摘対象**とする
  （悪い実装だからではなく、「表に載せる価値があるか設計AIが判断していない」ため）

Agent-C・Agent-D・実装AI が実装パターンを判断する際の共通リファレンス。  
新たなパターンが確立されたタイミングで随時追記する。

### ローディング表示

| 用途 | 正解パターン |
|---|---|
| 通常のGAS呼び出し（保存・削除・同期等） | `showOverlay("メッセージ")` → 完了後 `hideOverlay()` |
| CSVダウンロード系のGAS呼び出し | `Swal.fire({ allowOutsideClick: false, didOpen: () => Swal.showLoading() })` → 完了後 `Swal.close()` |

### エラーハンドリング

| 用途 | 正解パターン |
|---|---|
| GAS `withFailureHandler` | `Swal.fire("エラー", e.message, "error")` |
| フォームバリデーション失敗 | `Swal.showValidationMessage("メッセージ")` |

### ダイアログ

| 用途 | 正解パターン |
|---|---|
| 削除確認 | `icon: "warning"`, `confirmButtonText: "削除する"`, `cancelButtonText: "キャンセル"` |
| 保存成功トースト | `Swal.mixin({ toast: true, position: "top-end", timer: 2000, ... })` |
| 該当なし通知 | `Swal.fire("該当なし", "メッセージ", "info")` |

### CSVダウンロード

| 項目 | 正解パターン |
|---|---|
| BOM付きUTF-8 | `new Blob([csv], { type: "text/csv;charset=utf-8;" })` ※`_buildCsv` がBOMを付与 |
| ファイル名形式 | `"機能名_条件_" + new Date().toISOString().slice(0, 10) + ".csv"` |
| ダウンロード後処理 | `setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100)` |

### DOM操作・セキュリティ

| 用途 | 正解パターン |
|---|---|
| 動的テキスト挿入 | `element.textContent = value`（`innerHTML` への直接代入禁止） |
| HTMLテンプレートへのデータ埋め込み | `_escapeHtml(value)` を経由する |

### スタイル・クラス名

| 用途 | 正解パターン |
|---|---|
| ツールバーボタン | `class="control-btn"` |
