'use client';

import type {
  DomainPreviewResult,
  OnboardingCompanySnapshot,
  OnboardingStep,
  StartupPlan,
} from '@/lib/onboarding/types';
import { ONBOARDING_STEPS } from '@/lib/onboarding/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Share2, ShoppingBag, Sparkles } from 'lucide-react';

import { clearLenisDocumentState } from '@/app/components/landing/LenisScroll';
import { OnboardingBrandPreview } from '@/app/components/onboarding/OnboardingBrandPreview';
import { OnboardingPhaseBar } from '@/app/components/onboarding/OnboardingPhaseBar';
import { OnboardingWelcomePanel } from '@/app/components/onboarding/OnboardingWelcomePanel';

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

  const [domainPreview, setDomainPreview] = useState<DomainPreviewResult | null>(null);
  const [domainPreviewLoading, setDomainPreviewLoading] = useState(false);
  const lastPreviewedDomain = useRef('');

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

  const checkDomainPreview = useCallback(async (rawDomain: string) => {
    const trimmed = rawDomain.trim();
    if (!trimmed || trimmed === lastPreviewedDomain.current) return;

    lastPreviewedDomain.current = trimmed;
    setDomainPreviewLoading(true);
    try {
      const data = await apiJson<{ preview: DomainPreviewResult }>('/api/onboarding/domain-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed }),
      });
      setDomainPreview(data.preview);
    } catch {
      setDomainPreview({
        ok: false,
        domain: trimmed,
        website: '',
        title: null,
        productLinkCount: 0,
        colorCount: 0,
        isShopify: false,
        message: 'Could not verify domain right now. Try again in a moment.',
      });
    } finally {
      setDomainPreviewLoading(false);
    }
  }, []);

  const handleDomainChange = (value: string) => {
    setDomain(value);
    if (value.trim() !== lastPreviewedDomain.current) {
      setDomainPreview(null);
    }
  };

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
                Let&apos;s set up your brand in four quick phases
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Basics → Brand → Channels → Plan. We&apos;ll learn your company from your domain,
                optionally connect Facebook and Shopify, and recommend whether to lead with AEO or
                paid ads. At the end you request access — an admin approves before you can log in.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Enter your company name and domain</li>
                <li>We auto-fill brand DNA from your site</li>
                <li>Connect channels (optional) and review your plan</li>
              </ol>
            </div>
          </div>
        );

      case 'company':
        return (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Your company</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We use your domain to auto-fill brand profile and DNA. Tab out of the domain field
                to verify we can reach your site.
              </p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Company name</span>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme D2C"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Company domain</span>
              <input
                className={inputClass}
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                onBlur={() => void checkDomainPreview(domain)}
                placeholder="acme.com"
              />
              {domainPreviewLoading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Checking {domain.trim() || 'domain'}…
                </p>
              ) : domainPreview ? (
                <p
                  className={[
                    'flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed',
                    domainPreview.ok
                      ? 'bg-primary/5 text-foreground'
                      : 'bg-amber-500/10 text-amber-900 dark:text-amber-100',
                  ].join(' ')}
                >
                  {domainPreview.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {domainPreview.message}
                </p>
              ) : domain.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Leave the field to verify your domain before continuing.
                </p>
              ) : null}
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
      if (domainPreviewLoading) {
        setError('Still verifying your domain — one moment.');
        return;
      }
      if (!domainPreview || lastPreviewedDomain.current !== domain.trim()) {
        await checkDomainPreview(domain);
        setError('Please verify your domain (tab out of the field) before continuing.');
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
  const showWelcomePanel = step === 'welcome';

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <aside className="relative hidden w-[42%] border-r border-border bg-card lg:flex lg:flex-col">
        {showWelcomePanel ? (
          <OnboardingWelcomePanel />
        ) : (
          <OnboardingBrandPreview
            step={step}
            company={company}
            companyName={name}
            domain={domain}
            domainPreview={domainPreview}
            canonicalName={canonicalName}
            industry={industry}
            oneLiner={oneLiner}
            category={category}
            businessModel={businessModel}
            primaryAudience={primaryAudience}
            metaConnected={metaConnected}
            shopifyConnected={shopifyConnected}
            enriching={step === 'enriching' || loading}
            plan={plan}
          />
        )}
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="border-b border-border px-6 py-4 lg:px-10">
          <OnboardingPhaseBar current={step} />
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
