'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { useTtsSettings } from '@/hooks/useTtsSettings';

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

  // 設定を反映（ChatInterfaceのキュー再生と統一）
  const { settings: tts, resolveVoice } = useTtsSettings();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    try { window.speechSynthesis.cancel(); } catch {}

    const utterance = new SpeechSynthesisUtterance(text);
    const v = resolveVoice();
    if (v) utterance.voice = v;

    utterance.volume = tts.volume;
    utterance.rate   = tts.rate;
    utterance.pitch  = tts.pitch;
    utterance.lang   = v?.lang ?? 'en-US';

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, resolveVoice, tts.volume, tts.rate, tts.pitch]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    try { window.speechSynthesis.cancel(); } catch {}
    setIsSpeaking(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    try { window.speechSynthesis.pause(); } catch {}
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    try { window.speechSynthesis.resume(); } catch {}
  }, [isSupported]);

  return {
    speak,
    isSpeaking,
    isSupported,
    stop,
    pause,
    resume,
  };
};
