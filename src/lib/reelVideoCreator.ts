// Client-side reel video utilities
// FFmpeg WASM removed — stitching now handled by creatomate-stitch (cloud) or canvasStitch (fallback)

export function downloadVideo(blob: Blob, filename: string = 'reel.mp4') {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
