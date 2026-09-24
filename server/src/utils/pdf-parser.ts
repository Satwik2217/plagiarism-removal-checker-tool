// Robust PDF text extraction with three-tier strategy:
// 1. unpdf (pdf.js wrapper tuned for Node/serverless — best xref repair)
// 2. pdf-parse fallback (older pdf.js, import from lib to skip its debug mode)
// 3. Clear, actionable error messages
const pdfParseLegacy = require('pdf-parse/lib/pdf-parse.js');

async function extractWithUnpdf(buffer: Buffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8, {
    useSystemFonts: true
  });
  const { text } = await extractText(pdf, { mergePages: true });
  return (text || '').replace(/\s+/g, ' ').trim();
}

export class PDFParseUtil {
  static async parse(buffer: Buffer): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file');
    }

    const header = buffer.subarray(0, 5).toString('latin1');
    if (header !== '%PDF-') {
      throw new Error('Not a valid PDF file (missing %PDF header). The file may be corrupted or not a PDF.');
    }

    // Primary: unpdf
    try {
      const text = await extractWithUnpdf(buffer);
      if (text.length > 0) {
        return text;
      }
      throw new Error('No text layer found');
    } catch (unpdfError: any) {
      // Fallback: legacy pdf-parse
      try {
        const data = await pdfParseLegacy(buffer);
        if (data.text && data.text.trim().length > 0) {
          return data.text;
        }
        throw new Error('No text could be extracted');
      } catch (legacyError: any) {
        const primaryMsg = unpdfError?.message || String(unpdfError);
        const secondaryMsg = legacyError?.message || String(legacyError);

        const noText =
          /no text (layer|could)/i.test(primaryMsg) ||
          /no text (layer|could)/i.test(secondaryMsg);

        if (noText) {
          throw new Error(
            'PDF opened but contains no extractable text. It may be a scanned/image-only PDF — run OCR on it first, then upload again.'
          );
        }

        throw new Error(`Failed to parse PDF: ${primaryMsg}`);
      }
    }
  }
}
