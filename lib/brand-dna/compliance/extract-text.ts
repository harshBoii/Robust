import 'server-only';

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function complianceExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !(ext in EXT_MIME)) return null;
  return ext;
}

export async function extractComplianceDocumentText(
  bytes: Buffer,
  extension: string,
): Promise<string> {
  if (extension === 'txt' || extension === 'md') {
    return bytes.toString('utf8').trim();
  }

  if (extension === 'pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText();
      return (result.text ?? '').trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: bytes });
    return (result.value ?? '').trim();
  }

  throw new Error('Unsupported file type');
}

export function complianceContentType(extension: string): string {
  return EXT_MIME[extension] ?? 'application/octet-stream';
}
