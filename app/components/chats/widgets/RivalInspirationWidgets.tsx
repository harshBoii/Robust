'use client';

import type { ChatWidgetDispatch } from './ChatWidgets';

export function RivalInspirationChoiceWidget({
  actionPrefix,
  onAction,
}: {
  actionPrefix: 'imageGen' | 'videoGen';
  onAction: ChatWidgetDispatch;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          void onAction(`${actionPrefix}.rivalInspirationChosen`, { enabled: true }, 'Yes')
        }
        className="glass-button-primary rounded-lg px-4 py-2 text-[13px] font-semibold"
      >
        Yes, use rival inspiration
      </button>
      <button
        type="button"
        onClick={() =>
          void onAction(`${actionPrefix}.rivalInspirationChosen`, { enabled: false }, 'No')
        }
        className="rounded-lg border border-border/60 bg-background/80 px-4 py-2 text-[13px] font-medium transition hover:border-primary/40"
      >
        No thanks
      </button>
    </div>
  );
}

export function RivalBrandPickerWidget({
  payload,
  actionPrefix,
  onAction,
}: {
  payload: Record<string, unknown>;
  actionPrefix: 'imageGen' | 'videoGen';
  onAction: ChatWidgetDispatch;
}) {
  const rivals =
    (payload.rivals as Array<{ id: string; brandName: string }>) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() =>
          void onAction(
            `${actionPrefix}.rivalBrandChosen`,
            { brandName: null },
            'Mix of top rivals',
          )
        }
        className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-left text-[13px] font-medium hover:bg-primary/10"
      >
        Mix of top rivals
        <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
          Blend intelligence from your first rivals with completed analysis
        </div>
      </button>
      {rivals.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() =>
            void onAction(
              `${actionPrefix}.rivalBrandChosen`,
              { brandName: r.brandName },
              r.brandName,
            )
          }
          className="rounded-lg border border-border/50 px-3 py-2 text-left text-[13px] hover:border-primary/40"
        >
          {r.brandName}
        </button>
      ))}
    </div>
  );
}
