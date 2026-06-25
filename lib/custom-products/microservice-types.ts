import { z } from 'zod';

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const microserviceCustomProductSchema = z.object({
  companyId: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  productType: z.enum(['PRODUCT', 'SERVICE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
  tagline: z.string().nullable().optional(),
  keyBenefits: z.array(z.string()).optional(),
  targetAudience: z.string().nullable().optional(),
  keywords: z.array(z.string()).optional(),
  toneNotes: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()).optional(),
  faqs: z.array(faqSchema).optional(),
  certifications: z.string().nullable().optional(),
});

export const microserviceCustomProductResponseSchema = z.object({
  customProduct: microserviceCustomProductSchema,
  extraction: z
    .object({
      sourceType: z.string().optional(),
      rawContentLength: z.number().optional(),
      tavilyScrapeData: z.string().optional(),
    })
    .optional(),
});

export type MicroserviceCustomProduct = z.infer<typeof microserviceCustomProductSchema>;
export type MicroserviceCustomProductResponse = z.infer<
  typeof microserviceCustomProductResponseSchema
>;
