/** Returns true when a WebGL2 (or WebGL1) context can be created. Never throws. */
export function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Whether a small screen should open on the 3D dock map rather than the flat plan (T29, PRD F19). Capable means:
 * a WebGL2 context the browser will give WITHOUT a major performance caveat, a renderer that is not a software
 * rasteriser (SwiftShader, llvmpipe… — Chromium does not always set the caveat for them), no Save-Data request,
 * and at least 4 GB of device memory where the browser reports it. Everything else keeps the plan, which stays
 * the accessibility and low-power fallback.
 *
 * `?debug&gpu=capable|low` overrides the probe for tests and QA (headless browsers render in software).
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|lavapipe/i;

export function gpuCapable(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.has('debug') && q.get('gpu') === 'capable') return true;
  if (q.has('debug') && q.get('gpu') === 'low') return false;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData === true) return false;
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}
