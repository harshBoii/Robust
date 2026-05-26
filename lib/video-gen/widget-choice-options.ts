import 'server-only';

import type { WidgetChoiceOption } from '@/lib/chats/classify-widget-choice';

import type { VideoGenActionType, VideoGenAdCategory, VideoGenState } from './types';
import { VIDEO_GEN_AD_CATEGORIES } from './types';

export function videoGenStepDescription(step: VideoGenState['step']): string {
  switch (step) {
    case 'routing':
      return 'Choose a video ad creation path';
    case 'offeringPick':
      return 'Choose which offering to promote';
    case 'adTypePick':
      return 'Choose the type of video ad';
    case 'adLibraryPick':
      return 'Choose a video ad from your library to replicate';
    default:
      return step;
  }
}

export function optionsForVideoGenStep(vg: VideoGenState): WidgetChoiceOption[] | null {
  switch (vg.step) {
    case 'routing':
      return [
        { optionId: 'mrAdicasso', label: 'Mr. Adicasso', description: 'AI masterpiece from scratch' },
        { optionId: 'learnAndBuild', label: 'Learn and Build', description: 'From top performers' },
        { optionId: 'replicate', label: 'Replicate an Ad', description: 'Match an existing ad' },
      ];
    case 'offeringPick': {
      const offerings = vg.companyContext?.offerings ?? [];
      return offerings.map((o) => ({
        optionId: o.id,
        label: o.name,
        description: o.description ?? undefined,
      }));
    }
    case 'adTypePick':
      return VIDEO_GEN_AD_CATEGORIES.map((c) => ({
        optionId: c.id,
        label: c.label,
      }));
    default:
      return null;
  }
}

export function dispatchForVideoGenChoice(
  step: VideoGenState['step'],
  optionId: string,
): { action: VideoGenActionType; payload: Record<string, unknown> } | null {
  switch (step) {
    case 'routing':
      return { action: 'videoGen.subpathChosen', payload: { subpath: optionId } };
    case 'offeringPick':
      return { action: 'videoGen.offeringSelected', payload: { offeringId: optionId } };
    case 'adTypePick':
      return {
        action: 'videoGen.adTypeSelected',
        payload: { category: optionId as VideoGenAdCategory },
      };
    default:
      return null;
  }
}

/** Fast path: match typed text to offering/category without LLM. */
export function matchVideoGenTextToChoice(
  vg: VideoGenState,
  text: string,
): { action: VideoGenActionType; payload: Record<string, unknown> } | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;

  if (vg.step === 'offeringPick' && vg.companyContext) {
    const offering = vg.companyContext.offerings.find(
      (o) =>
        o.name.toLowerCase() === t ||
        o.name.toLowerCase().includes(t) ||
        t.includes(o.name.toLowerCase()),
    );
    if (offering) {
      return { action: 'videoGen.offeringSelected', payload: { offeringId: offering.id } };
    }
  }

  if (vg.step === 'adTypePick') {
    const cat = VIDEO_GEN_AD_CATEGORIES.find(
      (c) =>
        c.label.toLowerCase() === t ||
        c.label.toLowerCase().includes(t) ||
        c.id.toLowerCase() === t.replace(/\s+/g, ''),
    );
    if (cat) {
      return { action: 'videoGen.adTypeSelected', payload: { category: cat.id } };
    }
  }

  if (vg.step === 'routing') {
    if (/adicasso|picasso|from scratch|masterpiece/.test(t)) {
      return { action: 'videoGen.subpathChosen', payload: { subpath: 'mrAdicasso' } };
    }
    if (/learn|build|top perform|winning/.test(t)) {
      return { action: 'videoGen.subpathChosen', payload: { subpath: 'learnAndBuild' } };
    }
    if (/replicat|existing|library/.test(t)) {
      return { action: 'videoGen.subpathChosen', payload: { subpath: 'replicate' } };
    }
  }

  return null;
}
