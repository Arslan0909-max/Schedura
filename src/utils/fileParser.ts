import * as XLSX from 'xlsx';
import { AttachmentFile } from '../types/timetable';

export async function processUploadedFile(file: File): Promise<AttachmentFile> {
  const id = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fileName = file.name;
  const fileSize = file.size;
  const mimeType = file.type || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let fileCategory: AttachmentFile['type'] = 'document';
  let dataUrl: string | undefined = undefined;
  let extractedText: string | undefined = undefined;

  // 1. Image Files
  if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    fileCategory = 'image';
    dataUrl = await readFileAsDataURL(file);
    extractedText = `[Attached Image File: ${fileName} (${Math.round(fileSize / 1024)} KB)]`;
  }
  // 2. Spreadsheet Files (Excel .xlsx, .xls, .csv, Google Sheets exports)
  else if (
    ['xlsx', 'xls', 'csv'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  ) {
    fileCategory = 'spreadsheet';
    dataUrl = await readFileAsDataURL(file);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      let sheetText = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        sheetText += `--- SHEET: ${sheetName} ---\n${csvData}\n\n`;
      });

      extractedText = sheetText.trim() || `[Excel file ${fileName} parsed]`;
    } catch (e) {
      console.warn('Excel parse fallback to text reader:', e);
      extractedText = await readFileAsText(file);
    }
  }
  // 3. Text, Markdown, Notes, JSON Files
  else if (['txt', 'md', 'json', 'log'].includes(ext) || mimeType.startsWith('text/')) {
    fileCategory = 'text';
    dataUrl = await readFileAsDataURL(file);
    extractedText = await readFileAsText(file);
  }
  // 4. PDF Files
  else if (ext === 'pdf' || mimeType.includes('pdf')) {
    fileCategory = 'pdf';
    dataUrl = await readFileAsDataURL(file);
    // Read plain text snippet if accessible
    try {
      const rawText = await readFileAsText(file);
      // Clean non-printable chars from binary pdf
      const printable = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').substring(0, 4000);
      extractedText = `[PDF Document: ${fileName}]\n${printable}`;
    } catch {
      extractedText = `[PDF Document attached: ${fileName} (${Math.round(fileSize / 1024)} KB)]`;
    }
  }
  // 5. General Office / Word / Note Documents
  else {
    fileCategory = 'document';
    dataUrl = await readFileAsDataURL(file);
    try {
      extractedText = await readFileAsText(file);
    } catch {
      extractedText = `[Document File attached: ${fileName} (${Math.round(fileSize / 1024)} KB)]`;
    }
  }

  return {
    id,
    name: fileName,
    size: fileSize,
    type: fileCategory,
    mimeType: mimeType || 'application/octet-stream',
    dataUrl,
    extractedText,
  };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
