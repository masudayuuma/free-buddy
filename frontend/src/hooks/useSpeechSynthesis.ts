'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

// インターフェース（外部との契約）は一切変更しない
export interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  isSpeaking: boolean;
  isSupported: boolean;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

export const useSpeechSynthesis = (): UseSpeechSynthesisReturn => {
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // useEffectはブラウザ対応のチェックのみに利用。音声リストの保持は不要になる。
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // ===== 修正点 1: speak関数が実行される「その瞬間」に音声リストを取得 =====
    // これにより、読み込みタイミングの問題を回避し、最新のリストで検索できる。
    const voices = window.speechSynthesis.getVoices();
    const siriVoice = voices.find(voice => voice.name === 'Samantha');
    
    if (siriVoice) {
      utterance.voice = siriVoice;
    }

    // ===== 修正点 2: Siriの自然な話し方に合わせるためrateを1.0に =====
    utterance.lang = 'en-US';
    utterance.rate = 1.0; // Siriの自然な速度は1.0
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      console.log('Speech synthesis started');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('Speech synthesis ended');
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    // 依存配列からvoicesを削除
  }, [isSupported]);

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.pause();
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.resume();
    }
  }, [isSupported]);

  // 返却するオブジェクトの構成は変更しない
  return {
    speak,
    isSpeaking,
    isSupported,
    stop,
    pause,
    resume,
  };
};