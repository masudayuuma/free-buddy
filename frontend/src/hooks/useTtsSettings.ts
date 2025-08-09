'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type TtsSettings = {
  volume: number;      // 0.0 - 1.0
  rate: number;        // 0.5 - 2.0 推奨
  pitch: number;       // 0.0 - 2.0
  voiceName: string | null;
};

const DEFAULTS: TtsSettings = {
  volume: 1.0,
  rate: 1.0,
  pitch: 1.0,
  voiceName: null,
};

const LS_KEY = 'app.tts.settings.v1';

export function useTtsSettings() {
  const [settings, setSettingsState] = useState<TtsSettings>(() => {
    if (typeof window === 'undefined') return DEFAULTS;
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const setSettings = useCallback((patch: Partial<TtsSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const refreshVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const list = window.speechSynthesis.getVoices() || [];
    setVoices(list);

    // 初回 auto選択
    if (!settings.voiceName && list.length) {
      const samantha = list.find(v => v.name === 'Samantha');
      const en = samantha ?? list.find(v => v.lang?.startsWith('en'));
      if (en) setSettings({ voiceName: en.name });
    }
  }, [setSettings, settings.voiceName]);

  useEffect(() => {
    refreshVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const handler = () => refreshVoices();
      // Safariは発火しないことあり。Refreshボタンも別途用意。
      // @ts-ignore
      window.speechSynthesis.addEventListener?.('voiceschanged', handler);
      return () => {
        // @ts-ignore
        window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
      };
    }
  }, [refreshVoices]);

  const resolveVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const list = voices.length ? voices : (typeof window !== 'undefined' ? window.speechSynthesis.getVoices() : []);
    return (
      list.find(v => v.name === settings.voiceName) ??
      list.find(v => v.name === 'Samantha') ??
      list.find(v => v.lang?.startsWith('en'))
    );
  }, [voices, settings.voiceName]);

  const testSpeak = useCallback((text: string) => {
    if (!text.trim()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); } catch {}
    const utt = new SpeechSynthesisUtterance(text.trim());
    const v = resolveVoice();
    if (v) utt.voice = v;
    utt.volume = settings.volume;
    utt.rate = settings.rate;
    utt.pitch = settings.pitch;
    utt.lang = v?.lang ?? 'en-US';
    window.speechSynthesis.speak(utt);
  }, [resolveVoice, settings]);

  return useMemo(() => ({
    settings,
    setSettings,
    voices,
    refreshVoices,
    resolveVoice,
    testSpeak,
  }), [settings, setSettings, voices, refreshVoices, resolveVoice, testSpeak]);
}
