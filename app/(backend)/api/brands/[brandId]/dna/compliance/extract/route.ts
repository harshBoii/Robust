import { NextResponse } from 'next/server';

import {
  complianceContentType,
  complianceExtension,
  extractComplianceDocumentText,
} from '@/lib/brand-dna/compliance/extract-text';
import { extractComplianceRulesFromText } from '@/lib/brand-dna/compliance/extract-rules';
import { uploadBrandDnaBuffer } from '@/lib/brand-dna/r2';
import { requireBrandDnaSession } from '@/lib/brand-dna/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type Params = { params: Promise<{ brandId: string }> };

export async function POST(req: Request, { params }: Params) {
  const { brandId } = await params;
  const auth = await requireBrandDnaSession(brandId);
  if (auth.error) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  const ext = complianceExtension(file.name);
  if (!ext) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, TXT, DOCX, or MD.' },
      { status: 400 },
    );
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { publicUrl } = await uploadBrandDnaBuffer({
      companyId: auth.session.companyId,
      brandId,
      subpath: 'compliance',
      filename: file.name,
      bytes,
      contentType: complianceContentType(ext),
    });

    const text = await extractComplianceDocumentText(bytes, ext);
    if (!text.trim()) {
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 422 });
    }

    const extracted = await extractComplianceRulesFromText(text);

    return NextResponse.json({
      extracted,
      sourceFileUrl: publicUrl,
      sourceFileName: file.name,
    });
  } catch (e) {
    console.error('[compliance/extract]', e);
    const message = e instanceof Error ? e.message : 'Compliance extraction failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
