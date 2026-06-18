'use client';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Rocket,
  TrendingUp,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { clearLenisDocumentState } from '@/app/components/landing/LenisScroll';

type Mode = 'login' | 'signup';

const FEATURE_CHIPS = [
  { id: 'launch', label: 'Launch ads faster', Icon: Rocket },
  { id: 'scale', label: 'Scale what converts', Icon: TrendingUp },
  { id: 'automate', label: 'Automate the boring stuff', Icon: Bot },
] as const;

const TICKER_SEGMENT = (
  <>
    ROBUST <span className="text-primary">✦</span> AD INTELLIGENCE
  </>
);

function AuthTicker() {
  const segment = (key: string) => (
    <span key={key} className="px-6">
      {TICKER_SEGMENT}
    </span>
  );

  return (
    <div className="relative overflow-hidden bg-foreground py-2.5">
      <div className="flex w-max animate-auth-ticker whitespace-nowrap font-ui text-[0.7rem] font-semibold tracking-[0.22em] text-background uppercase">
        {Array.from({ length: 8 }, (_, i) => segment(`a-${i}`))}
        <span aria-hidden className="flex">
          {Array.from({ length: 8 }, (_, i) => segment(`b-${i}`))}
        </span>
      </div>
    </div>
  );
}

function AuthMarketingPanel() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-10 xl:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 0% 0%, color-mix(in srgb, var(--primary) 10%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative z-10 flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <Image
            src={ROBUST_DNA.markLight}
            alt=""
            width={44}
            height={44}
            className="object-contain dark:hidden"
            priority
          />
          <Image
            src={ROBUST_DNA.markDark}
            alt=""
            width={44}
            height={44}
            className="hidden object-contain dark:block"
            priority
          />
        </div>
        <div>
          <div className="font-display text-[1.05rem] font-bold tracking-[-0.03em] text-foreground">
            Robust
          </div>
          <div className="font-ui text-[0.62rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Ad Intelligence Platform
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-10 max-w-xl">
        <p className="font-ui text-[0.68rem] font-bold tracking-[0.16em] text-primary uppercase">
          Built for Indian D2C brands
        </p>
        <h2 className="mt-4 font-display text-[clamp(1.85rem,3.2vw,2.65rem)] font-bold leading-[1.08] tracking-[-0.03em] text-foreground">
          Auto-pause losers.{' '}
          <span className="text-primary">Amplify winners.</span> Sleep well.
        </h2>
        <p className="mt-4 max-w-lg font-body text-[0.98rem] leading-relaxed text-muted-foreground">
          AI that watches your ads 24/7 and moves budget to what actually converts.
        </p>
      </div>

      <div className="relative z-10 mt-7 flex flex-wrap gap-2.5">
        {FEATURE_CHIPS.map(({ id, label, Icon }) => (
          <span
            key={id}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-[0.78rem] font-medium text-foreground shadow-sm"
          >
            <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
            {label}
          </span>
        ))}
      </div>

      <div className="relative z-10 mt-8 w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-28px_rgba(0,0,0,0.28)]">
          <Image
            src="/login/demo.png"
            alt="Robust dashboard preview"
            width={1200}
            height={760}
            className="h-auto w-full object-cover object-top"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export default function AuthPage({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [signupUserName, setSignupUserName] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [pendingToken, setPendingToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  useEffect(() => {
    clearLenisDocumentState();
  }, []);

  const toggleMode = () => {
    if (mode === 'login') {
      router.push('/signup');
      return;
    }
    router.push('/login');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password }),
        credentials: 'include',
      });
      const data = (await res.json()) as {
        error?: string;
        company?: { id: string };
        requires2fa?: boolean;
        pendingToken?: string;
        superadmin?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? 'Login failed');
        return;
      }
      if (data.superadmin) {
        setSuccess('Signed in as superadmin!');
        router.push('/superadmin/home');
        router.refresh();
        return;
      }
      if (data.requires2fa && data.pendingToken) {
        setPendingToken(data.pendingToken);
        setTwoFactorStep(true);
        setSuccess('Enter the code from your authenticator app.');
        return;
      }
      setSuccess('Signed in!');
      router.push('/home');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: totpCode }),
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Verification failed');
        return;
      }
      setSuccess('Signed in!');
      router.push('/home');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!name.trim() || !signupUserName.trim()) {
      setError('Please enter your company name and username.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (signupPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          userName: signupUserName,
          password: signupPassword,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string; company?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? 'Signup failed');
        return;
      }

      setSuccess('Account created! Signing you in…');
      const loginRes = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: signupUserName, password: signupPassword }),
        credentials: 'include',
      });
      const loginData = (await loginRes.json()) as { error?: string };
      if (!loginRes.ok) {
        setMode('login');
        setUserName(signupUserName);
        setError(loginData.error ?? 'Account created. Please log in.');
        return;
      }
      router.push('/home');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong, please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_12%,var(--border))] bg-background py-3 text-[0.9375rem] text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-muted-foreground transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/10';

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AuthTicker />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          className="relative hidden min-h-0 overflow-hidden bg-background lg:flex lg:w-1/2 lg:flex-col"
        >
          <AuthMarketingPanel />
        </motion.aside>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-muted/40 px-5 py-8 sm:px-8 lg:w-1/2 lg:px-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl">
              <Image
                src={ROBUST_DNA.markLight}
                alt=""
                width={40}
                height={40}
                className="object-contain dark:hidden"
              />
              <Image
                src={ROBUST_DNA.markDark}
                alt=""
                width={40}
                height={40}
                className="hidden object-contain dark:block"
              />
            </div>
            <div>
              <div className="font-display text-[1rem] font-bold tracking-[-0.03em]">Robust</div>
              <div className="font-ui text-[0.58rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Ad Intelligence Platform
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[420px]"
          >
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_10%,var(--border))] bg-card p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_32px_-12px_rgba(0,0,0,0.10)] sm:p-8">
              <h1 className="font-display text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                {mode === 'login'
                  ? twoFactorStep
                    ? 'Verify identity'
                    : 'Welcome back'
                  : 'Create workspace'}
              </h1>
              <p className="mt-2 font-body text-[0.875rem] leading-relaxed text-muted-foreground">
                {mode === 'login'
                  ? twoFactorStep
                    ? 'Enter the code from your authenticator app.'
                    : 'Sign in to your Robust workspace.'
                  : 'Set up your brand workspace and connect Meta in seconds.'}
              </p>

              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 font-ui text-[0.8125rem] text-red-600 dark:text-red-300"
                    role="alert"
                  >
                    {error}
                  </motion.div>
                ) : null}
                {success ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-5 rounded-xl border border-green-500/35 bg-green-500/10 px-4 py-3 font-ui text-[0.8125rem] text-green-700 dark:text-green-300"
                    role="status"
                  >
                    {success}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {mode === 'login' ? (
                  twoFactorStep ? (
                    <motion.form
                      key="2fa"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleTwoFactorVerify}
                      className="mt-6 space-y-4"
                    >
                      <div>
                        <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                          Authenticator code
                        </label>
                        <input
                          value={totpCode}
                          onChange={(e) =>
                            setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          placeholder="000000"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          required
                          maxLength={6}
                          className={`${inputClass} px-4 text-center tracking-[0.35em]`}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || totpCode.length !== 6}
                        className="mt-2 w-full rounded-xl bg-primary py-3.5 text-[0.9375rem] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Verifying…' : 'Verify & sign in'}
                      </button>
                      <button
                        type="button"
                        className="w-full text-center font-ui text-[0.8rem] text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setTwoFactorStep(false);
                          setPendingToken('');
                          setTotpCode('');
                          setError('');
                          setSuccess('');
                        }}
                      >
                        Back to sign in
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.2 }}
                      onSubmit={handleLogin}
                      className="mt-6 space-y-4"
                    >
                      <div>
                        <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                          Workspace username
                        </label>
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="your-brand"
                            autoComplete="username"
                            required
                            className={`${inputClass} pl-10`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                            className={`${inputClass} pr-11 pl-4`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="mt-2 w-full rounded-xl bg-primary py-3.5 text-[0.9375rem] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? 'Signing in…' : 'Sign in'}
                      </button>
                    </motion.form>
                  )
                ) : (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    onSubmit={handleSignup}
                    className="mt-6 space-y-4"
                  >
                    {[
                      {
                        label: 'Brand / company name',
                        value: name,
                        setter: setName,
                        placeholder: 'Acme Inc.',
                        type: 'text',
                        auto: undefined,
                      },
                      {
                        label: 'Workspace username',
                        value: signupUserName,
                        setter: setSignupUserName,
                        placeholder: 'acme',
                        type: 'text',
                        auto: 'username',
                      },
                      {
                        label: 'Work email (optional)',
                        value: email,
                        setter: setEmail,
                        placeholder: 'team@acme.com',
                        type: 'email',
                        auto: undefined,
                        required: false,
                      },
                    ].map(({ label, value, setter, placeholder, type, auto, required: req = true }) => (
                      <div key={label}>
                        <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                          {label}
                        </label>
                        <input
                          type={type}
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          placeholder={placeholder}
                          autoComplete={auto}
                          required={req}
                          className={`${inputClass} px-4`}
                        />
                      </div>
                    ))}
                    <div>
                      <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          minLength={8}
                          className={`${inputClass} pr-11 pl-4`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((v) => !v)}
                          className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        >
                          {showSignupPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block font-ui text-[0.78rem] font-medium text-muted-foreground">
                        Confirm password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        className={`${inputClass} px-4`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-2 w-full rounded-xl bg-primary py-3.5 text-[0.9375rem] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Creating…' : 'Create workspace'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="mt-6 text-center font-body text-[0.875rem] text-muted-foreground">
                {mode === 'login' ? (
                  <>
                    Don&apos;t have a workspace?{' '}
                    <Link
                      href="/signup"
                      className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Sign up free
                    </Link>
                  </>
                ) : (
                  <>
                    Already have a workspace?{' '}
                    <button
                      type="button"
                      onClick={toggleMode}
                      className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Log in
                    </button>
                  </>
                )}
              </p>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2 font-ui text-[0.78rem] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>Secure login</span>
              </div>
              <p className="font-ui text-[0.72rem] text-muted-foreground/80">
                Your data is encrypted and protected
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
