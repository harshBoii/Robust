'use client';

import { FileImage, X } from 'lucide-react';

import type { ChatAttachmentItem } from '@/lib/chats/chat-attachment-types';

function fileTypeLabel(fileName: string, mimeType?: string): string {
  if (mimeType?.includes('avif')) return 'AVIF';
  if (mimeType?.includes('webp')) return 'WEBP';
  if (mimeType?.includes('png')) return 'PNG';
  if (mimeType?.includes('jpeg') || mimeType?.includes('jpg')) return 'JPEG';
  const ext = fileName.split('.').pop()?.toUpperCase();
  return ext && ext.length <= 5 ? ext : 'IMAGE';
}

export function ChatAttachmentFileCard({
  item,
  compact,
}: {
  item: ChatAttachmentItem;
  compact?: boolean;
}) {
  const label = fileTypeLabel(item.fileName, item.mimeType);

  return (
    <div
      className={[
        'flex overflow-hidden rounded-xl border border-border/50 bg-muted/30',
        compact ? 'max-w-[200px]' : 'max-w-[240px]',
      ].join(' ')}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className={compact ? 'h-14 w-14 shrink-0 object-cover' : 'h-16 w-16 shrink-0 object-cover'}
        />
      ) : (
        <div
          className={[
            'flex shrink-0 items-center justify-center bg-muted/50 text-muted-foreground',
            compact ? 'h-14 w-14' : 'h-16 w-16',
          ].join(' ')}
        >
          <FileImage className="h-5 w-5" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between px-2.5 py-2">
        <p className="truncate text-[13px] font-medium text-foreground">{item.fileName}</p>
        <span className="mt-1 inline-flex w-fit rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ChatAttachmentMessage({
  items,
  content,
}: {
  items: ChatAttachmentItem[];
  content?: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-2">
      {items.map((item, i) => (
        <ChatAttachmentFileCard key={`${item.assetId ?? item.fileName}-${i}`} item={item} />
      ))}
      {content?.trim() ? (
        <div
          className={[
            'max-w-[min(85%,32rem)] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed',
            'border border-[color-mix(in_srgb,var(--primary)_22%,var(--border))]',
            'bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))]',
            'text-foreground shadow-sm',
          ].join(' ')}
        >
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      ) : null}
    </div>
  );
}

export type ComposerPendingAttachment = ChatAttachmentItem & {
  localId: string;
  previewUrl: string;
};

export function ComposerAttachmentStrip({
  items,
  onRemove,
  disabled,
}: {
  items: ComposerPendingAttachment[];
  onRemove: (localId: string) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-border/30 px-3 pt-3 pb-2">
      {items.map((item) => (
        <div key={item.localId} className="group relative">
          <div className="h-16 w-14 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.localId)}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition hover:text-foreground disabled:opacity-40"
            aria-label={`Remove ${item.fileName}`}
          >
            <X className="h-3 w-3" />
          </button>
          <p className="mt-0.5 max-w-[56px] truncate text-[9px] text-muted-foreground">{item.fileName}</p>
        </div>
      ))}
    </div>
  );
}
