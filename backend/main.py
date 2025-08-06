from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import aiohttp
import json
import logging
import os
from typing import Dict, Any
from pydantic import BaseModel

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VoiceChat-Ollama API", version="1.0.0")

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

class ChatRequest(BaseModel):
    user: str = "user"
    message: str

class HealthResponse(BaseModel):
    status: str

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """ヘルスチェックエンドポイント"""
    return HealthResponse(status="ok")

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """
    チャットエンドポイント
    ユーザーのメッセージをOllamaに送信し、SSEでストリーミング応答を返す
    """
    try:
        logger.info(f"Received chat request from user: {request.user}")
        logger.info(f"Message: {request.message}")
        
        # Ollamaへのリクエストペイロード
        ollama_payload = {
            "model": "llama3",
            "messages": [
                {
                    "role": "system", 
                    "content": "You are a friendly English conversation partner. Keep responses conversational, natural, and engaging. Respond in English only."
                },
                {"role": "user", "content": request.message}
            ],
            "stream": True,
            "options": {
                "temperature": 0.7,
                "num_predict": 256
            }
        }
        
        async def event_generator():
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
                                        # OllamaのJSONレスポンスをパースしてSSE形式で送信
                                        data = json.loads(line)
                                        if 'message' in data and 'content' in data['message']:
                                            content = data['message']['content']
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