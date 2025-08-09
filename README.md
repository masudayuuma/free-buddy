# VoiceChat-Ollama 🎤🤖 aiii

**FastAPI × Next.js × Ollama ローカル LLM** を使った英会話チャットアプリ（音声 I/O 対応）

ブラウザだけで英語を「話し」「聞き」しながら LLM と対話できるリアルタイム英会話体験を提供します。

## ✨ 特徴

- 🎤 **音声入力 (STT)**: Web Speech API による音声認識
- 🔊 **音声出力 (TTS)**: ブラウザ内蔵の音声合成
- 🚀 **リアルタイム応答**: Server-Sent Events によるストリーミング応答
- 🏠 **完全ローカル**: Ollama LLM をローカルで実行
- 🐳 **簡単セットアップ**: Docker Compose で一発起動
- 📱 **レスポンシブデザイン**: モバイル・デスクトップ対応

## 🛠 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **TypeScript**
- **Web Speech API** (SpeechRecognition + SpeechSynthesis)
- **Server-Sent Events** (EventSource)

### バックエンド
- **FastAPI** (Python 3.11)
- **aiohttp** (非同期HTTP クライアント)
- **sse-starlette** (Server-Sent Events サポート)

### LLM
- **Ollama** (ローカル LLM ランタイム)
- **Llama 3** (デフォルトモデル)

## 📋 前提条件

- **Docker & Docker Compose** 2.x
- **Ollama** 0.2.0+ がローカルで起動している
- **Chrome/Chromium ベースブラウザ** (Web Speech API サポート)
- **Node.js 22 LTS** (開発時)
- **Python 3.11** (開発時)

## 🚀 クイックスタート

### 1. Ollama のセットアップ

```bash
# Ollama のインストール (macOS)
brew install ollama

# Ollama の起動
ollama serve

# Llama 3 モデルのダウンロード (別ターミナル)
ollama pull llama3
```

### 2. アプリケーションの起動

```bash
# リポジトリのクローン
git clone <repository-url>
cd ai-speaker-app

# Docker Compose でアプリケーション起動
docker-compose up --build

# または開発モードで起動
docker-compose up --build -d
```

### 3. アクセス

- **フロントエンド**: http://localhost:3000
- **バックエンド API**: http://localhost:8000
- **API ドキュメント**: http://localhost:8000/docs

## 🎯 使い方

1. **ブラウザでアクセス**: Chrome で http://localhost:3000 を開く
2. **マイクの許可**: ブラウザでマイクの使用を許可
3. **音声での会話**:
   - 🎤 **Start Recording** ボタンを押す
   - 英語で話しかける
   - 自動で音声認識され、AI が応答
   - AI の応答が音声で再生される
4. **テキストでの会話**:
   - 下部のテキスト入力欄に入力
   - **Send** ボタンで送信

## 🏗 プロジェクト構造

```
ai-speaker-app/
├── backend/                 # FastAPI バックエンド
│   ├── main.py             # API エンドポイント
│   ├── requirements.txt    # Python 依存関係
│   └── Dockerfile          # バックエンド用 Docker
├── frontend/               # Next.js フロントエンド
│   ├── src/
│   │   ├── app/            # Next.js App Router
│   │   ├── components/     # React コンポーネント
│   │   └── hooks/          # カスタムフック
│   ├── package.json        # Node.js 依存関係
│   └── Dockerfile          # フロントエンド用 Docker
├── docker-compose.yml      # Docker Compose 設定
└── README.md               # このファイル
```

## 🔧 API エンドポイント

### POST `/api/chat`

チャット API - ユーザーのメッセージを受信し、LLM の応答を Server-Sent Events でストリーミング

**リクエスト**:
```json
{
  "user": "user",
  "message": "Hello, how are you?"
}
```

**レスポンス** (SSE):
```
data: {"role": "assistant", "content": "Hello! I'm doing well, thank you for asking. How are you today?", "done": false}
```

### GET `/health`

ヘルスチェック API

**レスポンス**:
```json
{
  "status": "ok"
}
```

## 🎛 設定・カスタマイズ

### 環境変数

**Backend (docker-compose.yml)**:
- `OLLAMA_HOST`: Ollama サーバーのホスト (デフォルト: `host.docker.internal:11434`)
- `PYTHONUNBUFFERED`: Python ログのバッファリング無効化

**Frontend (docker-compose.yml)**:
- `NEXT_PUBLIC_API_URL`: バックエンド API の URL (デフォルト: `http://localhost:8000`)

### LLM モデルの変更

`backend/main.py` の `ollama_payload` を編集:

```python
ollama_payload = {
    \"model\": \"llama3\",  # ここを変更 (例: \"codellama\", \"mistral\" など)
    # ...
}
```

## 🧪 開発・テスト

### 開発環境での実行

```bash
# バックエンドの開発起動
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# フロントエンドの開発起動 (別ターミナル)
cd frontend
npm install
npm run dev
```

### ヘルスチェック

```bash
# バックエンドのヘルスチェック
curl http://localhost:8000/health

# Ollama の動作確認
curl http://localhost:11434/api/version
```

## 📊 パフォーマンス目標

- **レイテンシ**: ユーザー発話終了〜TTS 開始まで平均 ≤ 800ms
- **同時接続**: 5 セッション安定稼働
- **LLM 応答速度**: ≥ 20 tok/s（ローカル環境）

## 🚨 トラブルシューティング

### 音声認識が動作しない
- Chrome/Chromium ベースブラウザを使用してください
- HTTPS でアクセスしている場合は、マイクの許可を確認
- ブラウザの設定でマイクアクセスが有効になっているか確認

### LLM の応答が遅い/エラーが出る
- Ollama が正常に起動しているか確認: `ollama list`
- 指定したモデルがダウンロード済みか確認: `ollama pull llama3`
- Docker コンテナのログを確認: `docker-compose logs backend`

### CORS エラー
- バックエンドの CORS 設定を確認
- フロントエンドの API URL が正しいか確認

### Docker 起動エラー
- Docker Desktop が起動しているか確認
- ポート 3000, 8000 が他のプロセスで使用されていないか確認

## 🤝 コントリビューション

1. フォークしてください
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📝 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🙋‍♂️ サポート

問題やご質問がありましたら、GitHub Issues でお知らせください。

---

**Happy Chatting!** 🎉