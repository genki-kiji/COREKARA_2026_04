function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");

  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function mixRgb(from, to, t) {
  return {
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  };
}

function getCssPixelValue(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Signed distance to a rounded rectangle.
 *
 * 戻り値:
 *   負数: 角丸矩形の内側
 *   0   : 境界線上
 *   正数: 角丸矩形の外側
 */
function signedDistanceRoundedRect(px, py, x, y, width, height, radius) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const qx = Math.abs(px - centerX) - (halfWidth - radius);
  const qy = Math.abs(py - centerY) - (halfHeight - radius);

  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);

  const outsideDistance = Math.hypot(outsideX, outsideY);
  const insideDistance = Math.min(Math.max(qx, qy), 0);

  return outsideDistance + insideDistance - radius;
}

function drawInnerOuterBorder(element) {
  const canvas = element.querySelector(".io-border__canvas");

  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const rect = element.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const styles = getComputedStyle(element);

  const borderWidth =
    getCssPixelValue(styles.getPropertyValue("--io-border-width")) || 12;

  const outerRadius =
    getCssPixelValue(styles.getPropertyValue("--io-border-radius")) || 16;

  const innerRadius = Math.max(0, outerRadius - borderWidth);

  const dpr = window.devicePixelRatio || 1;

  const cssWidth = rect.width;
  const cssHeight = rect.height;

  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  const innerColor = hexToRgb("#ef4444");
  const outerColor = hexToRgb("#ffffff");

  const image = ctx.createImageData(pixelWidth, pixelHeight);
  const data = image.data;

  for (let y = 0; y < pixelHeight; y += 1) {
    for (let x = 0; x < pixelWidth; x += 1) {
      const cssX = (x + 0.5) / dpr;
      const cssY = (y + 0.5) / dpr;

      const outerDistance = signedDistanceRoundedRect(
        cssX,
        cssY,
        0,
        0,
        cssWidth,
        cssHeight,
        outerRadius,
      );

      const innerDistance = signedDistanceRoundedRect(
        cssX,
        cssY,
        borderWidth,
        borderWidth,
        cssWidth - borderWidth * 2,
        cssHeight - borderWidth * 2,
        innerRadius,
      );

      const index = (y * pixelWidth + x) * 4;

      const insideOuter = outerDistance <= 0;
      const outsideInner = innerDistance >= 0;

      if (!insideOuter || !outsideInner) {
        data[index + 3] = 0;
        continue;
      }

      /*
       * ここが本体。
       *
       * innerDistance は、内側境界から外側へ向かう距離。
       * borderWidth で割ることで、0〜1 の比率にする。
       *
       * 0: 内側境界
       * 1: 外側境界
       */
      const ratio = clamp(innerDistance / borderWidth, 0, 1);
      const color = mixRgb(innerColor, outerColor, ratio);

      /*
       * 境界を少しだけアンチエイリアスする。
       */
      const outerAlpha = 1 - smoothstep(-0.75, 0.75, outerDistance);
      const innerAlpha = smoothstep(-0.75, 0.75, innerDistance);
      const alpha = outerAlpha * innerAlpha;

      data[index] = color.r;
      data[index + 1] = color.g;
      data[index + 2] = color.b;
      data[index + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
}

export function setupInnerOuterGradientBorders() {
  const elements = Array.from(document.querySelectorAll(".io-border"));

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      requestAnimationFrame(() => {
        drawInnerOuterBorder(entry.target);
      });
    }
  });

  for (const element of elements) {
    resizeObserver.observe(element);
    drawInnerOuterBorder(element);
  }
}
