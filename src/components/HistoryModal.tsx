import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../lib/cache';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onClear: () => void;
}

export default function HistoryModal({ isOpen, onClose, messages, onClear }: HistoryModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#1A1A1F] w-full max-w-lg rounded-lg shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Historique des conversations</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClear}
                  className="p-2 hover:bg-red-500/10 rounded-full text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Aucun message dans l'historique</p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-[#2F9682] text-white'
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(message.timestamp).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}