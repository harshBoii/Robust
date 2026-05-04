'use client';


import CurvedLoop from '@/app/components/animations/curvedLoop';
import LoginBottomAnimation from '@/app/components/animations/loginBottomLeft';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';


type Mode = 'login' | 'signup';


const LOGIN_LEFT_SLOGANS = [
  'Launch Meta ads in minutes, not hours.',
  'Auto-pause losers. Amplify winners. Sleep well.',
  'Your creative gallery, your ad pipeline — one workspace.',
] as const;


const PILL_BADGES: { id: string; segments: { text: string; accent?: boolean }[] }[] = [
  { id: 'launch',  segments: [{ text: 'Launch ',  accent: true }, { text: 'Ads Faster'      }] },
  { id: 'scale',   segments: [{ text: 'Scale ',   accent: true }, { text: 'What Converts'   }] },
  { id: 'automate',segments: [{ text: 'Automate ',accent: true }, { text: 'the Boring Stuff' }] },
];


/** Primary CTA */
const AUTH_SUBMIT_CLASS =
  'glass-button-primary relative mt-6 w-full overflow-hidden rounded-xl py-3.5 text-[0.9375rem] font-semibold tracking-wide text-primary-foreground shadow-[var(--glass-shadow)] [text-shadow:0_1px_2px_rgba(0,0,0,0.14)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100';


/** Inputs */
const inputClass =
  'glass-input w-full rounded-xl border-[var(--glass-border)] px-4 py-3 text-[0.9375rem] text-foreground placeholder:text-muted-foreground transition-all';


