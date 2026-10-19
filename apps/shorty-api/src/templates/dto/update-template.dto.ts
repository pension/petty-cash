import { createZodDto } from 'nestjs-zod';
import { CreateTemplateSchema } from './create-template.dto';

export const UpdateTemplateSchema = CreateTemplateSchema.partial();

export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}
