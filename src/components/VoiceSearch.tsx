import { useEffect, useRef, useState } from 'react';
import { showToast } from './Toast';

interface Props {
  onResult: (text: string) => void;
}

// SpeechRecognition tipi (TS lib'de yok)
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: SpeechRecognitionResultLike[][] }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export default function VoiceSearch({ onResult }: Props) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionLike | null>(null);
  const browserWindow = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const supported = Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous     = false;
    r.interimResults = false;
    r.lang           = 'tr-TR';
    r.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript;
      if (text) onResult(text);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed') {
        showToast('Mikrofon izni gerekli', 'error');
      } else if (e.error !== 'no-speech') {
        showToast('Ses tanıma hatası: ' + e.error, 'error');
      }
      setListening(false);
    };
    r.onend = () => setListening(false);
    recogRef.current = r;
  }, [onResult]);

  function toggle() {
    if (!supported || !recogRef.current) {
      showToast('Tarayıcın sesli aramayı desteklemiyor', 'error');
      return;
    }
    if (listening) {
      recogRef.current.stop();
      setListening(false);
    } else {
      try {
        recogRef.current.start();
        setListening(true);
        showToast('🎤 Dinleniyor… konuş!', 'info');
      } catch {
        // already running
        setListening(true);
      }
    }
  }

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      title={listening ? 'Dinleniyor. Durdurmak için tıkla' : 'Sesli arama'}
      type="button"
      aria-label={listening ? 'Sesli aramayı durdur' : 'Sesli arama'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        listening
          ? 'bg-red-500 text-white animate-pulse'
          : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      }`}
    >
      <svg className="w-4 h-4" fill={listening ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
}
