import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ledgerlyLogo from '../assets/logo/ledgerly-logo-dark-bg.svg';

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

function EyeIcon(props) {
  return (
    <svg {...ICON_PROPS} width={16} height={16} {...props}>
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
      <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </svg>
  );
}

function EyeOffIcon(props) {
  return (
    <svg {...ICON_PROPS} width={16} height={16} {...props}>
      <path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" />
      <path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

const PARTICLE_COUNT = 50;
const CONNECT_DISTANCE = 140;
// Canvas fillStyle/strokeStyle can't read CSS custom properties directly, so
// these are --color-accent (#7f77dd) written out as an rgb triplet, with the
// line's peak opacity (0.32) fading to 0 as two nodes approach CONNECT_DISTANCE.
const NODE_COLOR = '#7f77dd';
const LINE_PEAK_OPACITY = 0.32;
const lineColor = (alpha) => `rgba(127, 119, 221, ${alpha})`;

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// Calm, low-key "particle network" drifting behind the login card - ties to
// the brand's neural/brain identity without competing with the form.
function NeuralBackground() {
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId = null;
    let running = true;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function initParticles() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!reducedMotion) {
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
          if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        }
      }

      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < CONNECT_DISTANCE) {
            ctx.strokeStyle = lineColor(LINE_PEAK_OPACITY * (1 - dist / CONNECT_DISTANCE));
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      ctx.fillStyle = NODE_COLOR;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      if (!running) return;
      draw();
      if (!reducedMotion) {
        animationId = requestAnimationFrame(loop);
      }
    }

    function handleResize() {
      resize();
      if (reducedMotion) draw();
    }

    function handleVisibility() {
      if (document.hidden) {
        running = false;
        if (animationId) cancelAnimationFrame(animationId);
      } else if (!reducedMotion) {
        running = true;
        loop();
      }
    }

    resize();
    initParticles();
    loop();

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      running = false;
      if (animationId) cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" aria-hidden="true" />;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    if (!username || !password || pending) return;
    setError('');
    setPending(true);
    try {
      await login(username, password);
      setPassword('');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-bg)] px-4">
      <NeuralBackground />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(127,119,221,0.25) 0%, rgba(127,119,221,0) 70%)' }}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-surface)]/72 p-8 shadow-2xl backdrop-blur-2xl"
      >
        <div className="mb-8 text-center">
          <img src={ledgerlyLogo} alt="Ledgerly" className="mx-auto w-72 h-auto" />
          <p className="mt-1 text-base text-[var(--color-text-muted)]">
            הכספים שלך, <span className="font-semibold text-[var(--color-accent)]">חכמים</span> יותר.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
              שם משתמש
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-[var(--color-text-muted)]">
              סיסמה
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 pl-9 text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && <div className="text-sm text-[var(--color-expense)]">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={pending || !username || !password}
            className="w-full cursor-pointer rounded-lg bg-[var(--color-accent)] py-2 font-medium text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'מתחבר...' : 'התחברות'}
          </button>
        </div>
      </div>
    </div>
  );
}
