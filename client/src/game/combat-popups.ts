/**
 * Combat Popups — Pixel Gothic font + damage/heal floating text helpers
 *
 * Provides:
 *   - PIXEL_GOTHIC: canvas font stack using the Craftpix pixel gothic OTF
 *   - ensurePixelGothicLoaded(): loads the font for canvas programmatically
 *   - pixelFont(size): returns `${size}px PixelGothic, 'Courier New', monospace`
 *
 * Usage in canvas render functions:
 *   ctx.font = pixelFont(14);
 */

// ── Font stack ─────────────────────────────────────────────────

/** Full font stack: PixelGothic with monospace fallbacks */
export const PIXEL_GOTHIC = "'PixelGothic', 'Courier New', monospace";

/** Returns a ready-to-use canvas font string at the given pixel size */
export function pixelFont(size: number, bold = false): string {
  return bold
    ? `bold ${size}px 'PixelGothic', 'Courier New', monospace`
    : `${size}px 'PixelGothic', 'Courier New', monospace`;
}

// ── FontFace loader for canvas ─────────────────────────────────

let _fontLoaded = false;
let _fontLoadPromise: Promise<void> | null = null;

/**
 * Programmatically loads PixelGothic so canvas can use it immediately.
 * Safe to call multiple times — only loads once.
 * The CSS @font-face in index.css handles HTML elements.
 */
export function ensurePixelGothicLoaded(): Promise<void> {
  if (_fontLoaded) return Promise.resolve();
  if (_fontLoadPromise) return _fontLoadPromise;

  _fontLoadPromise = (async () => {
    try {
      const face = new FontFace(
        'PixelGothic',
        "url('/fonts/StraightPixelGothic.otf')",
        { weight: 'normal', style: 'normal' },
      );
      const loaded = await face.load();
      (document.fonts as FontFaceSet).add(loaded);
      _fontLoaded = true;
    } catch {
      // Font unavailable — canvas will fall back to Courier New
      _fontLoaded = true;
    }
  })();

  return _fontLoadPromise;
}

// ── Event banner GIF paths ─────────────────────────────────────

export const EVENT_BANNERS = {
  gameOver:     '/assets/animated-text/GameOver.gif',
  youLose:      '/assets/animated-text/YouLose.gif',
  victory:      '/assets/animated-text/Victory.gif',
  stageCleared: '/assets/animated-text/StageCleared.gif',
  stageFailed:  '/assets/animated-text/StageFailed.gif',
  getReady:     '/assets/animated-text/GetReady.gif',
  letsGo:       '/assets/animated-text/LetsGo.gif',
  finish:       '/assets/animated-text/Finish.gif',
  countDown:    '/assets/animated-text/CountDown.gif',
} as const;

export type EventBannerKey = keyof typeof EVENT_BANNERS;
