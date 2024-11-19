import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Image, HeadsetIcon, History } from 'lucide-react';
import { generateResponse, generateSpeech, analyzeImage } from '../lib/openai';
import CircularSpectrum from './CircularSpectrum';
import HistoryModal from './HistoryModal';
import { saveMessage, loadHistory, clearHistory, type ChatMessage } from '../lib/cache';

export default function VoiceChat() {
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAgent, setIsAgent] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState('00:00');

  useEffect(() => {
    loadHistory().then(setMessages);
  }, []);

  const handleClearHistory = async () => {
    await clearHistory();
    setMessages([]);
    setIsHistoryOpen(false);
  };

  const speakMessage = useCallback(async (text: string) => {
    try {
      setIsSpeaking(true);
      const audioData = await generateSpeech(text);
      const blob = new Blob([audioData], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      audioRef.current.src = url;
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      
      await audioRef.current.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  }, []);

  const handleUserInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      isAgent
    };
    
    await saveMessage(userMessage);
    setMessages(prev => [...prev, userMessage]);
    
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
    }
  }, [speakMessage, isAgent]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsMenuOpen(false);

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
    }
  };

  const toggleAgent = () => {
    setIsAgent(!isAgent);
    setIsMenuOpen(false);
    handleUserInput(isAgent ? "Bonjour Claudia!" : "Bonjour, je souhaite parler à un agent.");
  };

  const toggleListening = useCallback(() => {
    if (!isListening) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'fr-FR';
        
        recognition.onresult = (event) => {
          const text = event.results[0][0].transcript;
          handleUserInput(text);
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognition.start();
        setIsListening(true);

        let startTime = Date.now();
        const timer = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
          const seconds = (elapsed % 60).toString().padStart(2, '0');
          setCurrentTime(`${minutes}:${seconds}`);
        }, 1000);

        recognition.onend = () => {
          setIsListening(false);
          clearInterval(timer);
          setCurrentTime('00:00');
        };
      }
    } else {
      setIsListening(false);
    }
  }, [isListening, handleUserInput]);

  return (
    <div className="flex flex-col items-center justify-between h-[80vh] max-w-2xl mx-auto p-4">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold">{isAgent ? 'Agent' : 'Claudia'}</h1>
        <p className="text-[#2F9682] text-sm">
          {new Date().toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <motion.button
          onClick={toggleListening}
          className="relative"
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            className="relative w-64 h-64 rounded-full bg-[#1A1A1F] flex items-center justify-center border border-gray-800 overflow-hidden shadow-lg"
            animate={isListening ? {
              scale: [1, 1.02, 1],
              borderColor: ['#2F9682', '#4FD1C5', '#2F9682'],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AnimatePresence>
              {(isListening || isSpeaking) && (
                <CircularSpectrum isPlaying={isListening || isSpeaking} />
              )}
            </AnimatePresence>
            <div className="relative z-10 text-center bg-[#1A1A1F] px-6 py-3 rounded-2xl">
              <p className="text-sm">
                {isListening ? 'Parlez maintenant' : 'Appuyez ici pour parler'}
              </p>
            </div>
          </motion.div>
        </motion.button>
      </div>

      <div className="w-full max-w-md relative mb-2">
        <div className="relative flex items-center">
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              isAgent ? 'bg-[#4A5568]' : 'bg-[#2F9682]'
            }`}
            animate={{ backgroundColor: isAgent ? '#4A5568' : '#2F9682' }}
            transition={{ duration: 0.3 }}
          >
            {isAgent ? 'A' : 'C'}
          </motion.div>
          <motion.button
            className="ml-2 w-8 h-8 rounded-full bg-[#1A1A1F] border border-gray-800 flex items-center justify-center text-[#2F9682] hover:bg-[#2F9682] hover:text-white transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            whileTap={{ scale: 0.95 }}
          >
            <AnimatePresence mode="wait">
              {isMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 180, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={16} />
                </motion.div>
              ) : (
                <motion.div
                  key="open"
                  initial={{ rotate: 180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -180, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Plus size={16} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleUserInput(textInput);
                setTextInput('');
              }
            }}
            placeholder={`Message ${isAgent ? 'Agent' : 'Claudia'}`}
            className="flex-1 ml-2 px-4 py-2 rounded-full bg-[#1A1A1F] border border-gray-800 text-white placeholder-gray-500 focus:outline-none focus:border-[#2F9682]"
          />
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-full left-12 mb-2 w-48 rounded-lg bg-[#1A1A1F] border border-gray-800 shadow-lg overflow-hidden"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[#2F9682] transition-colors"
              >
                <Image size={16} />
                <span>Charger une image</span>
              </button>
              <button
                onClick={toggleAgent}
                className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[#2F9682] transition-colors"
              >
                <HeadsetIcon size={16} />
                <span>{isAgent ? 'Parler à Claudia' : 'Contacter un agent'}</span>
              </button>
              <button
                onClick={() => {
                  setIsHistoryOpen(true);
                  setIsMenuOpen(false);
                }}
                className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-[#2F9682] transition-colors"
              >
                <History size={16} />
                <span>Voir l'historique</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        messages={messages}
        onClear={handleClearHistory}
      />
    </div>
  );
}