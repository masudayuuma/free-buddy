'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';

export default function ChatInterface() {
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    setTextInput('');
    
    let fullResponse = '';
    await sendMessage(message, (token) => {
      fullResponse += token;
    });

    // アシスタントの応答を音声で再生
    if (fullResponse.trim() && isSpeechSynthesisSupported) {
      speak(fullResponse);
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
          handleSendMessage(finalTranscript);
        }
        setIsRecording(false);
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