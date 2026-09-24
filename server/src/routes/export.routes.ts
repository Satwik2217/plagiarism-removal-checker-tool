import { Router, Request, Response } from 'express';
import * as docxLib from 'docx';
import PDFDocument from 'pdfmake';
import pdfParse from 'pdf-parse';
import { Match } from '../types';

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxLib as any;
const { Unpacker } = docxLib as any;

const router = Router();

// Modify original DOCX or PDF file with fixes applied inline — preserves original formatting
router.post('/modify', async (req: Request, res: Response) => {
  try {
    const { type, filename, fixedContent, matches, originalFileBase64 } = req.body;

    if (!fixedContent || !originalFileBase64) {
      res.status(400).json({ success: false, error: 'Fixed content and original file are required' });
      return;
    }

    const baseName = (filename || 'document').replace(/\.[^.]+$/, '');
    const buffer = Buffer.from(originalFileBase64, 'base64');

    if (type === 'docx') {
      const doc = Unpacker.unpack(buffer);
      replaceTextInDocx(doc, matches || []);
      const resultBuffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
      res.send(Buffer.from(resultBuffer));
      return;
    }

    if (type === 'pdf') {
      const pdfData = await pdfParse(buffer);
      const originalPdfText = pdfData.text;
      const fixedPdfText = applyFixesToOriginal(originalPdfText, matches || []);
      const docDefinition = buildPdfClean(fixedPdfText);
      const fonts = {
        Roboto: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique'
        }
      };
      const printer = new (PDFDocument as any)(fonts);
      const chunks: Buffer[] = [];

      const doc = printer.createPdfKitDocument(docDefinition);
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        res.send(result);
      });
      doc.end();
      return;
    }

    res.status(400).json({ success: false, error: 'Unsupported export type. Use "pdf" or "docx".' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Export failed: ${error.message}` });
  }
});

function applyFixesToOriginal(text: string, matches: Match[]): string {
  const appliedFixes = matches
    .filter(m => m.suggestions && m.suggestions.length > 0)
    .map(m => ({
      originalText: m.text,
      fixedText: m.suggestions[0]
    }));

  if (appliedFixes.length === 0) return text;

  const positioned = appliedFixes
    .map(fix => ({ fix, pos: text.indexOf(fix.originalText) }))
    .filter(x => x.pos >= 0)
    .sort((a, b) => b.pos - a.pos);

  const unmatched = appliedFixes.filter(f => text.indexOf(f.originalText) < 0);

  let result = text;
  for (const { fix, pos } of positioned) {
    const end = pos + fix.originalText.length;
    result = result.slice(0, pos) + fix.fixedText + result.slice(end);
  }

  for (const fix of unmatched) {
    if (!fix.originalText) continue;
    const pattern = fix.originalText
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');
    try {
      const re = new RegExp(pattern);
      const m = result.match(re);
      if (m && m.index !== undefined) {
        result = result.slice(0, m.index) + fix.fixedText + result.slice(m.index + m[0].length);
      }
    } catch {
      // skip unmatchable fix
    }
  }

  return result;
}

function replaceTextInDocx(doc: any, matches: Match[]): void {
  const appliedFixes = matches
    .filter(m => m.suggestions && m.suggestions.length > 0)
    .map(m => ({
      originalText: m.text,
      fixedText: m.suggestions[0]
    }));

  if (appliedFixes.length === 0) return;

  function traverseChildren(children: any[]): void {
    for (const child of children) {
      if (child.children && Array.isArray(child.children)) {
        traverseChildren(child.children);
      }
      if (child.text && typeof child.text === 'string') {
        for (const fix of appliedFixes) {
          if (child.text.includes(fix.originalText)) {
            child.text = child.text.replace(fix.originalText, fix.fixedText);
          }
        }
      }
    }
  }

  if (doc.body && doc.body.children) {
    traverseChildren(doc.body.children);
  }
}

function buildDocxClean(content: string): any {
  const paragraphs: any[] = [];
  content.split('\n').forEach(line => {
    if (line.trim().length > 0) {
      paragraphs.push(new Paragraph({ text: line, spacing: { after: 120 } }));
    } else {
      paragraphs.push(new Paragraph({ text: '' }));
    }
  });
  return new Document({ sections: [{ children: paragraphs }] });
}

function buildPdfClean(content: string): any {
  const contentBlocks: any[] = [];
  content.split('\n').forEach(line => {
    if (line.trim().length > 0) {
      contentBlocks.push({ text: line, margin: [0, 0, 0, 8] });
    }
  });
  return {
    content: contentBlocks,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
    },
    defaultStyle: { fontSize: 11 }
  };
}

// Original export endpoints (unchanged)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, content, filename, includeReport, matches, fixedContent, originalText } = req.body;

    if (!content && !fixedContent) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const docContent = fixedContent || content;
    const baseName = (filename || 'document').replace(/\.[^.]+$/, '');

    if (type === 'docx') {
      const doc = includeReport ? buildDocx(docContent, matches, originalText) : buildDocxClean(docContent);
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
      res.send(Buffer.from(buffer));
      return;
    }

    if (type === 'pdf') {
      let docDefinition;
      if (includeReport) {
        docDefinition = buildPdf(docContent, matches, originalText);
      } else {
        docDefinition = buildPdfClean(docContent);
      }
      const fonts = {
        Roboto: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique'
        }
      };
      const printer = new (PDFDocument as any)(fonts);
      const chunks: Buffer[] = [];

      const doc = printer.createPdfKitDocument(docDefinition);
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
        res.send(result);
      });
      doc.end();
      return;
    }

    res.status(400).json({ success: false, error: 'Unsupported export type. Use "pdf" or "docx".' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Export failed: ${error.message}` });
  }
});

