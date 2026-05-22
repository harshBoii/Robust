import type { ImageGenState } from '@/lib/image-gen/types';

import type { TemplateDefinition } from './types';

function f(state: ImageGenState): Record<string, unknown> {
  return state.templateCollectedFields ?? {};
}

function str(state: ImageGenState, key: string, fallback = ''): string {
  const v = f(state)[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function fieldVal(state: ImageGenState, key: string): unknown {
  return f(state)[key];
}

function additionalRequest(state: ImageGenState): string | null {
  const extra =
    str(state, 'additionalRequest') ||
    (state.rejectFeedback?.trim() ? state.rejectFeedback : '') ||
    str(state, 'changeRequest');
  return extra.trim() || null;
}

function baseParts(state: ImageGenState, templateName: string, specifics: string[]): string {
  const extra = additionalRequest(state);
  const parts = [
    `Template: ${templateName}.`,
    ...specifics.filter(Boolean),
    extra ? `Additional user request: ${extra}` : null,
    'Photorealistic, ad-ready, accurate product representation.',
  ].filter(Boolean);
  return parts.join('\n');
}

export function buildPromptForTemplate(
  def: TemplateDefinition,
  state: ImageGenState,
  index = 0,
): string {
  switch (def.id) {
    case 'product-clean-background':
      return baseParts(state, def.name, [
        'Professional e-commerce product on clean isolated background.',
        `Background: ${str(state, 'backgroundColor', 'white')}.`,
        `Shadow: ${str(state, 'shadowPreference', 'subtle ground shadow')}.`,
      ]);

    case 'lifestyle-context':
      return baseParts(state, def.name, [
        'Place product naturally in a lifestyle scene.',
        `Context: ${str(state, 'lifestyleContext', 'modern home')}.`,
        `Mood: ${str(state, 'mood', 'aspirational')}.`,
        `Person in scene: ${str(state, 'includePerson', 'no')}.`,
      ]);

    case 'dramatic-studio':
      return baseParts(state, def.name, [
        'Dramatic studio lighting product shot.',
        `Lighting: ${str(state, 'lightingDirection', 'side lit')}.`,
        `Background tone: ${str(state, 'backgroundTone', 'dark')}.`,
        `Light accent: ${str(state, 'colorAccent', 'none')}.`,
      ]);

    case 'flat-lay':
      return baseParts(state, def.name, [
        'Flat lay overhead product composition.',
        `Surface: ${str(state, 'surfaceMaterial', 'white paper')}.`,
        fieldVal(state, 'props') ? `Props: ${String(fieldVal(state, 'props'))}.` : null,
        `Palette: ${str(state, 'colorPalette', 'neutral')}.`,
      ].filter(Boolean) as string[]);

    case 'shadow-reflection':
      return baseParts(state, def.name, [
        'Product with realistic shadow/reflection effect.',
        `Effect: ${str(state, 'effectType', 'subtle shadow')}.`,
        `Background: ${str(state, 'backgroundColor', 'white')}.`,
        `Intensity: ${str(state, 'shadowIntensity', 'soft')}.`,
      ]);

    case 'seasonal-holiday':
      return baseParts(state, def.name, [
        'Seasonal/holiday themed product presentation.',
        `Season/holiday: ${str(state, 'seasonOrHoliday', 'winter')}.`,
        `Theming intensity: ${str(state, 'themingIntensity', 'moderate')}.`,
      ]);

    case 'extract-model':
      return baseParts(state, def.name, [
        'Extract model/person from background; preserve subject edges and detail.',
        `Intended use: ${str(state, 'intendedUse', 'clean cutout')}.`,
        fieldVal(state, 'newBackground')
          ? `New background: ${String(fieldVal(state, 'newBackground'))}.`
          : 'Transparent or neutral background.',
      ]);

    case 'age-demographic':
      return baseParts(state, def.name, [
        'Shift apparent age/demographic while preserving identity cues.',
        `Target age: ${str(state, 'targetAgeRange', 'mid 40s')}.`,
        `Keep other attributes: ${str(state, 'keepAttributes', 'yes')}.`,
        `Background: ${str(state, 'background', 'keep original')}.`,
      ]);

    case 'close-up-crops': {
      const focus = str(state, 'cropFocus', 'face');
      return baseParts(state, def.name, [
        `Tight close-up crop focusing on: ${focus}.`,
        `Aspect ratio: ${str(state, 'aspectRatio', '1:1')}.`,
      ]);
    }

    case 'background-replacement':
      return baseParts(state, def.name, [
        'Replace background; keep subject pixel-accurate.',
        `New background: ${str(state, 'newBackground', 'outdoor park')}.`,
        `Match lighting: ${str(state, 'matchLighting', 'yes')}.`,
      ]);

    case 'anime-illustrated':
      return baseParts(state, def.name, [
        'Convert to anime/illustrated style.',
        `Style: ${str(state, 'illustrationStyle', 'anime')}.`,
        `Colors: ${str(state, 'colorPalette', 'stylized')}.`,
      ]);

    case 'luxury-editorial':
      return baseParts(state, def.name, [
        'Luxury high-fashion editorial treatment.',
        `Reference tone: ${str(state, 'brandReference', 'Vogue editorial')}.`,
        `Color grade: ${str(state, 'colorGrade', 'cold editorial')}.`,
      ]);

    case 'minimalist-scandinavian':
      return baseParts(state, def.name, [
        'Minimalist Scandinavian aesthetic: clean, neutral, negative space.',
        `Surface: ${str(state, 'surfaceMaterial', 'white')}.`,
        `Accent: ${str(state, 'accentColor', 'none')}.`,
      ]);

    case 'dark-cinematic':
      return baseParts(state, def.name, [
        'Dark moody cinematic color grade.',
        `Grade: ${str(state, 'colorGrade', 'teal-orange')}.`,
        `Atmosphere: ${str(state, 'atmosphere', 'light haze')}.`,
        `Grain: ${str(state, 'grain', 'subtle')}.`,
      ]);

    case 'neon-cyberpunk':
      return baseParts(state, def.name, [
        'Neon cyberpunk night scene.',
        `Neon colors: ${str(state, 'neonColor', 'multi-color')}.`,
        `Environment: ${str(state, 'environment', 'rainy street')}.`,
      ]);

    case 'vintage-retro':
      return baseParts(state, def.name, [
        'Vintage retro film look.',
        `Era: ${str(state, 'era', '70s warm film')}.`,
        `Grain: ${str(state, 'grain', 'medium')}.`,
        `Effects: ${str(state, 'colorEffects', 'light leak')}.`,
      ]);

    case 'watercolor-sketch':
      return baseParts(state, def.name, [
        'Hand-drawn artistic rendering.',
        `Style: ${str(state, 'styleVariant', 'watercolor')}.`,
        `Color: ${str(state, 'colorRetention', 'full color')}.`,
      ]);

    case 'story-vertical-safe':
      return baseParts(state, def.name, [
        '9:16 vertical story ad with safe zones for text.',
        fieldVal(state, 'headline')
          ? `Headline zone: "${String(fieldVal(state, 'headline'))}".`
          : 'Reserve top safe zone for headline.',
        fieldVal(state, 'cta')
          ? `CTA zone: "${String(fieldVal(state, 'cta'))}".`
          : 'Reserve bottom safe zone for CTA.',
        `Brand color: ${str(state, 'brandColor', 'white on dark overlay')}.`,
      ]);

    case 'ugc-style':
      return baseParts(state, def.name, [
        'UGC-style phone-camera aesthetic, authentic and unpolished.',
        `Setting: ${str(state, 'setting', 'at home')}.`,
        `Human presence: ${str(state, 'humanPresence', 'hands visible')}.`,
      ]);

    case 'testimonial-overlay':
      return baseParts(state, def.name, [
        'Image with clean zone for testimonial quote overlay.',
        `Background treatment: ${str(state, 'backgroundTreatment', 'blur image')}.`,
        `Text zone: ${str(state, 'textZonePosition', 'bottom strip')}.`,
      ]);

    case 'urgency-sale-banner':
      return baseParts(state, def.name, [
        'Sale/urgency banner composition.',
        `Offer: ${str(state, 'offerText', 'Limited time offer')}.`,
        `CTA: ${str(state, 'ctaText', 'Shop Now')}.`,
        `Aspect: ${str(state, 'aspectRatio', '1:1')}.`,
      ]);

    case 'meta-feed-square':
      return baseParts(state, def.name, [
        'Meta feed 1:1 square crop, subject centered.',
        `Crop focus: ${str(state, 'cropFocus', 'center')}.`,
        `Border: ${str(state, 'border', 'none')}.`,
      ]);

    case 'meta-story-reel':
      return baseParts(state, def.name, [
        'Meta story/reel 9:16 vertical with safe margins.',
        `Reframe: ${str(state, 'reframeMethod', 'extend background')}.`,
        `Safe zones: ${str(state, 'textSafeZones', 'top and bottom')}.`,
      ]);

    case 'google-display-banner':
      return baseParts(state, def.name, [
        'Google Display Network banner.',
        `Size: ${str(state, 'outputSize', '300x250')}.`,
        fieldVal(state, 'headline') ? `Headline: ${String(fieldVal(state, 'headline'))}.` : '',
        `Background: ${str(state, 'backgroundTreatment', 'brand color fill')}.`,
      ]);

    default:
      return baseParts(state, def.name, ['Follow template recipe.']);
  }
}
