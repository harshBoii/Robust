'use client';

import { ROBUST_DNA } from '@/lib/brand/robust-dna';
import type { OnboardingCompanySnapshot, OnboardingStep, StartupPlan } from '@/lib/onboarding/types';
import { ONBOARDING_STEPS } from '@/lib/onboarding/types';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  Rocket,
  Search,
  Share2,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

import { clearLenisDocumentState } from '@/app/components/landing/LenisScroll';
import { OnboardingStepBar } from '@/app/components/onboarding/OnboardingStepBar';

const inputClass =
  'w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_12%,var(--border))] bg-background px-4 py-3 text-[0.9375rem] text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] placeholder:text-muted-foreground transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/10';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function approachLabel(a: StartupPlan['recommendedApproach']) {
  if (a === 'aeo_first') return 'Prioritize AEO';
  if (a === 'ads_first') return 'Prioritize Ads';
  return 'Balanced approach';
}

export default function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [company, setCompany] = useState<OnboardingCompanySnapshot | null>(null);
  const [plan, setPlan] = useState<StartupPlan | null>(null);
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [canonicalName, setCanonicalName] = useState('');
  const [industry, setIndustry] = useState('');
  const [oneLiner, setOneLiner] = useState('');
  const [category, setCategory] = useState('');
  const [businessModel, setBusinessModel] = useState('');
  const [primaryAudience, setPrimaryAudience] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [metaConnected, setMetaConnected] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState(false);

  const stepIndex = ONBOARDING_STEPS.indexOf(step);

  const syncStep = useCallback(async (next: OnboardingStep) => {
    setStep(next);
    if (company?.id) {
      await apiJson('/api/onboarding/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStep: next }),
      }).catch(() => undefined);
    }
  }, [company?.id]);

  const applyCompany = useCallback((snap: OnboardingCompanySnapshot) => {
    setCompany(snap);
    if (snap.brand) {
      setCanonicalName(snap.brand.canonicalName);
      setIndustry(snap.brand.industry ?? '');
      setOneLiner(snap.brand.oneLiner ?? '');
      setCategory(snap.brand.category ?? '');
      setBusinessModel(snap.brand.businessModel ?? '');
      setPrimaryAudience(snap.brand.targetAudiences[0] ?? '');
    }
    setMetaConnected(snap.integrations.metaConnected);
    setShopifyConnected(snap.integrations.shopifyConnected);
    if (snap.onboardingPlan) {
      setPlan(snap.onboardingPlan);
      setPlanStatus('ready');
    }
    if (snap.accessRequestedAt) {
      setStep('done');
    } else if (
      snap.onboardingStep &&
      ONBOARDING_STEPS.includes(snap.onboardingStep as OnboardingStep)
    ) {
      setStep(snap.onboardingStep as OnboardingStep);
    }
  }, []);

  useEffect(() => {
    clearLenisDocumentState();
    apiJson<{ company: OnboardingCompanySnapshot }>('/api/onboarding/company')
      .then(({ company: snap }) => applyCompany(snap))
      .catch(() => undefined);
  }, [applyCompany]);

  useEffect(() => {
    if (!searchParams) return;
    const urlStep = searchParams.get('step') as OnboardingStep | null;
    const status = searchParams.get('status');
    if (!urlStep || !ONBOARDING_STEPS.includes(urlStep)) return;

    if (urlStep === 'facebook') {
      if (status === 'connected') setMetaConnected(true);
      syncStep('facebook');
      router.replace('/signup');
    }
    if (urlStep === 'shopify') {
      if (status === 'connected') setShopifyConnected(true);
      syncStep('shopify');
      router.replace('/signup');
    }
  }, [searchParams, router, syncStep]);

  const next = useCallback(() => {
    setError('');
    const nextStep = ONBOARDING_STEPS[Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1)];
    void syncStep(nextStep);
  }, [stepIndex, syncStep]);

  const prev = useCallback(() => {
    setError('');
    const prevStep = ONBOARDING_STEPS[Math.max(0, stepIndex - 1)];
    void syncStep(prevStep);
  }, [stepIndex, syncStep]);

  const runEnrichment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<{
        company: OnboardingCompanySnapshot;
        seedOk: boolean;
        seedError: string | null;
      }>('/api/onboarding/seed', { method: 'POST' });
      applyCompany(data.company);
      if (!data.seedOk && data.seedError) {
        setError(`Auto-fill partially failed: ${data.seedError}. You can edit brand details manually.`);
      }
      await syncStep('brand-basics');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrichment failed');
      await syncStep('brand-basics');
    } finally {
      setLoading(false);
    }
  }, [applyCompany, syncStep]);

  useEffect(() => {
    if (step === 'enriching' && company && !loading) {
      void runEnrichment();
    }
  }, [step, company, loading, runEnrichment]);

  const saveBrandBasics = async () => {
    setLoading(true);
    setError('');
    try {
      const { company: snap } = await apiJson<{ company: OnboardingCompanySnapshot }>(
        '/api/onboarding/company',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canonicalName, industry, oneLiner }),
        },
      );
      applyCompany(snap);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const saveBrandAudience = async () => {
    setLoading(true);
    setError('');
    try {
      const { company: snap } = await apiJson<{ company: OnboardingCompanySnapshot }>(
        '/api/onboarding/company',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, businessModel, primaryAudience }),
        },
      );
      applyCompany(snap);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = useCallback(async () => {
    setPlanStatus('loading');
    setLoading(true);
    setError('');
    try {
      const data = await apiJson<{ plan: StartupPlan; company: OnboardingCompanySnapshot }>(
        '/api/onboarding/plan',
        { method: 'POST' },
      );
      setPlan(data.plan);
      setPlanStatus('ready');
      applyCompany(data.company);
    } catch (e) {
      setPlanStatus('error');
      setError(e instanceof Error ? e.message : 'Could not generate plan');
    } finally {
      setLoading(false);
    }
  }, [applyCompany]);

  useEffect(() => {
    if (step === 'your-plan' && planStatus === 'idle') {
      void generatePlan();
    }
  }, [step, planStatus, generatePlan]);

  const createCompany = async () => {
    setLoading(true);
    setError('');
    try {
      const { company: snap } = await apiJson<{ company: OnboardingCompanySnapshot }>(
        '/api/onboarding/company',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, domain }),
        },
      );
      setCompany(snap);
      setName(snap.name);
      setDomain(snap.domain ?? domain);
      await syncStep('enriching');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create company');
    } finally {
      setLoading(false);
    }
  };

  const submitAccess = async () => {
    setLoading(true);
    setError('');
    try {
      await apiJson('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, email, password, confirmPassword }),
      });
      await syncStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  const shopifyInstallHref = useMemo(() => {
    const shop = shopDomain.trim();
    if (!shop) return '#';
    return `/shopify/install?shop=${encodeURIComponent(shop)}&onboarding=1`;
  }, [shopDomain]);

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="space-y-6">
            <div>
              <p className="font-ui text-xs font-bold tracking-[0.16em] text-primary uppercase">
                Welcome to Robust
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-foreground">
                Let&apos;s set up your brand in a few guided steps
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                We&apos;ll learn your company from your domain, optionally connect Facebook and
                Shopify, build your brand DNA, and recommend whether to lead with AEO or paid ads.
                At the end you&apos;ll request access — an admin approves before you can log in.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><Rocket className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Auto-pause losing ads, amplify winners</li>
              <li className="flex gap-2"><Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Win LLM citations with GEO/AEO bounties</li>
              <li className="flex gap-2"><Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> AI creative + publishing across channels</li>
            </ul>
          </div>
        );

      case 'company':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Your company</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We use your domain to auto-fill brand profile and DNA.
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Company name</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme D2C" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Company domain</span>
              <input className={inputClass} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
            </label>
          </div>
        );

      case 'enriching':
        return (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Building your brand profile</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Crawling {domain || company?.domain || 'your site'} and generating brand DNA…
              </p>
            </div>
          </div>
        );

      case 'brand-basics':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Confirm brand basics</h2>
              <p className="mt-1 text-sm text-muted-foreground">Auto-filled from your domain — edit if needed.</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Brand name</span>
              <input className={inputClass} value={canonicalName} onChange={(e) => setCanonicalName(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Industry</span>
              <input className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">One-liner</span>
              <input className={inputClass} value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} />
            </label>
          </div>
        );

      case 'brand-audience':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Audience & model</h2>
              <p className="mt-1 text-sm text-muted-foreground">Helps us tailor ads and AEO strategy.</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Category</span>
              <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Business model</span>
              <input className={inputClass} value={businessModel} onChange={(e) => setBusinessModel(e.target.value)} placeholder="D2C, SaaS, marketplace…" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Primary audience</span>
              <input className={inputClass} value={primaryAudience} onChange={(e) => setPrimaryAudience(e.target.value)} />
            </label>
          </div>
        );

      case 'facebook':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Connect Facebook Ads</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional — unlocks ad automation and richer personalized recommendations.
              </p>
            </div>
            {metaConnected ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-5 w-5" /> Facebook connected
              </div>
            ) : (
              <a
                href="/api/auth/meta/start?onboarding=1"
                className="glass-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium"
              >
                <Share2 className="h-4 w-4" /> Connect with Facebook
              </a>
            )}
          </div>
        );

      case 'shopify':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Connect Shopify</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional — sync products and publish AEO content to your store blog.
              </p>
            </div>
            {shopifyConnected ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
                <CheckCircle2 className="h-5 w-5" /> Shopify connected
              </div>
            ) : (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Shop domain</span>
                  <input
                    className={inputClass}
                    value={shopDomain}
                    onChange={(e) => setShopDomain(e.target.value)}
                    placeholder="your-store.myshopify.com"
                  />
                </label>
                <a
                  href={shopifyInstallHref}
                  className={`glass-button inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium ${!shopDomain.trim() ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <ShoppingBag className="h-4 w-4" /> Connect Shopify
                </a>
              </>
            )}
          </div>
        );

      case 'guide-ads':
        return (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-foreground">Ads automation</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Robust watches your Meta campaigns 24/7. When cost-per-install or CTR drifts, we pause
              fatigued ads and surface winners to scale — so budget flows to what converts.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium text-foreground">Best when you have</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Existing Meta spend or clear product-market fit</li>
                <li>Creative assets to test at scale</li>
                <li>Short sales cycles (D2C, apps)</li>
              </ul>
            </div>
          </div>
        );

      case 'guide-aeo':
        return (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold text-foreground">AEO & GEO</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Answer Engine Optimization helps your brand get cited when buyers ask ChatGPT, Perplexity,
              or Google AI Overviews. Robust runs citation bounties, generates multi-platform content,
              and tracks share-of-voice vs rivals.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="font-medium text-foreground">Best when you need</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Long consideration cycles or education-heavy categories</li>
                <li>Organic trust before scaling paid</li>
                <li>Category queries where LLMs recommend vendors</li>
              </ul>
            </div>
          </div>
        );

      case 'your-plan':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Your personalized plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on your brand, integrations, and industry research.
              </p>
            </div>
            {planStatus === 'loading' || (planStatus === 'idle' && !plan) ? (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Generating your strategy…
              </div>
            ) : planStatus === 'error' && !plan ? (
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t generate a personalized plan right now. You can retry or continue
                  with a general recommendation.
                </p>
                <button
                  type="button"
                  onClick={() => void generatePlan()}
                  className="glass-button px-4 py-2 text-sm"
                >
                  Retry
                </button>
              </div>
            ) : plan ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <span className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {approachLabel(plan.recommendedApproach)}
                  </span>
                  <p className="mt-3 font-medium text-foreground">{plan.headline}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {plan.rationale.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                {plan.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evidence</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {plan.evidence.map((ev) => (
                        <li key={ev.claim} className="rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground">
                          &ldquo;{ev.claim}&rdquo;
                          {ev.source ? <span className="mt-1 block text-xs text-primary">{ev.source}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">First week</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {plan.firstWeekActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        );

      case 'request-access':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Request access</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your login — an admin will approve before you can sign in.
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Username</span>
              <input className={inputClass} value={userName} onChange={(e) => setUserName(e.target.value)} autoComplete="username" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Email</span>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
          </div>
        );

      case 'request-password':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Set password</h2>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Password</span>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Confirm password</span>
              <input className={inputClass} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </label>
          </div>
        );

      case 'done':
        return (
          <div className="space-y-6 py-4 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Request submitted</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll review your application shortly. You&apos;ll be able to log in once approved.
              </p>
            </div>
            <Link href="/login" className="glass-button-primary inline-flex px-6 py-2.5 text-sm font-medium">
              Back to login
            </Link>
          </div>
        );

      default:
        return null;
    }
  };

  const handlePrimary = async () => {
    setError('');
    if (step === 'welcome') return next();
    if (step === 'company') {
      if (!name.trim() || !domain.trim()) {
        setError('Company name and domain are required.');
        return;
      }
      return createCompany();
    }
    if (step === 'brand-basics') return saveBrandBasics();
    if (step === 'brand-audience') return saveBrandAudience();
    if (step === 'facebook' || step === 'shopify' || step === 'guide-ads' || step === 'guide-aeo') return next();
    if (step === 'your-plan') return next();
    if (step === 'request-access') {
      if (!userName.trim() || !email.trim()) {
        setError('Username and email are required.');
        return;
      }
      return syncStep('request-password');
    }
    if (step === 'request-password') return submitAccess();
  };

  const showNav = step !== 'done' && step !== 'enriching';

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="relative hidden w-[42%] border-r border-border bg-card lg:flex lg:flex-col">
        <div className="flex flex-1 flex-col justify-between px-10 py-10">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl">
              <Image src={ROBUST_DNA.markLight} alt="" width={44} height={44} className="object-contain dark:hidden" priority />
              <Image src={ROBUST_DNA.markDark} alt="" width={44} height={44} className="hidden object-contain dark:block" priority />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Robust</div>
              <div className="text-xs text-muted-foreground">Onboarding</div>
            </div>
          </div>
          <div className="max-w-md space-y-4">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">
              Grow with <span className="text-primary">ads + AEO</span> in one place
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We learn your brand upfront so automation and citations hit the ground running.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { Icon: Building2, label: 'Brand DNA' },
                { Icon: TrendingUp, label: 'Meta ads' },
                { Icon: Globe, label: 'AEO bounties' },
              ].map(({ Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
                  <Icon className="h-3.5 w-3.5 text-primary" /> {label}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Already have access?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-b border-border px-6 py-4 lg:px-10">
          <OnboardingStepBar current={step} />
        </div>
        <div className="flex flex-1 flex-col justify-between px-6 py-8 lg:px-10">
          <div className="mx-auto w-full max-w-lg">{renderStep()}</div>
          {error ? (
            <p className="mx-auto mt-4 w-full max-w-lg text-sm text-destructive">{error}</p>
          ) : null}
          {showNav && (
            <div className="mx-auto mt-8 flex w-full max-w-lg items-center justify-between gap-3">
              <button
                type="button"
                onClick={prev}
                disabled={step === 'welcome' || loading}
                className="glass-button px-5 py-2.5 text-sm disabled:opacity-40"
              >
                Back
              </button>
              <div className="flex items-center gap-2">
                {(step === 'facebook' || step === 'shopify') && (
                  <button type="button" onClick={next} className="glass-button px-5 py-2.5 text-sm">
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handlePrimary()}
                  disabled={loading}
                  className="glass-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {step === 'request-password' ? 'Submit request' : 'Continue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
