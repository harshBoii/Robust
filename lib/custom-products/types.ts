import type { CustomProductStatus, CustomProductType } from '@/app/generated/prisma/client';

export type CustomProductFaq = {
  question: string;
  answer: string;
};

export type CustomProductDto = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  category: string | null;
  productType: CustomProductType;
  status: CustomProductStatus;
  tagline: string | null;
  keyBenefits: string[];
  targetAudience: string | null;
  keywords: string[];
  toneNotes: string | null;
  mediaUrls: string[];
  faqs: CustomProductFaq[];
  certifications: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomProductInput = {
  name?: string;
  description?: string | null;
  category?: string | null;
  productType?: CustomProductType;
  status?: CustomProductStatus;
  tagline?: string | null;
  keyBenefits?: string[];
  targetAudience?: string | null;
  keywords?: string[];
  toneNotes?: string | null;
  mediaUrls?: string[];
  faqs?: CustomProductFaq[];
  certifications?: string | null;
};
