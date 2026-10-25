import { PDFDocument, PageSizes, rgb } from 'pdf-lib';
import type { ExpenseItem } from '~/types/pettyCash';

async function imagePng(blob: Blob): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(blob);
  try {
    // Browser decoding applies photo orientation and supports WebP as well as JPEG/PNG.
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 3508 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image rendering is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Image conversion failed.')), 'image/png');
    });
    canvas.width = canvas.height = 0;
    return png.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function receiptImages(blob: Blob, contentType: string) {
  if (contentType === 'image/heic' || contentType === 'image/heif') {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob, toType: 'image/png', multiple: true });
    return Array.isArray(converted) ? converted : [converted];
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Unsupported receipt format.');
  }
  return [blob];
}

/** Append visible receipt pages in expense order; never return an incomplete voucher. */
export async function appendReceiptPdfs(
  voucher: Blob,
  expenses: ExpenseItem[],
  loadReceipt: (fileId: string) => Promise<Blob>,
): Promise<Blob> {
  const attachments = expenses.filter((expense) => expense.fileId);
  if (!attachments.length) return voucher;

  const pdf = await PDFDocument.load(await voucher.arrayBuffer());
  // Process one file at a time rather than decoding every full-size receipt at once.
  for (const [index, expense] of attachments.entries()) {
    try {
      const blob = await loadReceipt(expense.fileId!);
      const contentType = (expense.receiptContentType || blob.type).split(';')[0]!.toLowerCase();
      if (contentType === 'application/pdf') {
        const receipt = await PDFDocument.load(await blob.arrayBuffer());
        if (!receipt.getPageCount()) throw new Error('The attached PDF has no pages.');
        // Preserve filled form appearances when copying pages into the voucher.
        if (receipt.getForm().getFields().length) {
          receipt.getForm().flatten();
          // pdf-lib can leave references to deleted widgets after flattening.
          for (const page of receipt.getPages()) {
            const annotations = page.node.Annots();
            for (let i = (annotations?.size() ?? 0) - 1; i >= 0; i--) {
              if (!receipt.context.lookup(annotations!.get(i))) annotations!.remove(i);
            }
          }
        }
        const pages = await pdf.copyPages(receipt, receipt.getPageIndices());
        pages.forEach((page) => pdf.addPage(page));
      } else {
        for (const image of await receiptImages(blob, contentType)) {
          const embedded = await pdf.embedPng(await imagePng(image));
          const page = pdf.addPage(PageSizes.A4);
          const { width, height } = page.getSize();
          const margin = 34;
          const size = embedded.scaleToFit(width - margin * 2, height - margin * 2 - 24);
          page.drawText(`Receipt attachment ${index + 1}`, {
            x: margin, y: height - margin - 10, size: 10, color: rgb(0.39, 0.45, 0.55),
          });
          page.drawImage(embedded, {
            x: (width - size.width) / 2,
            y: margin + (height - margin * 2 - 24 - size.height) / 2,
            ...size,
          });
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The attachment could not be read.';
      throw new Error(`Could not include receipt "${expense.receiptFileName || expense.fileId}" in the Petty Cash PDF. ${reason}`, { cause: error });
    }
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
