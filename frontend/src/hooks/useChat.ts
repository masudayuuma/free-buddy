'use client';

import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (message: string, onToken?: (token: string) => void, themeId?: number) => Promise<void>;
  clearMessages: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    message: string, 
    onToken?: (token: string) => void,
    themeId?: number
  ): Promise<void> => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // アシスタントメッセージの準備
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 既存の接続を中止
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: 'user',
          message: message,
          theme: themeId || 1,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let assistantContent = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.slice(6));
                
                if (jsonData.error) {
                  throw new Error(jsonData.error);
                }
                
                if (jsonData.content) {
                  assistantContent += jsonData.content;
                  
                  // リアルタイムでメッセージを更新
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: assistantContent }
                      : msg
                  ));

                  // トークンコールバックを呼び出し
                  if (onToken) {
                    onToken(jsonData.content);
                  }
                }
                
                if (jsonData.done) {
                  break;
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      console.error('Chat error:', err);
      setError(err.message || 'メッセージの送信中にエラーが発生しました');
      
      // エラーメッセージでアシスタントメッセージを更新
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: `エラー: ${err.message}` }
          : msg
      ));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
};