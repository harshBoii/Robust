'use client';

import './landing.css';

import { LenisScroll } from './LenisScroll';
import { AssistantSection } from './sections/AssistantSection';
import { CloserSection } from './sections/CloserSection';
import { DaySection } from './sections/DaySection';
import { FeaturesBento } from './sections/FeaturesBento';
import { IntelligenceSection } from './sections/IntelligenceSection';
import { IntegrationsSection } from './sections/IntegrationsSection';
import { LandingFooter } from './sections/LandingFooter';
import { LandingHero } from './sections/LandingHero';
import { LandingNav } from './sections/LandingNav';
import { RoiSection } from './sections/RoiSection';
import { SavingsSection } from './sections/SavingsSection';
import { SetupSection } from './sections/SetupSection';

export function LandingPage() {
  return (
    <LenisScroll>
      <div className="landing">
        <LandingNav />
        <LandingHero />
        <FeaturesBento />
        <SetupSection />
        <DaySection />
        <AssistantSection />
        <IntelligenceSection />
        <SavingsSection />
        <RoiSection />
        <IntegrationsSection />
        <CloserSection />
        <LandingFooter />
      </div>
    </LenisScroll>
  );
}
