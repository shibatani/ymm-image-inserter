# YMM画像自動挿入ツール

YukkuriMovieMaker (YMM) のプロジェクトファイル (.ymmp) に、CSVで定義された画像を自動挿入するCLIツール。

## セットアップ

```bash
bun install
cp .env.example .env
# .env に GEMINI_API_KEY を設定（AI画像生成を使う場合）
```

## 使い方

```bash
bun run src/index.ts \
  --csv <画像定義CSV> \
  --ymmp <入力ymmpファイル> \
  --photos <実写/図解画像ディレクトリ> \
  --output <出力ymmpファイル>
```

### オプション

| オプション | 説明 |
|---|---|
| `--dry-run` | プレビューのみ（ymmpを変更しない） |
| `--max-generate N` | AI画像生成の最大枚数を制限 |
| `--clip-width N` | クリッピング領域の幅（デフォルト: 960） |
| `--clip-height N` | クリッピング領域の高さ（デフォルト: 540） |

### 例

```bash
# Dry runで確認
bun run src/index.ts --csv images.csv --ymmp project.ymmp --photos ./photos --output output.ymmp --dry-run

# AI画像を最大3枚まで生成
bun run src/index.ts --csv images.csv --ymmp project.ymmp --photos ./photos --output output.ymmp --max-generate 3
```

## 環境変数

| 変数名 | 説明 |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API キー（AI画像生成に必要） |

## テスト

```bash
bun test
```

## 処理フロー

1. CSV読み込み → 画像グループ抽出
2. ymmp読み込み → VoiceItem抽出 + チャプター検出
3. セリフマッチング（CSV ↔ ymmp）
4. クリッピングテンプレート挿入（Layer 10）
5. 実写/図解画像挿入（Layer 11 + 参考文献 Layer 12）
6. AI画像生成（Imagen API）
7. AI画像挿入（Layer 11）
8. ymmp出力
