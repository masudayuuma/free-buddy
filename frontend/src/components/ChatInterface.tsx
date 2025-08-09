'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

interface ChatInterfaceProps {
  selectedTheme?: { id: number; title: string; description: string };
}

export default function ChatInterface({ selectedTheme }: ChatInterfaceProps) {
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const { 
    transcript, 
    isListening, 
    isSupported: isSpeechRecognitionSupported, 
    startListening, 
    stopListening,
    hasError: speechError,
    errorMessage: speechErrorMessage
  } = useSpeechRecognition();
  const { speak, isSpeaking, isSupported: isSpeechSynthesisSupported, stop: stopSpeaking } = useSpeechSynthesis();

  // メッセージが追加されたときに自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 音声認識の結果をテキスト入力に反映
  useEffect(() => {
    if (transcript) {
      setTextInput(transcript);
    }
  }, [transcript]);

  // 音声キューを順次処理する関数
  const processSpeechQueue = async () => {
    if (isProcessingQueueRef.current) {
      return;
    }

    isProcessingQueueRef.current = true;
    
    try {
      // キューが空になるまで処理を継続
      while (speechQueueRef.current.length > 0) {
        const textToSpeak = speechQueueRef.current.shift();
        
        if (textToSpeak && isSpeechSynthesisSupported && textToSpeak.trim()) {
          console.log('Starting speech:', textToSpeak.substring(0, 30) + '... (Remaining in queue:', speechQueueRef.current.length + ')');
          
          // Promise を使って音声終了を確実に待機
          await new Promise<void>((resolve) => {
            let resolved = false;
            
            const utterance = new window.SpeechSynthesisUtterance(textToSpeak.trim());
            
            // Samantha声の設定（useSpeechSynthesisフックと同じロジック）
            const voices = window.speechSynthesis.getVoices();
            console.log('Available voices:', voices.length, voices.map(v => v.name));
            const siriVoice = voices.find(voice => voice.name === 'Samantha');
            if (siriVoice) {
              utterance.voice = siriVoice;
              console.log('✅ Using Samantha voice for:', textToSpeak.substring(0, 30) + '...');
            } else {
              console.log('❌ Samantha voice not found, available voices:', voices.map(v => v.name).slice(0, 5));
              // フォールバック: 他の高品質な英語音声を探す
              const fallbackVoice = voices.find(voice => 
                voice.lang.startsWith('en') && 
                (voice.name.includes('Premium') || voice.name.includes('Enhanced'))
              );
              if (fallbackVoice) {
                utterance.voice = fallbackVoice;
                console.log('Using fallback voice:', fallbackVoice.name);
              }
            }
            
            utterance.lang = 'en-US';
            utterance.rate = 1.0;  // Samanthaの自然な速度
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            utterance.onstart = () => {
              console.log('Speech started');
            };
            
            utterance.onend = () => {
              if (!resolved) {
                resolved = true;
                console.log('Speech ended:', textToSpeak.substring(0, 30) + '...');
                resolve();
              }
            };
            
            utterance.onerror = (event) => {
              if (!resolved) {
                resolved = true;
                console.error('Speech error:', event);
                resolve(); // エラーでも次に進む
              }
            };
            
            // タイムアウト設定（最大30秒）
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                console.warn('Speech timeout for:', textToSpeak.substring(0, 30) + '...');
                window.speechSynthesis.cancel();
                resolve();
              }
            }, 30000);
            
            // 既存の音声をキャンセルしてから開始
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          });
          
          // 各音声の間に少し間隔を開ける（自然な流れのため）
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
      console.log('Speech queue processing completed');
    }
  };

  // 音声キューに追加する関数
  const addToSpeechQueue = (text: string) => {
    if (text.trim()) {
      speechQueueRef.current.push(text.trim());
      console.log('Added to speech queue:', text.substring(0, 30) + '... (Queue length:', speechQueueRef.current.length + ')');
      
      // 現在処理中でない場合のみ処理を開始
      if (!isProcessingQueueRef.current) {
        console.log('Starting queue processing...');
        processSpeechQueue();
      } else {
        console.log('Queue processing already in progress, item added to queue');
      }
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // メッセージを送信する前に録音を確実に停止
    if (isListening) {
      stopListening();
      setIsRecording(false);
    }

    setTextInput('');
    
    // 現在の音声再生を停止（新しい応答が始まるため）
    if (isSpeaking) {
      stopSpeaking();
    }
    
    // 音声キューをクリア
    speechQueueRef.current = [];
    isProcessingQueueRef.current = false;

    let sentenceBuffer = '';
    
    await sendMessage(message, (token) => {
      sentenceBuffer += token;
      
      // 文の終わりを検出（句読点 + スペース or 改行）または長いフレーズ
      const sentenceEndPattern = /[.!?]\s+|[.!?]$|\n/;
      if (sentenceEndPattern.test(sentenceBuffer) || sentenceBuffer.length > 80) {
        const textToSpeak = sentenceBuffer.trim();
        if (textToSpeak) {
          // 音声キューに追加して順次再生
          addToSpeechQueue(textToSpeak);
        }
        sentenceBuffer = ''; // バッファをクリア
      }
    }, selectedTheme?.id);

    // 残りのテキストがある場合は最後にキューに追加
    if (sentenceBuffer.trim()) {
      addToSpeechQueue(sentenceBuffer.trim());
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      startListening((finalTranscript) => {
        if (finalTranscript.trim()) {
          // メッセージ送信前に録音を停止
          stopListening();
          setIsRecording(false);
          handleSendMessage(finalTranscript);
        } else {
          setIsRecording(false);
        }
      });
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      handleSendMessage(textInput);
    }
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    // 音声キューもクリア
    speechQueueRef.current = [];
    isProcessingQueueRef.current = false;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>🎤 VoiceChat with AI</h1>
        <button onClick={clearMessages} className="clear-button">
          Clear Chat
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-role">
              {message.role === 'user' ? '👤 You' : '🤖 AI'}
            </div>
            <div className="message-content">{message.content}</div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant-message">
            <div className="message-role">🤖 AI</div>
            <div className="message-content typing">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-section">
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
        
        {speechError && (
          <div className="error-message">
            ❌ {speechErrorMessage}
          </div>
        )}

        <div className="voice-controls">
          {isSpeechRecognitionSupported ? (
            <button
              onClick={handleMicClick}
              className={`mic-button ${isListening ? 'recording' : ''}`}
              disabled={isLoading}
            >
              {isListening ? '🎙️ Stop Recording' : '🎤 Start Recording'}
            </button>
          ) : (
            <div className="no-support-message">
              ⚠️ Speech recognition is not supported in this browser
            </div>
          )}

          {isSpeaking && (
            <button onClick={handleStopSpeaking} className="stop-speaking-button">
              🔇 Stop Speaking
            </button>
          )}
        </div>

        <div className="text-input-section">
          <form onSubmit={handleTextSubmit} className="text-form">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                isSpeechRecognitionSupported 
                  ? "Speak or type your message..." 
                  : "Type your message..."
              }
              className="text-input"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isLoading || !textInput.trim()}
            >
              Send
            </button>
          </form>
        </div>

        <div className="status-indicators">
          <div className={`status-indicator ${isSpeechRecognitionSupported ? 'supported' : 'not-supported'}`}>
            STT: {isSpeechRecognitionSupported ? '✅' : '❌'}
          </div>
          <div className={`status-indicator ${isSpeechSynthesisSupported ? 'supported' : 'not-supported'}`}>
            TTS: {isSpeechSynthesisSupported ? '✅' : '❌'}
          </div>
          <div className={`status-indicator ${isListening ? 'active' : ''}`}>
            Listening: {isListening ? '🟢' : '⚫'}
          </div>
          <div className={`status-indicator ${isSpeaking ? 'active' : ''}`}>
            Speaking: {isSpeaking ? '🟢' : '⚫'}
          </div>
        </div>
      </div>

      <style jsx>{`
        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 800px;
          margin: 0 auto;
          background: #f5f5f5;
        }

        .chat-header {
          background: #2563eb;
          color: white;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .clear-button {
          background: #ef4444;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          cursor: pointer;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: white;
        }

        .message {
          margin-bottom: 1rem;
          padding: 1rem;
          border-radius: 0.5rem;
          max-width: 80%;
        }

        .user-message {
          background: #dbeafe;
          margin-left: auto;
        }

        .assistant-message {
          background: #f3f4f6;
          margin-right: auto;
        }

        .message-role {
          font-weight: bold;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .message-content {
          margin-bottom: 0.5rem;
          white-space: pre-wrap;
        }

        .message-timestamp {
          font-size: 0.75rem;
          opacity: 0.6;
        }

        .typing {
          font-style: italic;
          opacity: 0.7;
        }

        .input-section {
          background: white;
          border-top: 1px solid #e5e5e5;
          padding: 1rem;
        }

        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 0.5rem;
          border-radius: 0.25rem;
          margin-bottom: 1rem;
        }

        .voice-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          justify-content: center;
        }

        .mic-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 2rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .mic-button.recording {
          background: #ef4444;
          animation: pulse 2s infinite;
        }

        .stop-speaking-button {
          background: #f59e0b;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          cursor: pointer;
        }

        .no-support-message {
          color: #dc2626;
          text-align: center;
          font-size: 0.875rem;
        }

        .text-input-section {
          margin-bottom: 1rem;
        }

        .text-form {
          display: flex;
          gap: 0.5rem;
        }

        .text-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 1rem;
        }

        .send-button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.375rem;
          cursor: pointer;
        }

        .send-button:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }

        .status-indicators {
          display: flex;
          gap: 1rem;
          justify-content: center;
          font-size: 0.875rem;
        }

        .status-indicator {
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          background: #f3f4f6;
        }

        .status-indicator.supported {
          background: #d1fae5;
        }

        .status-indicator.not-supported {
          background: #fef2f2;
        }

        .status-indicator.active {
          background: #dcfce7;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        @media (max-width: 768px) {
          .voice-controls {
            flex-direction: column;
          }
          
          .status-indicators {
            flex-wrap: wrap;
          }
          
          .message {
            max-width: 95%;
          }
        }
      `}</style>
    </div>
  );
}