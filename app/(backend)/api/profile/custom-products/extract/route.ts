import { NextResponse } from 'next/server';

import { callCustomProductMicroservice } from '@/lib/custom-products/microservice-client';
import { mapMicroserviceProductToCreateInput } from '@/lib/custom-products/map-microservice-product';
import { serializeCustomProduct } from '@/lib/custom-products/serialize';
import { requireProfileSession } from '@/lib/profile/api-auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_BASE64_LENGTH = 14_000_000; // ~10MB raw

type ExtractBody = Record<string, unknown>;

function countSources(body: ExtractBody) {
  let count = 0;
  if (typeof body.companyDomain === 'string' && body.companyDomain.trim()) count++;
  if (typeof body.imageBase64 === 'string' && body.imageBase64.trim()) count++;
  if (typeof body.pdfBase64 === 'string' && body.pdfBase64.trim()) count++;
  return count;
}

export async function POST(request: Request) {
  const { session, error } = await requireProfileSession();
  if (error) return error;

  let body: ExtractBody;
  try {
    body = (await request.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sourceCount = countSources(body);
  if (sourceCount === 0) {
    return NextResponse.json(
      { error: 'Provide exactly one source: companyDomain, imageBase64, or pdfBase64' },
      { status: 400 },
    );
  }
  if (sourceCount > 1) {
    return NextResponse.json(
      { error: 'Provide only one source: companyDomain, imageBase64, or pdfBase64' },
      { status: 400 },
    );
  }

  const companyId = session!.companyId;
  const sessionId = `custom-product-${companyId}-${crypto.randomUUID()}`;

  let companyDomain: string | undefined;
  let imageBase64: string | undefined;
  let imageMimeType: string | undefined;
  let pdfBase64: string | undefined;

  if (typeof body.companyDomain === 'string' && body.companyDomain.trim()) {
    companyDomain = body.companyDomain.trim();
    if (!companyDomain.startsWith('https://')) {
      return NextResponse.json(
        { error: 'companyDomain must start with https://' },
        { status: 400 },
      );
    }
  } else if (typeof body.imageBase64 === 'string' && body.imageBase64.trim()) {
    imageBase64 = body.imageBase64.trim();
    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'Image file is too large (max 10MB)' }, { status: 400 });
    }
    imageMimeType =
      typeof body.imageMimeType === 'string' && body.imageMimeType.trim()
        ? body.imageMimeType.trim()
        : 'image/png';
  } else if (typeof body.pdfBase64 === 'string' && body.pdfBase64.trim()) {
    pdfBase64 = body.pdfBase64.trim();
    if (pdfBase64.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: 'PDF file is too large (max 10MB)' }, { status: 400 });
    }
  }

  try {
    const response = await callCustomProductMicroservice({
      companyId,
      sessionId,
      companyDomain,
      imageBase64,
      imageMimeType,
      pdfBase64,
    });

    const createData = mapMicroserviceProductToCreateInput(companyId, response.customProduct);
    const product = await prisma.customProduct.create({ data: createData });

    return NextResponse.json({
      product: serializeCustomProduct(product),
      extraction: response.extraction,
    });
  } catch (e) {
    console.error('[custom-products/extract POST]', e);
    const message = e instanceof Error ? e.message : 'Extraction failed';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
