'use client';

import {
  DEFAULT_IMAGE_ARTIST_ID,
  DEFAULT_IMAGE_QUALITY,
  IMAGE_ARTISTS,
  IMAGE_QUALITY_OPTIONS,
  type ImageArtistId,
  type ImageQuality,
} from '@/lib/image-gen/image-artists';

import { ChatInlineSelect, type ChatInlineSelectOption } from './ChatInlineSelect';

const ARTIST_AVATAR_COLORS: Record<ImageArtistId, string> = {
  adicasso: 'bg-violet-500/90',
  crafta: 'bg-amber-600/90',
  tintin: 'bg-sky-600/90',
  adasta: 'bg-rose-600/90',
};

function artistAvatar(id: ImageArtistId, name: string, size: 'sm' | 'md' = 'md') {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const dim = size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-[10px]';
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        dim,
        ARTIST_AVATAR_COLORS[id],
      ].join(' ')}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function buildArtistOptions(): ChatInlineSelectOption[] {
  return IMAGE_ARTISTS.map((a) => ({
    value: a.id,
    label: a.name,
    description: a.tagline,
    leading: artistAvatar(a.id, a.name),
  }));
}

function buildQualityOptions(): ChatInlineSelectOption[] {
  return IMAGE_QUALITY_OPTIONS.map((q) => ({
    value: q.id,
    label: q.label,
  }));
}

export function ImageGenArtistSettingsBar({
  artistId,
  quality,
  onArtistChange,
  onQualityChange,
  onContinue,
  disabled,
  compact,
  showContinue = true,
  continueLabel = 'Continue',
}: {
  artistId: ImageArtistId;
  quality: ImageQuality;
  onArtistChange: (id: ImageArtistId) => void;
  onQualityChange: (q: ImageQuality) => void;
  onContinue: () => void;
  disabled?: boolean;
  compact?: boolean;
  showContinue?: boolean;
  continueLabel?: string;
}) {
  const artistOptions = buildArtistOptions();
  const qualityOptions = buildQualityOptions();
  const artist = IMAGE_ARTISTS.find((a) => a.id === artistId) ?? IMAGE_ARTISTS[1];

  return (
    <div className={['flex flex-wrap items-center gap-1', compact ? '' : 'gap-2'].join(' ')}>
      <ChatInlineSelect
        ariaLabel="Image artist"
        compact={compact}
        disabled={disabled}
        value={artistId}
        options={artistOptions}
        triggerLeading={artistAvatar(artist.id, artist.name, compact ? 'sm' : 'md')}
        onChange={(v) => onArtistChange(v as ImageArtistId)}
      />
      <ChatInlineSelect
        ariaLabel="Image quality"
        compact={compact}
        disabled={disabled}
        value={quality}
        options={qualityOptions}
        onChange={(v) => onQualityChange(v as ImageQuality)}
      />
      {showContinue ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onContinue}
          className={[
            'rounded-lg bg-primary font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50',
            compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3.5 py-2 text-[13px]',
          ].join(' ')}
        >
          {continueLabel}
        </button>
      ) : null}
    </div>
  );
}

export function defaultArtistSettings(): { artistId: ImageArtistId; quality: ImageQuality } {
  return {
    artistId: DEFAULT_IMAGE_ARTIST_ID,
    quality: DEFAULT_IMAGE_QUALITY,
  };
}
