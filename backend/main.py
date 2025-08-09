from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import aiohttp
import json
import logging
import os
from typing import Dict, Any, List, Union
from db import engine, SessionLocal, Base, init_db_with_defaults
from models import Theme
from pydantic import BaseModel

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VoiceChat-Ollama API", version="1.1.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ollama設定
OLLAMA_BASE_URL = os.getenv("OLLAMA_HOST", "host.docker.internal:11434")
OLLAMA_API_URL = f"http://{OLLAMA_BASE_URL}/api/chat"

init_db_with_defaults()

class ChatRequest(BaseModel):
    user: str = "user"
    message: str
    theme: Union[int, str] = 1  # 数値ID または タイトル文字列

class ThemeCreateRequest(BaseModel):
    title: str
    description: str
    system_prompt: str

class HealthResponse(BaseModel):
    status: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """ヘルスチェックエンドポイント"""
    return HealthResponse(status="ok")


@app.get("/api/themes")
async def list_themes():
    """利用可能な会話テーマ一覧を返す"""
    session = SessionLocal()
    try:
        rows = session.query(Theme).all()
        return [
            {"id": r.id, "title": r.title, "description": r.description}
            for r in rows
        ]
    finally:
        session.close()


@app.get("/api/themes/{theme_key}")
async def get_theme(theme_key: str):
    session = SessionLocal()
    try:
        row = session.get(Theme, int(theme_key)) if theme_key.isdigit() else session.query(Theme).filter_by(title=theme_key).first()
        if row is None:
            raise HTTPException(status_code=404, detail="Theme not found")
        return {"id": row.id, "title": row.title, "description": row.description, "system_prompt": row.system_prompt}
    finally:
        session.close()


@app.post("/api/themes")
async def create_theme(request: ThemeCreateRequest):
    """新しい会話テーマを作成する"""
    session = SessionLocal()
    try:
        # タイトルの重複チェック
        existing = session.query(Theme).filter_by(title=request.title).first()
        if existing:
            raise HTTPException(status_code=409, detail="Theme with this title already exists")
        
        # 新しいテーマを作成
        new_theme = Theme(
            title=request.title,
            description=request.description,
            system_prompt=request.system_prompt
        )
        session.add(new_theme)
        session.commit()
        session.refresh(new_theme)
        
        return {
            "id": new_theme.id,
            "title": new_theme.title,
            "description": new_theme.description,
            "system_prompt": new_theme.system_prompt
        }
    finally:
        session.close()

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    チャットエンドポイント
    ユーザーのメッセージをOllamaに送信し、SSEでストリーミング応答を返す
    """
    try:
        logger.info(f"Received chat request from user: {request.user}")
        logger.info(f"Message: {request.message}")
        
        # ===== テーマの取得（DB）／履歴は使わない =====
        theme_key = request.theme
        session = SessionLocal()
        try:
            if isinstance(theme_key, int):
                theme_row = session.get(Theme, theme_key)
            else:
                theme_row = session.get(Theme, int(theme_key)) if isinstance(theme_key, str) and theme_key.isdigit() else session.query(Theme).filter_by(title=str(theme_key)).first()
        finally:
            session.close()
        if theme_row is None:
            raise HTTPException(status_code=400, detail=f"Unknown theme: {theme_key}")

        # テーマに応じたシステムプロンプト
        system_prompt = theme_row.system_prompt

        # Ollamaへのリクエストペイロード（履歴なしで毎回新規会話）
        ollama_payload = {
            "model": "llama3.2:1b",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            "stream": True,
            "options": {"temperature": 0.7, "num_predict": 256},
        }
        
        async def event_generator():
            # ===== 変更点 4: ストリーミングされたAIの応答全体を保存するための変数 =====
            full_assistant_response = ""
            try:
                timeout = aiohttp.ClientTimeout(total=30)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        OLLAMA_API_URL, 
                        json=ollama_payload,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            logger.error(f"Ollama API error: {response.status} - {error_text}")
                            yield json.dumps({'error': f'Ollama API error: {response.status}'})
                            return
                            
                        buffer = ""
                        async for chunk in response.content:
                            buffer += chunk.decode('utf-8')
                            while '\n' in buffer:
                                line, buffer = buffer.split('\n', 1)
                                line = line.strip()
                                if line:
                                    try:
                                        data = json.loads(line)
                                        if 'message' in data and 'content' in data['message']:
                                            content = data['message']['content']
                                            # AIの応答を追記していく
                                            full_assistant_response += content

                                            sse_data = {
                                                "role": "assistant",
                                                "content": content,
                                                "done": data.get("done", False)
                                            }
                                            yield json.dumps(sse_data)
                                            
                                            if data.get("done", False):
                                                break
                                    except json.JSONDecodeError as e:
                                        logger.warning(f"Failed to parse Ollama response: {line} - {e}")
                                        continue
                
                # 履歴の保存はしない（ステートレス）
                                    
            except aiohttp.ClientError as e:
                logger.error(f"Connection error to Ollama: {e}")
                yield json.dumps({'error': 'Failed to connect to Ollama. Make sure Ollama is running.'})
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                yield json.dumps({'error': 'Internal server error'})
        
        return EventSourceResponse(event_generator())
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)