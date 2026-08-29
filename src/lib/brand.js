import QRCode from "qrcode";

export const BRAND_PRESETS = [
  "#077E42",
  "#b91c1c",
  "#b45309",
  "#e8ba22ff",
  "#15803d",
  "#1d4ed8",
  "#6d28d9",
  "#000000ff",
];

const PAPER = "#fdfbf7";

function hexToRgb(hex) {
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
export function isLightColor(hex) {
  try {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
  } catch {
    return false;
  }
}

/** Inline CSS variables that re-theme the design system to an owner's brand colour. */
export function brandStyle(hex) {
  return {
    "--primary": hex,
    "--ring": hex,
    "--primary-foreground": isLightColor(hex) ? "#2a231e" : PAPER,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Renders a QR code in the owner's brand colour, with their logo punched into the middle. */
export async function makeQrDataUrl(value, { color, logoUrl, size = 720 }) {
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
export function printPoster(opts) {
  const w = window.open("", "_blank", "width=820,height=1100");
  if (!w) return false;
  const esc = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(opts.businessName)} — scan to join the queue</title>
<style>
  @page { margin: 16mm; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; background:${PAPER}; color:#2a231e;
    text-align:center; padding:48px 32px; margin:0; }
  .logo { max-height:90px; max-width:260px; object-fit:contain; margin-bottom:24px; }
  h1 { font-size:44px; margin:0 0 8px; letter-spacing:-0.02em; }
  .address { font-size:17px; margin:0 0 16px; color:#78695d; }
  p.msg { font-size:22px; margin:0 0 32px; color:#6b5b50; }
  .qr { border:2px dashed #d9cec2; border-radius:24px; padding:20px; display:inline-block; }
  img.qr-img { width:380px; height:380px; display:block; }
  .step { font-size:20px; margin-top:28px; color:${opts.color}; font-weight:700; }
  .url { margin-top:10px; font-size:13px; color:#8a7a6d; word-break:break-all; }
</style></head><body>
${opts.logoUrl ? `<img class="logo" src="${esc(opts.logoUrl)}" alt="">` : ""}
<h1>${esc(opts.businessName)}</h1>
${opts.address ? `<div class="address">📍 ${esc(opts.address)}</div>` : ""}
<p class="msg">${esc(opts.message)}</p>
<div class="qr"><img class="qr-img" src="${opts.qrDataUrl}" alt="QR code"></div>
<div class="step">Scan with your phone camera to take a number</div>
<div class="url">${esc(opts.joinUrl)}</div>
<script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
</body></html>`);
  w.document.close();
  return true;
}
