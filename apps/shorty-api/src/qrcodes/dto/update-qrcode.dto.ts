import { createZodDto } from 'nestjs-zod';
import { CreateQRCodeSchema } from './create-qrcode.dto';

export const UpdateQRCodeSchema = CreateQRCodeSchema.partial();

export class UpdateQRCodeDto extends createZodDto(UpdateQRCodeSchema) {}