export default function AuthPage({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);


  const [userName,        setUserName]        = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [signupUserName,  setSignupUserName]  = useState('');
  const [email,           setEmail]           = useState('');
  const [signupPassword,  setSignupPassword]  = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');


  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError('');
    setSuccess('');
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, password }),
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string; company?: { id: string } };
      if (!res.ok) { setError(data.error ?? 'Login failed'); return; }
      setSuccess('Signed in!');
      router.push('/home'); router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong, please try again.');
    } finally { setLoading(false); }
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!name.trim() || !signupUserName.trim()) {
      setError('Please enter your company name and username.'); return;
    }
    if (signupPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (signupPassword.length < 8) { setError('Password must be at least 8 characters long.'); return; }


    setLoading(true);
    try {
      const res  = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, userName: signupUserName, password: signupPassword,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
        credentials: 'include',
      });
      const data = (await res.json()) as { error?: string; company?: { id: string } };
      if (!res.ok) { setError(data.error ?? 'Signup failed'); return; }


      setSuccess('Account created! Signing you in…');
      const loginRes  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: signupUserName, password: signupPassword }),
        credentials: 'include',
      });
      const loginData = (await loginRes.json()) as { error?: string };
      if (!loginRes.ok) {
        setMode('login'); setUserName(signupUserName);
        setError(loginData.error ?? 'Account created. Please log in.'); return;
      }
      router.push('/home'); router.refresh();
    } catch (err) {
      console.error(err);
      setError('Something went wrong, please try again.');
    } finally { setLoading(false); }
  };


  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground lg:flex-row">


      {/* ── LEFT PANEL ── */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
        className="relative hidden w-full overflow-hidden bg-background lg:grid lg:h-screen lg:w-1/2"
      >
        {/* Ambient gradient */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `
              radial-gradient(ellipse 120% 80% at 0% 0%,  color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 55%),
              radial-gradient(ellipse 90%  60% at 100% 20%, color-mix(in srgb, var(--clipfox-accent) 6%, transparent) 0%, transparent 50%)
            `,
          }}
          aria-hidden
        />


        <div className="relative z-[1] grid h-full min-h-0 grid-rows-[60%_40%]">
          <div className="relative flex min-h-0 flex-col overflow-hidden px-10 pt-10 mt-30">


            {/* Dot-grid texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
              style={{
                backgroundImage: 'radial-gradient(circle, var(--foreground) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
              }}
              aria-hidden
            />


            {/* Brand lockup */}
            <div>
            <div className="relative z-10 flex items-center gap-4 text-center justify-center align-middle w-full ">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden  rounded-2xl">
                <Image
                  src="/mascot/Robust.png" alt="Robust Logo"
                  width={76} height={76}
                  className="object-contain p-1 dark:invert"
                  priority
                />
              </div>
              <div>
                <div className="font-display text-[1.125rem] font-bold tracking-[-0.03em] text-foreground ">
                  Robust
                </div>
                <div className="mt-0.5 font-ui text-[0.65rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase ">
                  Ad Intelligence Platform
                </div>
              </div>
            </div>
            </div>


            {/* Slogans */}
            <div className="relative z-10 mt-10 flex flex-col gap-5 text-center">
              {LOGIN_LEFT_SLOGANS.map((line, i) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 * i, duration: 0.55 }}
                  className="font-body text-[1.05rem] font-medium leading-[1.5] tracking-[-0.01em] text-foreground/80"
                >
                  {line}
                </motion.p>
              ))}
            </div>


            {/* Pill badges */}
            <div className="">
              <div className="relative z-10 mt-8 flex flex-wrap items-center gap-2 align-middle text-center items-center justify-center">
                {PILL_BADGES.map((badge) => (
                  <span
                    key={badge.id}
                    className="glass-badge inline-flex items-center gap-0.5 px-3.5 py-1.5 shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] backdrop-saturate-[180%]"
                  >
                    {badge.segments.map((seg, i) => (
                      <span
                        key={`${badge.id}-${i}`}
                        className={seg.accent ? 'text-primary' : undefined}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>


          {/* Bottom animation */}
          <div className="relative min-h-0 overflow-hidden p-3 sm:p-4">
            <LoginBottomAnimation />
          </div>
        </div>
      </motion.div>


      {/* ── RIGHT PANEL — Auth card ── */}
      <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 p-6 sm:p-8 md:p-12 lg:w-1/2">
        <CurvedLoop
          marqueeText="ROBUST ✦ AD INTELLIGENCE"
          speed={3} curveAmount={420} direction="right"
          className="-mt-20"
        />


        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="glass-card w-full max-w-md p-8 md:p-10"
        >


          {/* Title */}
          <motion.h1
            key={mode}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="mb-2 text-center font-display text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.035em] text-foreground md:text-[2.125rem]"
          >
            <span className="text-primary">
              {mode === 'login' ? 'Welcome' : 'Create'}
            </span>{' '}
            <span className="text-foreground">
              {mode === 'login' ? 'Back' : 'Account'}
            </span>
          </motion.h1>


          {/* Subtitle */}
          <p className="mb-6 text-center font-body text-[0.875rem] leading-relaxed text-muted-foreground">
            {mode === 'login'
              ? 'Sign in to your Robust workspace.'
              : 'Set up your brand workspace and connect Meta in seconds.'}
          </p>


          {/* Error / Success banners */}
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-ui text-[0.8125rem] leading-snug text-destructive"
              >
                {error}
              </motion.div>
            ) : null}
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="mb-4 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 font-ui text-[0.8125rem] leading-snug text-primary"
              >
                {success}
              </motion.div>
            ) : null}
          </AnimatePresence>


          {/* Forms */}
          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1.5 block font-ui text-[0.8rem] font-medium tracking-wide text-muted-foreground">
                    Workspace username
                  </label>
                  <input
                    value={userName} onChange={(e) => setUserName(e.target.value)}
                    placeholder="your-brand"
                    autoComplete="username" required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-ui text-[0.8rem] font-medium tracking-wide text-muted-foreground">
                    Password
                  </label>
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password" required
                    className={inputClass}
                  />
                </div>
                <motion.button
                  type="submit" disabled={loading}
                  whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                  className={AUTH_SUBMIT_CLASS}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                {[
                  { label: 'Brand / company name', value: name,            setter: setName,            placeholder: 'Acme Inc.',       type: 'text',     auto: undefined },
                  { label: 'Workspace username',   value: signupUserName,  setter: setSignupUserName,  placeholder: 'acme',            type: 'text',     auto: 'username' },
                  { label: 'Work email (optional)',value: email,           setter: setEmail,           placeholder: 'team@acme.com',   type: 'email',    auto: undefined,  required: false },
                  { label: 'Password',             value: signupPassword,  setter: setSignupPassword,  placeholder: '••••••••',        type: 'password', auto: undefined,  min: 8 },
                  { label: 'Confirm password',     value: confirmPassword, setter: setConfirmPassword, placeholder: '••••••••',        type: 'password', auto: undefined,  min: 8 },
                ].map(({ label, value, setter, placeholder, type, auto, required: req = true, min }) => (
                  <div key={label}>
                    <label className="mb-1.5 block font-ui text-[0.8rem] font-medium tracking-wide text-muted-foreground">
                      {label}
                    </label>
                    <input
                      type={type} value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      autoComplete={auto} required={req}
                      minLength={min}
                      className={inputClass}
                    />
                  </div>
                ))}
                <motion.button
                  type="submit" disabled={loading}
                  whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                  className={AUTH_SUBMIT_CLASS}
                >
                  {loading ? 'Creating…' : 'Create workspace'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>


          {/* Mode toggle */}
          <motion.p
            className="mt-6 text-center font-body text-[0.875rem] text-muted-foreground"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          >
            {mode === 'login' ? (
              <>
                Don&apos;t have a workspace?{' '}
                <Link href="/signup" className="font-ui font-semibold text-primary underline-offset-4 hover:underline">
                  Sign up free
                </Link>
              </>
            ) : (
              <>
                Already have a workspace?{' '}
                <button type="button" onClick={toggleMode} className="font-ui font-semibold text-primary underline-offset-4 hover:underline">
                  Log in
                </button>
              </>
            )}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}