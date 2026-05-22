'use client';

import { useCallback, useState } from 'react';

import type { WorkflowState } from '@/lib/chats/types';

import { useUploader } from '@/app/hooks/useUploader';

import type { ComposerPendingAttachment } from './ChatAttachmentDisplay';

async function fetchAssetImageUrl(assetId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/url`, {
      credentials: 'include',
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { url?: string };
    return typeof data.url === 'string' ? data.url : undefined;
  } catch {
    return undefined;
  }
}

export function useChatComposerAttach({
  companyId,
  workflowState,
  currentStep,
  onDispatchUploaded,
}: {
  companyId: string;
  workflowState: WorkflowState;
  currentStep: string;
  onDispatchUploaded: (
    action: string,
    payload: Record<string, unknown>,
    userMessage: string,
  ) => Promise<void>;
}) {
  const { uploadWithBulkId } = useUploader(companyId);
  const [pending, setPending] = useState<ComposerPendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const canAttach =
    currentStep === 'imageGen' ||
    currentStep === 'mediaUpload' ||
    currentStep === 'intent';

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || uploading) return;
      const images = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;

      setUploading(true);
      try {
        for (const file of images) {
          const previewUrl = URL.createObjectURL(file);
          const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          const { assetIds } = await uploadWithBulkId([file], {
            bulkName: `Chat attach · ${new Date().toLocaleString()}`,
          });
          const assetId = assetIds[0];
          if (!assetId) {
            URL.revokeObjectURL(previewUrl);
            continue;
          }

          const imageUrl = (await fetchAssetImageUrl(assetId)) ?? previewUrl;
          const item: ComposerPendingAttachment = {
            localId,
            previewUrl: imageUrl,
            assetId,
            fileName: file.name,
            imageUrl,
            mimeType: file.type,
          };

          setPending((prev) => [...prev, item]);

          if (currentStep === 'imageGen' && workflowState.imageGen) {
            const ig = workflowState.imageGen;
            const role =
              ig.subpath === 'templates'
                ? 'product'
                : typeof ig.step === 'string' &&
                    ['modelSelect', 'backgroundSelect', 'poseSelect'].includes(ig.step)
                  ? ig.step === 'modelSelect'
                    ? 'model'
                    : ig.step === 'backgroundSelect'
                      ? 'background'
                      : 'pose'
                  : 'product';

            await onDispatchUploaded(
              'imageGen.uploaded',
              {
                assetId,
                imageUrl,
                fileName: file.name,
                mimeType: file.type,
                role,
              },
              file.name,
            );
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [uploading, uploadWithBulkId, currentStep, workflowState, onDispatchUploaded],
  );

  const removePending = useCallback((localId: string) => {
    setPending((prev) => {
      const hit = prev.find((p) => p.localId === localId);
      if (hit?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPending((prev) => {
      for (const p of prev) {
        if (p.previewUrl.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl);
      }
      return [];
    });
  }, []);

  return {
    canAttach,
    pending,
    uploading,
    handleFiles,
    removePending,
    clearPending,
  };
}
