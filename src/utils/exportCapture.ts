export interface ExportCaptureSize {
  width: number;
  height: number;
}

interface ExportCaptureMetrics {
  scrollWidth: number;
  clientWidth: number;
  rectWidth: number;
  scrollHeight: number;
  clientHeight: number;
  rectHeight: number;
}

export const resolveExportCaptureSize = ({
  scrollWidth,
  clientWidth,
  rectWidth,
  scrollHeight,
  clientHeight,
  rectHeight,
}: ExportCaptureMetrics): ExportCaptureSize => {
  const width = Math.max(1, Math.ceil(scrollWidth || 0), Math.ceil(clientWidth || 0), Math.ceil(rectWidth || 0));
  const height = Math.max(1, Math.ceil(scrollHeight || 0), Math.ceil(clientHeight || 0), Math.ceil(rectHeight || 0));
  return { width, height };
};

export const getExportCaptureSize = (
  node: Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollHeight' | 'clientHeight' | 'getBoundingClientRect'>
): ExportCaptureSize => {
  const rect = node.getBoundingClientRect();
  return resolveExportCaptureSize({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    rectWidth: rect.width,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    rectHeight: rect.height,
  });
};
