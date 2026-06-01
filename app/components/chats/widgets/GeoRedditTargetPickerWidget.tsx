'use client';

import {
  RedditPublishTargetPicker,
  type RedditPublishTargetChoice,
} from '@/app/components/geo/bounty/RedditPublishTargetPicker';

import type { ChatWidgetDispatch } from './ChatWidgets';

export type GeoRedditTargetPickerPayload = {
  bountyId: string;
  initialSubreddit?: string | null;
};

export function parseGeoRedditTargetPickerPayload(
  raw: unknown,
): GeoRedditTargetPickerPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const bountyId = typeof p.bountyId === 'string' ? p.bountyId : '';
  if (!bountyId) return null;
  const initialSubreddit =
    typeof p.initialSubreddit === 'string' ? p.initialSubreddit : null;
  return { bountyId, initialSubreddit };
}

export function GeoRedditTargetPickerWidget({
  payload,
  onAction,
  disabled,
}: {
  payload: GeoRedditTargetPickerPayload;
  onAction: ChatWidgetDispatch;
  disabled?: boolean;
}) {
  const handleConfirm = (choice: RedditPublishTargetChoice) => {
    const label =
      choice.kind === 'profile'
        ? `Post to profile (${choice.name})`
        : `Post to r/${choice.name.replace(/^r\//i, '')}`;
    void onAction(
      'geo.redditTargetPicked',
      {
        bountyId: payload.bountyId,
        subreddit: choice.name,
        kind: choice.kind,
        flairId: choice.flairId ?? null,
      },
      label,
    );
  };

  return (
    <RedditPublishTargetPicker
      initialName={payload.initialSubreddit}
      confirmLabel="Confirm community"
      disabled={disabled}
      onConfirm={handleConfirm}
    />
  );
}
