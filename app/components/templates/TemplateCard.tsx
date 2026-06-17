'use client';

import { getTemplatePreviewImage } from '@/lib/templates/template-previews';
import type { TemplateDefinition } from '@/lib/templates/types';

function previewAspectClass(fixedAspectRatio?: string | null): string {
  switch (fixedAspectRatio) {
    case '9:16':
      return 'aspect-[9/16]';
    case '1:1':
      return 'aspect-square';
    default:
      return 'aspect-[4/3]';
  }
}

export function TemplateCard({
  template,
  onSelect,
  disabled,
}: {
  template: TemplateDefinition;
  onSelect: (templateId: string) => void;
  disabled?: boolean;
}) {
  const previewSrc = getTemplatePreviewImage(template.id, template.category);
  const previewAlt = `${template.name} preview`;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(template.id)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-background/80 text-left transition hover:border-primary/40 hover:bg-primary/5 hover:shadow-md disabled:opacity-50"
    >
      <div
        className={`relative w-full overflow-hidden bg-muted/40 ${previewAspectClass(template.fixedAspectRatio)}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt={previewAlt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className="font-display text-[15px] font-semibold text-foreground">{template.name}</span>
        <span className="mt-1.5 flex-1 text-[13px] leading-snug text-muted-foreground">
          {template.description}
        </span>
      </div>
    </button>
  );
}