router.post('/report', async (req: Request, res: Response) => {
  try {
    const { filename, similarity, matches, originalText, fixedContent, changesApplied } = req.body;
    const docDefinition = buildReportPdf(filename, similarity, matches, originalText, fixedContent, changesApplied);
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };
    const printer = new (PDFDocument as any)(fonts);
    const chunks: Buffer[] = [];

    const doc = printer.createPdfKitDocument(docDefinition);
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const result = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${(filename || 'document').replace(/\.[^.]+$/, '')}-plagiarism-report.pdf"`);
      res.send(result);
    });
    doc.end();
  } catch (error: any) {
    res.status(500).json({ success: false, error: `Report generation failed: ${error.message}` });
  }
});

function buildDocx(content: string, matches?: Match[], originalText?: string): any {
  const paragraphs: any[] = [];

  paragraphs.push(new Paragraph({
    text: 'Plagiarism Checker & Fix Assistant - Document',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER
  }));
  paragraphs.push(new Paragraph({ text: '' }));

  if (matches && matches.length > 0) {
    paragraphs.push(new Paragraph({ text: 'Plagiarism Report Summary', heading: HeadingLevel.HEADING_2 }));
    paragraphs.push(new Paragraph({ text: `Total Matches Found: ${matches.length}` }));
    paragraphs.push(new Paragraph({ text: `Date: ${new Date().toLocaleDateString() }` }));
    paragraphs.push(new Paragraph({ text: '' }));

    paragraphs.push(new Paragraph({ text: 'Flagged Matches:', heading: HeadingLevel.HEADING_3 }));
    matches.forEach((match, idx) => {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${idx + 1}. `, bold: true }),
          new TextRun({ text: `"${match.text.substring(0, 100)}${match.text.length > 100 ? '...' : ''}"` }),
          new TextRun({ text: ` — Source: ${match.source}, Confidence: ${match.confidence}%`, italics: true })
        ]
      }));
    });
    paragraphs.push(new Paragraph({ text: '' }));

    paragraphs.push(new Paragraph({ text: 'Corrected Content:', heading: HeadingLevel.HEADING_2 }));
    paragraphs.push(new Paragraph({ text: '' }));
  }

  content.split('\n').forEach(line => {
    if (line.trim().length > 0) {
      paragraphs.push(new Paragraph({ text: line, spacing: { after: 120 } }));
    } else {
      paragraphs.push(new Paragraph({ text: '' }));
    }
  });

  return new Document({ sections: [{ children: paragraphs }] });
}

function buildPdf(content: string, matches?: Match[], originalText?: string): any {
  const contentBlocks: any[] = [];

  contentBlocks.push({ text: 'Plagiarism Checker & Fix Assistant', style: 'header', alignment: 'center' });
  contentBlocks.push({ text: '' });

  if (matches && matches.length > 0) {
    contentBlocks.push({ text: 'Plagiarism Report Summary', style: 'subheader' });
    contentBlocks.push({ text: `Total Matches: ${matches.length}` });
    contentBlocks.push({ text: `Date: ${new Date().toLocaleDateString() }` });
    contentBlocks.push({ text: '' });

    contentBlocks.push({ text: 'Flagged Matches:', style: 'subheader' });
    matches.forEach((match, idx) => {
      contentBlocks.push({
        text: [
          { text: `${idx + 1}. `, bold: true },
          { text: `"${match.text.substring(0, 100)}${match.text.length > 100 ? '...' : ''}"` },
          { text: ` — ${match.source} (${match.confidence}%)`, italics: true, fontSize: 9 }
        ],
        margin: [0, 0, 0, 5]
      });
    });
    contentBlocks.push({ text: '' });

    contentBlocks.push({ text: 'Corrected Content:', style: 'subheader' });
    contentBlocks.push({ text: '' });
  }

  content.split('\n').forEach(line => {
    if (line.trim().length > 0) {
      contentBlocks.push({ text: line, margin: [0, 0, 0, 8] });
    }
  });

  return {
    content: contentBlocks,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
    },
    defaultStyle: { fontSize: 11 }
  };
}

function buildReportPdf(
  filename: string,
  similarity: number,
  matches: Match[],
  originalText: string,
  fixedContent: string,
  changesApplied: number
): any {
  const contentBlocks: any[] = [];

  contentBlocks.push({ text: 'Plagiarism Analysis Report', style: 'header', alignment: 'center' });
  contentBlocks.push({ text: `Generated: ${new Date().toLocaleString()}`, alignment: 'center', italics: true });
  contentBlocks.push({ text: '' });

  contentBlocks.push({ text: 'Summary', style: 'subheader' });
  contentBlocks.push({ text: `Document: ${filename || 'Untitled'}` });
  contentBlocks.push({ text: `Overall Similarity: ${similarity}%` });
  contentBlocks.push({ text: `Total Matches Found: ${matches.length}` });
  contentBlocks.push({ text: `Changes Applied: ${changesApplied || 0}` });

  const riskColor = similarity >= 30 ? '#dc2626' : similarity >= 15 ? '#d97706' : '#16a34a';
  const riskLevel = similarity >= 30 ? 'HIGH RISK' : similarity >= 15 ? 'MODERATE RISK' : 'LOW RISK';
  contentBlocks.push({ text: `Risk Level: ${riskLevel}`, color: riskColor, bold: true });
  contentBlocks.push({ text: '' });

  if (matches.length > 0) {
    contentBlocks.push({ text: 'Detected Matches', style: 'subheader' });
    matches.forEach((match, idx) => {
      contentBlocks.push({ text: `${idx + 1}. [${match.confidence}% confidence]`, bold: true, margin: [0, 8, 0, 2] });
      contentBlocks.push({
        text: `Matched Text: "${match.text.substring(0, 200)}${match.text.length > 200 ? '...' : ''}"`,
        margin: [10, 0, 0, 2],
        fontSize: 10
      });
      contentBlocks.push({ text: `Source: ${match.source}`, margin: [10, 0, 0, 2], fontSize: 10, italics: true });
      if (match.suggestions && match.suggestions.length > 0) {
        contentBlocks.push({
          text: `Suggested Fix: ${match.suggestions[0].substring(0, 200)}`,
          margin: [10, 0, 0, 8],
          fontSize: 10,
          color: '#2563eb'
        });
      } else {
        contentBlocks.push({ text: '', margin: [0, 0, 0, 6] });
      }
    });
  }

  contentBlocks.push({ text: '' });
  contentBlocks.push({ text: 'Sources Cited', style: 'subheader' });
  const uniqueSources = [...new Set(matches.map(m => m.source))];
  if (uniqueSources.length > 0) {
    uniqueSources.forEach((source, idx) => {
      contentBlocks.push({ text: `${idx + 1}. ${source}`, margin: [0, 0, 0, 4] });
    });
  } else {
    contentBlocks.push({ text: 'No external sources detected.' });
  }

  contentBlocks.push({ text: '' });
  contentBlocks.push({ text: 'Methodology', style: 'subheader' });
  contentBlocks.push({ text: 'This analysis used n-gram matching (n=5), cosine similarity, and string comparison against the local corpus and web sources (if enabled).' });

  if (fixedContent && changesApplied > 0) {
    contentBlocks.push({ text: '' });
    contentBlocks.push({ text: 'Corrected Document', style: 'subheader' });
    contentBlocks.push({ text: '' });
    fixedContent.split('\n').forEach(line => {
      if (line.trim()) contentBlocks.push({ text: line, margin: [0, 0, 0, 6] });
    });
  }

  return {
    content: contentBlocks,
    styles: {
      header: { fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] }
    },
    defaultStyle: { fontSize: 11 }
  };
}

export default router;
