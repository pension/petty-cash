declare module 'html2pdf.js' {
  interface Worker {
    set(options: Record<string, unknown>): Worker;
    from(source: string, type: string): Worker;
    outputPdf(type: 'blob'): Promise<Blob>;
  }
  export default function html2pdf(): Worker;
}
