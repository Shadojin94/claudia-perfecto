import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Image, HeadsetIcon, History, Mic, MicOff, Settings2, Sparkles, Send } from 'lucide-react';
import { generateResponse, generateSpeech, analyzeImage } from '../lib/gemini';
import CircularSpectrum from './CircularSpectrum'; // We might want to update this later or replace it
import HistoryModal from './HistoryModal';
import { saveMessage, loadHistory, clearHistory, type ChatMessage } from '../lib/cache';
import { cn } from '../lib/utils';
import { gsap } from 'gsap';

export default function VoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [showTextInput, setShowTextInput] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory().then(setMessages);
  }, []);

  // GSAP Idle Animation for Orb
  useEffect(() => {
    if (!orbRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(orbRef.current, {
        scale: 1.05,
        duration: 4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });

      gsap.to(orbRef.current, {
        rotation: 360,
        duration: 20,
        repeat: -1,
        ease: "linear"
      });
    });

    return () => ctx.revert();
  }, []);

  const handleClearHistory = async () => {
    await clearHistory();
    setMessages([]);
    setIsHistoryOpen(false);
  };

  const speakMessage = useCallback(async (text: string) => {
    try {
      setStatus('speaking');
      setIsSpeaking(true);
      const audioData = await generateSpeech(text);

      // If audioData is empty, it means the fallback handled playback (or failed gracefully)
      if (audioData.byteLength === 0) {
        // Fallback usually plays audio directly, so we wait or just reset immediately?
        // The fallback implementation in gemini.ts plays the audio THEN resolves.
        // So we can assume speaking is done or handled by browser.
        // However, `window.speechSynthesis.speak` is asynchronous but doesn't return a promise.
        // Ideally we should listen to 'end' event but for now let's just reset status 
        // after a short delay or immediately if we trust the browser TTS UI.
        // Better: The fallback returns AFTER speaking starts. The `speak` method queues it.

        // Let's attach an onend listener to the utterance if possible? 
        // We can't access the utterance here easily without refactoring gemini.ts.

        // Compromise: Just reset state. The browser TTS will play.
        // But `isSpeaking` visual might be wrong. 
        // For now, let's keep it simple: assume if it's 0 bytes, we just reset.
        setIsSpeaking(false);
        setStatus('idle');
        return;
      }

      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = url;
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        setStatus('idle');
        URL.revokeObjectURL(url);
      };

      await audioRef.current.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
      setStatus('idle');
    }
  }, []);

  const handleUserInput = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setStatus('thinking');
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      isAgent
    };

    await saveMessage(userMessage);
    setMessages(prev => [...prev, userMessage]);
    setTextInput('');
    setShowTextInput(false);

    try {
      const response = await generateResponse(text, isAgent);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        isAgent
      };

      await saveMessage(assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
      await speakMessage(response);
    } catch (error) {
      console.error('Error:', error);
      setStatus('idle');
    }
  }, [speakMessage, isAgent]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsMenuOpen(false);
    setStatus('thinking');

    try {
      const response = await analyzeImage(file);
      await speakMessage(response);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        isAgent: false
      };

      await saveMessage(assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error analyzing image:', error);
      setStatus('idle');
    }
  };

  const toggleListening = useCallback(() => {
    if (!isListening) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'fr-FR';

        recognition.onstart = () => {
          setIsListening(true);
          setStatus('listening');
        }

        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          handleUserInput(text);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setStatus('idle');
        };

        recognition.onend = () => {
          setIsListening(false);
          // If we didn't get a result, we might want to go back to idle, handled by handleUserInput or here if silence
          if (status === 'listening') setStatus('idle');
        };

        recognition.start();
      }
    } else {
      setIsListening(false);
      setStatus('idle');
    }
  }, [isListening, handleUserInput, status]);

  return (
    <div className="relative h-screen w-full flex flex-col items-center justify-between overflow-hidden bg-zinc-950 text-white font-sans selection:bg-teal-500/30">

      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-slate-900/20 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full p-6 flex justify-between items-center glass-panel mt-4 mx-4 rounded-2xl max-w-4xl opacity-0 animate-fade-in-down" style={{ animationFillMode: 'forwards', animationDelay: '0.2s' }}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAgent ? "bg-slate-400" : "bg-teal-500")} />
          <span className="text-sm font-medium tracking-wide opacity-80 uppercase">{isAgent ? 'System Agent' : 'Claudia AI'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            title="History"
          >
            <History size={18} className="opacity-70" />
          </button>
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Settings2 size={18} className="opacity-70" />
          </button>
        </div>
      </header>

      {/* Main Content Area - THE ORB */}
      <main className="relative flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto z-0">

        <div className="relative w-64 h-64 md:w-96 md:h-96 flex items-center justify-center">
          {/* Glow effect behind */}
          <div className="absolute inset-0 gemini-glow rounded-full" />

          {/* The Orb Container */}
          <div ref={orbRef} className="relative w-full h-full rounded-full flex items-center justify-center">

            {/* Current Status Visualization */}
            <AnimatePresence mode="wait">
              {status === 'speaking' || status === 'listening' ? (
                <motion.div
                  key="spectrum"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-full h-full"
                >
                  <CircularSpectrum isPlaying={true} />
                </motion.div>
              ) : (
                /* Idle / Thinking State */
                <motion.div
                  key="orb-core"
                  className={cn(
                    "w-48 h-48 md:w-64 md:h-64 rounded-full shadow-2xl backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all duration-1000",
                    isAgent ? "bg-slate-800/50 shadow-slate-500/20" : "bg-teal-900/30 shadow-teal-500/20"
                  )}
                  animate={status === 'thinking' ? {
                    scale: [1, 1.1, 1],
                    borderColor: ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.1)"],
                  } : {}}
                  transition={status === 'thinking' ? { duration: 1.5, repeat: Infinity } : {}}
                >
                  <div className={cn(
                    "w-32 h-32 md:w-48 md:h-48 rounded-full opacity-80 mix-blend-screen filter blur-md transition-colors duration-1000",
                    isAgent ? "bg-gradient-to-tr from-slate-600 to-slate-300" : "bg-gradient-to-tr from-teal-800 to-teal-400"
                  )} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status Text */}
        <div className="h-8 mt-8 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-lg font-light tracking-widest uppercase text-white/50"
            >
              {status === 'idle' && (isAgent ? "Système prêt" : "Claudia écoute...")}
              {status === 'listening' && "J'écoute..."}
              {status === 'thinking' && "Réflexion..."}
              {status === 'speaking' && "Parole..."}
            </motion.p>
          </AnimatePresence>
        </div>

      </main>

      {/* Footer Controls */}
      <footer className="relative z-10 w-full p-6 pb-8 flex flex-col items-center justify-center gap-4">

        {/* Text Input Popover */}
        <AnimatePresence>
          {showTextInput && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-full max-w-lg mb-4 glass-panel rounded-2xl p-2 flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUserInput(textInput);
                }}
                placeholder="Écrivez votre message..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 px-4 py-2"
                autoFocus
              />
              <button
                onClick={() => handleUserInput(textInput)}
                disabled={!textInput.trim()}
                className="p-3 rounded-xl bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 disabled:opacity-50 transition-colors"
              >
                <Send size={20} />
              </button>
              <button
                onClick={() => setShowTextInput(false)}
                className="p-3 rounded-xl hover:bg-white/5 text-white/50 transition-colors"
              >
                <X size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dock */}
        {!showTextInput && (
          <div className="glass-panel rounded-full p-2 flex items-center gap-4 px-6 mb-4">
            <button
              onClick={() => setShowTextInput(true)}
              className="p-4 rounded-full hover:bg-white/10 text-white/70 transition-colors group"
              title="Type Message"
            >
              <span className="sr-only">Clavier</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:text-teal-400 transition-colors"><rect width="18" height="12" x="3" y="6" rx="2" /><path d="M8 8h.01" /><path d="M12 8h.01" /><path d="M16 8h.01" /><path d="M8 12h.01" /><path d="M12 12h.01" /><path d="M16 12h.01" /></svg>
            </button>

            <button
              onClick={toggleListening}
              className={cn(
                "relative p-6 rounded-full transition-all duration-300",
                isListening
                  ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  : "bg-teal-500 text-white hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-105"
              )}
            >
              {isListening ? <MicOff size={28} /> : <Mic size={28} />}
              {/* Ripple effect when listening */}
              {isListening && (
                <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
              )}
            </button>

            <div className="relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-full hover:bg-white/10 text-white/70 transition-colors group"
                title="Upload Image"
              >
                <Image size={24} className="group-hover:text-purple-400 transition-colors" />
              </button>
            </div>
          </div>
        )}
      </footer>

      {/* Settings/Mode Modal (Simplified) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass-panel p-6 rounded-3xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Paramètres</h2>
                <button onClick={() => setIsMenuOpen(false)}><X size={20} className="opacity-50" /></button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsAgent(!isAgent);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl flex items-center justify-between border transition-all",
                    isAgent
                      ? "bg-slate-800 border-slate-600"
                      : "hover:bg-white/5 border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <HeadsetIcon size={20} className={isAgent ? "text-slate-400" : "text-white/50"} />
                    <span>Mode Agent (Neutre)</span>
                  </div>
                  {isAgent && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                </button>

                <button
                  onClick={() => {
                    setIsAgent(false);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl flex items-center justify-between border transition-all",
                    !isAgent
                      ? "bg-teal-900/30 border-teal-500/50"
                      : "hover:bg-white/5 border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} className={!isAgent ? "text-teal-400" : "text-white/50"} />
                    <span>Mode Claudia (Fun)</span>
                  </div>
                  {!isAgent && <div className="w-2 h-2 rounded-full bg-teal-400" />}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        messages={messages}
        onClear={handleClearHistory}
      />
    </div>
  );
}