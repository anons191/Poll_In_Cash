// OCR and OpenAI parsing utilities
// This will be implemented in future iterations

export type OCRResult = {
  text: string;
  confidence: number;
  provider: string;
};

export type ParsedReceipt = {
  merchant: string;
  items: Array<{ name: string; price: number }>;
  total: number;
  date?: string;
};

export async function performOCR(imageUrl: string): Promise<OCRResult> {
  // Stub - to be implemented
  throw new Error("OCR functionality not yet implemented");
}

export async function parseReceipt(ocrResult: OCRResult): Promise<ParsedReceipt> {
  // Stub - to be implemented
  throw new Error("Receipt parsing not yet implemented");
}
