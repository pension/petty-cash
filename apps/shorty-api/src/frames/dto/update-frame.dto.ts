import { createZodDto } from 'nestjs-zod';
import { CreateFrameSchema } from './create-frame.dto';

export const UpdateFrameSchema = CreateFrameSchema.partial();

export class UpdateFrameDto extends createZodDto(UpdateFrameSchema) {}
