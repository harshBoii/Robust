export type ChatAttachmentItem = {
  assetId?: string;
  fileName: string;
  imageUrl?: string;
  mimeType?: string;
};

export type ChatAttachmentsPayload = {
  items: ChatAttachmentItem[];
};
