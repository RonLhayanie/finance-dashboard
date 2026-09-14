import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { sendChat } from '../api/client';
import { useChatContext } from '../context/ChatContext';

const SUGGESTIONS = [
  'נתח את ההוצאות האחרונות שלי',
  'האם יש לי חריגות או חיובים כפולים החודש?',
  'על אילו קטגוריות הוצאתי הכי הרבה?',
  'כמה הוצאתי החודש לעומת החודש שעבר?',
  'מה המנויים הפעילים שלי?',
  'פרט לי על החריגות שלי',
  'איפה אני יכול לחסוך הכי הרבה?',
  'מה הקטגוריה הכי יקרה שלי?',
];

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function SparklesIcon(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z" />
    </svg>
  );
}

function PlusIcon(props) {
  return (
    <svg {...ICON_PROPS} width={14} height={14} {...props}>
      <path d="M12 5l0 14" />
      <path d="M5 12l14 0" />
    </svg>
  );
}

const MARKDOWN_COMPONENTS = {
  h1: (props) => (
    <h3 className="mb-2 border-b border-[var(--color-border)] pb-1 text-base font-bold text-[var(--color-text)]" {...props} />
  ),
  h2: (props) => (
    <h3 className="mb-2 border-b border-[var(--color-border)] pb-1 text-base font-bold text-[var(--color-text)]" {...props} />
  ),
  h3: (props) => (
    <h4 className="mb-2 border-b border-[var(--color-border)] pb-1 text-sm font-bold text-[var(--color-text)]" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-[var(--color-text)]" {...props} />,
  p: (props) => <p className="mb-2 text-sm leading-relaxed last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-2 list-inside list-disc space-y-1 text-sm last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-2 list-inside list-decimal space-y-1 text-sm last:mb-0" {...props} />,
  li: (props) => <li className="text-sm" {...props} />,
};

export default function ChatWidget() {
  const { messages, setMessages, clearChat, pendingPrompt, consumePendingPrompt } = useChatContext();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  // Prefill (not auto-send) from a dashboard shortcut, once on mount.
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      consumePendingPrompt();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleNewChat() {
    clearChat();
    setInput('');
    setError('');
  }

  return (
    <div
      className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl border"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          <PlusIcon />
          שיחה חדשה
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <SparklesIcon width={28} height={28} style={{ color: 'var(--color-accent)' }} />
            <p className="mt-3 text-lg font-semibold text-[var(--color-text)]">שלום, אני היועץ הפיננסי שלך</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">מה תרצה שאבדוק עבורך היום?</p>
          </div>
        ) : (
          messages.map((m, i) => (
            // Own messages stay on the physical right (matches common Hebrew chat
            // UI convention), so "user" maps to justify-start: in RTL, the flex
            // main-axis start is the right edge.
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
              <div
                dir="rtl"
                className={`max-w-[75%] rounded-xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'whitespace-pre-wrap text-sm text-white'
                    : 'text-[var(--color-text)]'
                }`}
                style={{ backgroundColor: m.role === 'user' ? 'var(--color-accent)' : 'var(--color-surface-2)' }}
              >
                {m.role === 'assistant' ? (
                  <ReactMarkdown components={MARKDOWN_COMPONENTS}>{m.content}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}
        {pending && <p className="text-sm text-[var(--color-text-muted)]">חושב...</p>}
        {error && <p className="text-sm text-[var(--color-expense)]">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-wrap gap-2 border-t px-3 pt-3" style={{ borderColor: 'var(--color-border)' }}>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => sendMessage(suggestion)}
            disabled={pending}
            className="rounded-full border px-3 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
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
          className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
          style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}
        />
        <button
          onClick={() => sendMessage(input.trim())}
          disabled={pending || !input.trim()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          שליחה
        </button>
      </div>
    </div>
  );
}
