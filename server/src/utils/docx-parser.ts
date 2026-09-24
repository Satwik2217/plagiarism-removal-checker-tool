import mammoth from 'mammoth';

export class DocxParseUtil {
  static async parse(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text could be extracted from the document');
      }
      return result.value;
    } catch (error: any) {
      if (error.message?.includes('No text')) {
        throw error;
      }
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }
}