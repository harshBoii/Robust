'use client';

import { useEffect, useMemo, useState } from 'react';

import { pickGroupVideoAssetId } from '@/lib/assistant/pick-group-video-asset';

export type CreativeAnalyzeGroupOption = {
  groupId: string;
  label: string;
  selectedAssetCount: number;
  assets: { id: string; assetType: string }[];
  selectedAssetIds: string[];
};

export type CreativeGroupAnalyzeDialogProps = {
  open: boolean;
  seedGroupId: string | null;
  groups: CreativeAnalyzeGroupOption[];
  analyzing?: boolean;
  onClose: () => void;
  onConfirm: (groupIds: string[]) => void;
};

export function CreativeGroupAnalyzeDialog({
  open,
  seedGroupId,
  groups,
  analyzing,
  onClose,
  onConfirm,
}: CreativeGroupAnalyzeDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const initial = new Set<string>();
    if (seedGroupId && groups.some((g) => g.groupId === seedGroupId)) {
      initial.add(seedGroupId);
    }
    setSelected(initial);
  }, [open, seedGroupId, groups]);

  const readyGroups = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        assetId: pickGroupVideoAssetId(g),
      })),
    [groups],
  );

  if (!open) return null;

  const toggle = (groupId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const selectAllReady = () => {
    setSelected(new Set(readyGroups.filter((g) => g.assetId).map((g) => g.groupId)));
  };

  const selectedReady = readyGroups.filter((g) => selected.has(g.groupId) && g.assetId);
  const canConfirm = selectedReady.length > 0 && !analyzing;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={analyzing ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="creative-analyze-dialog-title"
        className="glass-modal relative z-[71] flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--glass-border)] px-4 py-3">
          <h2 id="creative-analyze-dialog-title" className="text-base font-semibold text-foreground">
            Analyze creative with Miss Robusta
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one or more groups. We analyze each group&apos;s video and fill headline, primary text, and more.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 glass-scrollbar">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No included groups. Go back to Media and include groups first.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={selectAllReady}
                  disabled={analyzing}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  Select all with video
                </button>
              </div>
              {readyGroups.map((group) => {
                const checked = selected.has(group.groupId);
                const noVideo = !group.assetId;
                return (
                  <label
                    key={group.groupId}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                      checked ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
                      noVideo ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/40',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-input"
                      checked={checked}
                      disabled={noVideo || analyzing}
                      onChange={() => !noVideo && toggle(group.groupId)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{group.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.selectedAssetCount} selected asset
                        {group.selectedAssetCount !== 1 ? 's' : ''}
                      </p>
                      {noVideo ? (
                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                          No video in this group — select a video asset first.
                        </p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-[var(--glass-border)] p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={analyzing}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-input bg-background text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(selectedReady.map((g) => g.groupId))}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {analyzing
              ? 'Analyzing…'
              : `Analyze ${selectedReady.length} group${selectedReady.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
