import { createContext, useContext, useState, useCallback } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [pendingPrompt, setPendingPrompt] = useState('');

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  const consumePendingPrompt = useCallback(() => {
    setPendingPrompt('');
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, setMessages, clearChat, pendingPrompt, setPendingPrompt, consumePendingPrompt }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return ctx;
}
