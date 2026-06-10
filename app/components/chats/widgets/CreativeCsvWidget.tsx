'use client';

import { useCallback, useMemo, useState } from 'react';

import type { GroupModel } from '@/app/components/createAd/types';
import type { WorkflowState } from '@/lib/chats/types';
import { parseCsv } from '@/lib/csv/parse-csv';
import {
  applyManualMediaToRows,
  buildCsvCreativeRowResults,
  buildGroupsFromCsvRows,
  CREATIVE_CSV_TARGETS,
  detectDuplicateAssetMatches,
  flattenSessionAssets,
  guessColumnMapping,
  isMappingComplete,
  validateCsvCreativeRows,
  type CreativeCsvColumnMapping,
  type CreativeCsvTarget,
} from '@/lib/chats/csv-creatives';

import type { ChatWidgetDispatch } from './types';

type Step = 'upload' | 'map' | 'review';

export function CreativeCsvWidget({
  groups,
  workflowState,
  onAction,
}: {
  groups?: GroupModel[];
  workflowState: WorkflowState;
  onAction: ChatWidgetDispatch;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<CreativeCsvColumnMapping>({});
  const [manualMedia, setManualMedia] = useState<Record<number, string>>({});
  const [applying, setApplying] = useState(false);

  const sessionAssets = useMemo(() => flattenSessionAssets(groups), [groups]);

  const rowResults = useMemo(() => {
    if (!headers.length || !rows.length || !isMappingComplete(mapping)) return [];
    return buildCsvCreativeRowResults({
      headers,
      rows,
      mapping,
      assets: sessionAssets,
      defaultPixelId: workflowState.pixelId,
    });
  }, [headers, rows, mapping, sessionAssets, workflowState.pixelId]);

  const rowsWithManualMedia = useMemo(
    () => applyManualMediaToRows(rowResults, manualMedia, sessionAssets),
    [rowResults, manualMedia, sessionAssets],
  );

  const duplicateErrors = useMemo(
    () => detectDuplicateAssetMatches(rowsWithManualMedia),
    [rowsWithManualMedia],
  );

  const reviewRows = useMemo(
    () =>
      rowsWithManualMedia.map((r) => ({
        ...r,
        errors: [
          ...r.errors,
          ...(duplicateErrors.has(r.rowIndex) ? [duplicateErrors.get(r.rowIndex)!] : []),
        ],
      })),
    [rowsWithManualMedia, duplicateErrors],
  );

  const validCount = reviewRows.filter((r) => r.errors.length === 0 && r.asset).length;
  const canApply = validCount > 0 && reviewRows.every((r) => r.errors.length === 0);

  const onFile = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) return;
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(guessColumnMapping(parsed.headers));
      setManualMedia({});
      setStep('map');
    };
    reader.readAsText(file);
  }, []);

  const setMappingField = (target: CreativeCsvTarget, column: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (!column) delete next[target];
      else next[target] = column;
      return next;
    });
  };

  const handleApply = async () => {
    if (!canApply) return;
    const built = buildGroupsFromCsvRows({
      rowResults: reviewRows.filter((r) => r.errors.length === 0),
      defaultAdSetId: workflowState.defaultAdSetId ?? '',
    });
    const err = validateCsvCreativeRows(built);
    if (err) return;

    setApplying(true);
    try {
      await onAction(
        'creative.csvParsed',
        { groups: built },
        `Applied CSV (${built.length} ad${built.length === 1 ? '' : 's'})`,
      );
    } finally {
      setApplying(false);
    }
  };

  if (sessionAssets.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No session media found. Upload or pick creatives earlier in this chat first.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {step === 'upload' && (
        <div className="space-y-2">
          <p className="text-[13px] text-muted-foreground">
            Upload a CSV with one row per ad. You will map columns to media and copy fields.
          </p>
          <p className="text-[11px] text-muted-foreground">
            {sessionAssets.length} session asset{sessionAssets.length === 1 ? '' : 's'} available
            for matching.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/30 px-4 py-6 text-center transition hover:border-primary/40">
            <span className="text-[13px] font-medium text-foreground">Choose CSV file</span>
            <span className="mt-1 text-[11px] text-muted-foreground">.csv</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}

      {step === 'map' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">{fileName}</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => {
                setStep('upload');
                setFileName(null);
                setHeaders([]);
                setRows([]);
                setMapping({});
                setManualMedia({});
              }}
            >
              Change file
            </button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Map your CSV columns to ad fields ({rows.length} row{rows.length === 1 ? '' : 's'}).
            Media can be mapped here or assigned per row in the review step.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CREATIVE_CSV_TARGETS.map((t) => (
              <div key={t.id}>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {t.label}
                  {t.required ? ' *' : t.id === 'media' ? ' (optional)' : ''}
                </label>
                <select
                  className="glass-input w-full px-2 py-1.5 text-xs"
                  value={mapping[t.id] ?? ''}
                  onChange={(e) => setMappingField(t.id, e.target.value)}
                >
                  <option value="">— skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!isMappingComplete(mapping)}
            onClick={() => {
              setManualMedia({});
              setStep('review');
            }}
            className="glass-button-primary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Review rows
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">Review {rows.length} rows</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => setStep('map')}
            >
              Edit mapping
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Assign each row to a session asset. Auto-matched when the CSV media column matches a
            filename or title.
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border/40">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">Media</th>
                  <th className="px-2 py-1.5">Headline</th>
                  <th className="px-2 py-1.5">Landing URL</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r) => (
                  <tr key={r.rowIndex} className="border-t border-border/30">
                    <td className="px-2 py-1.5">
                      <div className="flex min-w-[140px] items-center gap-2">
                        {r.asset?.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.asset.thumbnailUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded bg-muted" />
                        )}
                        <select
                          className="glass-input min-w-0 flex-1 px-1.5 py-1 text-[10px]"
                          value={manualMedia[r.rowIndex] ?? r.asset?.id ?? ''}
                          onChange={(e) => {
                            const assetId = e.target.value;
                            setManualMedia((prev) => {
                              const next = { ...prev };
                              if (!assetId) delete next[r.rowIndex];
                              else next[r.rowIndex] = assetId;
                              return next;
                            });
                          }}
                        >
                          <option value="">
                            {r.mediaHint
                              ? `Select — CSV: ${r.mediaHint}`
                              : 'Select media…'}
                          </option>
                          {sessionAssets.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title || a.filename || a.id}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5">
                      {r.creative.headline || '—'}
                    </td>
                    <td className="max-w-[120px] truncate px-2 py-1.5">
                      {r.creative.landingUrl || '—'}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.errors.length === 0 ? (
                        <span className="text-emerald-600">OK</span>
                      ) : (
                        <span className="text-destructive" title={r.errors.join('; ')}>
                          {r.errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={!canApply || applying}
            onClick={() => void handleApply()}
            className="glass-button-primary rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {applying
              ? 'Applying…'
              : `Apply ${validCount} ad${validCount === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </div>
  );
}
