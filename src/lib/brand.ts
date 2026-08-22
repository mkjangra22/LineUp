import QRCode from "qrcode";

export const BRAND_PRESETS = [
  "#c05621",
  "#b91c1c",
  "#b45309",
  "#15803d",
  "#0f766e",
  "#1d4ed8",
  "#6d28d9",
  "#3a2f28",
];

const PAPER = "#fdfbf7";

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Relative luminance — used to pick readable text on top of the brand colour. */
export function isLightColor(hex: string) {
  try {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
  } catch {
    return false;
  }
}

/** Inline CSS variables that re-theme the design system to an owner's brand colour. */
export function brandStyle(hex: string): React.CSSProperties {
  return {
    ["--primary" as string]: hex,
    ["--ring" as string]: hex,
    ["--primary-foreground" as string]: isLightColor(hex) ? "#2a231e" : PAPER,
  };
}

export type QrOptions = {
  color: string;
  logoUrl?: string | null;
  size?: number;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders a QR code in the owner's brand colour, with their logo punched into the middle. */
export async function makeQrDataUrl(
  value: string,
  { color, logoUrl, size = 720 }: QrOptions,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, value, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: color, light: PAPER },
  });

  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const box = Math.round(size * 0.22);
        const pad = Math.round(box * 0.16);
        const x = (size - box) / 2;
        const y = (size - box) / 2;

        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.roundRect(x - pad, y - pad, box + pad * 2, box + pad * 2, box * 0.22);
        ctx.fill();

        const ratio = Math.min(box / img.width, box / img.height);
        const w = img.width * ratio;
        const h = img.height * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      }
    } catch {
      // A broken logo should never stop the QR code from rendering.
    }
  }

  return canvas.toDataURL("image/png");
}

/** Opens a print-ready poster in a new tab. */
export function printPoster(opts: {
  businessName: string;
  message: string;
  qrDataUrl: string;
  logoUrl?: string | null;
  color: string;
  joinUrl: string;
}) {
  const w = window.open("", "_blank", "width=820,height=1100");
  if (!w) return false;
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(opts.businessName)} — scan to join the queue</title>
<style>
  @page { margin: 16mm; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; background:${PAPER}; color:#2a231e;
    text-align:center; padding:48px 32px; margin:0; }
  .logo { max-height:90px; max-width:260px; object-fit:contain; margin-bottom:24px; }
  h1 { font-size:44px; margin:0 0 8px; letter-spacing:-0.02em; }
  p.msg { font-size:22px; margin:0 0 32px; color:#6b5b50; }
  .qr { border:2px dashed #d9cec2; border-radius:24px; padding:20px; display:inline-block; }
  img.qr-img { width:380px; height:380px; display:block; }
  .step { font-size:20px; margin-top:28px; color:${opts.color}; font-weight:700; }
  .url { margin-top:10px; font-size:13px; color:#8a7a6d; word-break:break-all; }
</style></head><body>
${opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="">` : ""}
<h1>${esc(opts.businessName)}</h1>
<p class="msg">${esc(opts.message)}</p>
<div class="qr"><img class="qr-img" src="${opts.qrDataUrl}" alt="QR code"></div>
<div class="step">Scan with your phone camera to take a number</div>
<div class="url">${esc(opts.joinUrl)}</div>
<script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
</body></html>`);
  w.document.close();
  return true;
}
