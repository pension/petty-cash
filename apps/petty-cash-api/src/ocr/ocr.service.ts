import { Injectable, NotImplementedException, ServiceUnavailableException } from '@nestjs/common';
import type { Actor } from '../auth/actor';
import { parse } from '../common/validation';
import { FilesService } from '../files/files.service';
import { ReceiptExtractionSchema } from './dto/receipt-extraction.dto';
import { GeminiReceiptService } from './gemini-receipt.service';
@Injectable()
export class OcrService {
  constructor(
    private readonly files: FilesService,
    private readonly gemini: GeminiReceiptService,
  ) {}
  async receipt(body: unknown, actor: Actor) {
    const input = parse(ReceiptExtractionSchema, body);
    const ids = 'fileIds' in input ? input.fileIds : [input.fileId];
    // Authorize every attachment before sending any bytes to the provider.
    const files = await Promise.all(ids.map((id) => this.files.forExtraction(id, actor)));
    if (!process.env.GEMINI_API_KEY?.trim())
      throw new NotImplementedException(
        'AI extraction is not configured. Enter the receipt details manually.',
      );
    try {
      if ('fileIds' in input) {
        const results = await this.gemini.extractMany(files);
        return { receipts: results.map((result, index) => ({ fileId: ids[index], ...result })) };
      }
      return await this.gemini.extract(files[0]);
    } catch {
      throw new ServiceUnavailableException(
        'AI could not read this receipt. Enter the details manually or retry.',
      );
    }
  }
}
