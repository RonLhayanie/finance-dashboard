import { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api/client';

const SUGGESTIONS = [
  'נתח את ההוצאות האחרונות שלי',
  'האם יש לי חריגות או חיובים כפולים החודש?',
  'על אילו קטגוריות הוצאתי הכי הרבה?',
];

export default function ChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function sendMessage(text) {
    if (!text || pending) return;

    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setPending(true);
    setError('');

    try {
      const { reply } = await sendChat(nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.trim());
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-700/50 bg-slate-800 shadow-lg">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          // Own messages stay on the physical right (matches common Hebrew chat
          // UI convention), so "user" maps to justify-start: in RTL, the flex
          // main-axis start is the right edge.
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[75%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {pending && <p className="text-sm text-slate-400">חושב...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-700 px-3 pt-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => sendMessage(suggestion)}
            disabled={pending}
            className="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-emerald-500 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="flex gap-2 p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="שאל על ההוצאות שלך... (Enter לשליחה, Shift+Enter לשורה חדשה)"
          className="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => sendMessage(input.trim())}
          disabled={pending || !input.trim()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          שליחה
        </button>
      </div>
    </div>
  );
}
