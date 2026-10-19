import { FrameType } from '@prisma/client';

// petty-cash-ui sends/expects the hyphenated form (matches the schema's @map'd DB
// values, e.g. settings/index.vue's frameTypeOptions), but Prisma's generated
// client only accepts/returns the underscored enum member names. Translate
// at the API boundary so the wire contract matches the frontend, not Prisma.
export const FRAME_TYPE_WIRE_TO_PRISMA: Record<string, FrameType> = {
  'bottom-label': FrameType.bottom_label,
  'top-header': FrameType.top_header,
  border: FrameType.border,
  'card-box': FrameType.card_box,
  'custom-upload': FrameType.custom_upload,
};

export const FRAME_TYPE_PRISMA_TO_WIRE: Record<FrameType, string> = {
  [FrameType.bottom_label]: 'bottom-label',
  [FrameType.top_header]: 'top-header',
  [FrameType.border]: 'border',
  [FrameType.card_box]: 'card-box',
  [FrameType.custom_upload]: 'custom-upload',
};

export const FRAME_TYPE_WIRE_VALUES = Object.keys(
  FRAME_TYPE_WIRE_TO_PRISMA,
) as [string, ...string[]];
