'use client';

import { Globe, History, Loader2, Sparkles, Wind } from 'lucide-react';
import { useEffect, useState } from 'react';

const RELAXING_FACTS = [
  {
    category: 'world' as const,
    text: 'Honey never spoils — edible honey has been found in 3,000-year-old Egyptian tombs.',
  },
  {
    category: 'world' as const,
    text: 'There are more trees on Earth than stars in the Milky Way — roughly three trillion of them.',
  },
  {
    category: 'world' as const,
    text: 'Octopuses have three hearts and blue blood. Two hearts pump to the gills; one to the body.',
  },
  {
    category: 'world' as const,
    text: 'A single cloud can weigh more than a million pounds — about as much as a hundred elephants.',
  },
  {
    category: 'history' as const,
    text: 'Oxford University is older than the Aztec Empire — teaching began there around 1096.',
  },
  {
    category: 'history' as const,
    text: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.',
  },
  {
    category: 'history' as const,
    text: 'Woolly mammoths were still walking the earth when the Great Pyramid was being built.',
  },
  {
    category: 'history' as const,
    text: 'The ancient Romans used concrete that has survived 2,000 years — some modern mixes are still catching up.',
  },
  {
    category: 'tech' as const,
    text: 'The first computer "bug" was a real moth, found trapped in a Harvard Mark II relay in 1947.',
  },
  {
    category: 'tech' as const,
    text: 'Email predates the World Wide Web — Ray Tomlinson sent the first network email in 1971.',
  },
  {
    category: 'tech' as const,
    text: 'The Apollo 11 guidance computer had about 4 KB of memory — less than a single emoji takes today.',
  },
  {
    category: 'tech' as const,
    text: 'The QWERTY keyboard layout was designed in the 1870s to slow typists down and prevent jammed keys.',
  },
] as const;

const CATEGORY_META = {
  world: { label: 'World', Icon: Globe },
  history: { label: 'History', Icon: History },
  tech: { label: 'Tech', Icon: Sparkles },
} as const;

const FACT_INTERVAL_MS = 9_000;

type Props = {
  domain: string;
};

export function OnboardingEnrichingWait({ domain }: Props) {
  const [factIndex, setFactIndex] = useState(() =>
    Math.floor(Math.random() * RELAXING_FACTS.length),
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setVisible(false);
      timeout = setTimeout(() => {
        setFactIndex((i) => (i + 1) % RELAXING_FACTS.length);
        setVisible(true);
      }, 400);
    }, FACT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const fact = RELAXING_FACTS[factIndex]!;
  const { label, Icon } = CATEGORY_META[fact.category];

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <Wind className="absolute -right-1 -bottom-1 h-5 w-5 text-primary/40" />
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold text-foreground">
          Building your brand profile
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Auto-fill usually takes <span className="font-medium text-foreground">2–5 minutes</span>.
          We&apos;re crawling <span className="font-medium text-foreground">{domain}</span> and
          generating your brand DNA.
        </p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Wind className="h-4 w-4" />
          Take a deep breath and relax
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Nothing you need to do right now. Your preview panel on the left will update as we learn
          more about your brand.
        </p>
      </div>

      <div
        className={[
          'w-full max-w-md rounded-2xl border border-border bg-card/80 px-5 py-5 text-left transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-live="polite"
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          While you wait — {label}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{fact.text}</p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        A new fact every few seconds · please keep this tab open
      </p>
    </div>
  );
}
