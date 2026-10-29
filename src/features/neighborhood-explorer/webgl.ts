/**
 * MapLibre 6 draws with WebGL2 only. This is checked on a throwaway canvas before the map
 * module is requested, so a browser that can't run it never downloads it (D-038).
 */
export function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
