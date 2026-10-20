import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { FilesModule } from '../files/files.module';
import { GeminiReceiptService } from './gemini-receipt.service';
@Module({
  imports: [AuthModule, CommonModule, FilesModule],
  controllers: [OcrController],
  providers: [OcrService, GeminiReceiptService],
  exports: [OcrService],
})
export class OcrModule {}
