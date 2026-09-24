import { Router, Request, Response } from 'express';
import * as docxLib from 'docx';
import PDFDocument from 'pdfmake';
import { Match } from '../types';

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docxLib as any;

const router = Router();

// Modify original DOCX or PDF file with fixes applied
router.post('/modify', async (req: Request, res: Response) => {
  try {
    const { type, content, filename, fixedContent, originalText, matches, originalFileBase64 } = req.body;

    if (!fixedContent && !content) {
      res.status(400).json({ success: false, error: 'Fixed content is required' });
      return;
    }

    const docContent = fixedContent || content;
    const baseName = (filename || 'document').replace(/\.[^.]+$/, '');

    if (type === 'docx') {
      const doc = buildDocx(docContent, true, matches || [], originalText);
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}-fixed.docx"`);
      res.send(Buffer.from(buffer));
      return;
    }

    if (type === 'pdf') {
      const docDefinition = buildPdf(docContent, true, matches || [], originalText);
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
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}-fixed.pdf"`);
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
      const doc = buildDocx(docContent, includeReport, matches, originalText);
      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}-fixed.docx"`);
      res.send(Buffer.from(buffer));
      return;
    }

    if (type === 'pdf') {
      const docDefinition = buildPdf(docContent, includeReport, matches, originalText);
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
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}-fixed.pdf"`);
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

function buildDocx(content: string, includeReport?: boolean, matches?: Match[], originalText?: string): any {
  const paragraphs: any[] = [];

  paragraphs.push(new Paragraph({
    text: 'Plagiarism Checker & Fix Assistant - Document',
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER
  }));
  paragraphs.push(new Paragraph({ text: '' }));

  if (includeReport && matches) {
    paragraphs.push(new Paragraph({ text: 'Plagiarism Report Summary', heading: HeadingLevel.HEADING_2 }));
    paragraphs.push(new Paragraph({ text: `Total Matches Found: ${matches.length}` }));
    paragraphs.push(new Paragraph({ text: `Date: ${new Date().toLocaleDateString() }` }));
    paragraphs.push(new Paragraph({ text: '' }));

    if (matches.length > 0) {
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
    }

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

function buildPdf(content: string, includeReport?: boolean, matches?: Match[], originalText?: string): any {
  const contentBlocks: any[] = [];

  contentBlocks.push({ text: 'Plagiarism Checker & Fix Assistant', style: 'header', alignment: 'center' });
  contentBlocks.push({ text: '' });

  if (includeReport && matches) {
    contentBlocks.push({ text: 'Plagiarism Report Summary', style: 'subheader' });
    contentBlocks.push({ text: `Total Matches: ${matches.length}` });
    contentBlocks.push({ text: `Date: ${new Date().toLocaleDateString() }` });
    contentBlocks.push({ text: '' });

    if (matches.length > 0) {
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
    }

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
