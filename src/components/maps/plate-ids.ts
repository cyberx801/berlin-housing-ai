/** Ids inside a plate. Every plate gets its own prefix: hidden routes stay mounted (D-027). */
export const plateIds = (prefix: string) => ({
  title: `${prefix}-title`,
  desc: `${prefix}-desc`,
  ortsteil: (code: string) => `${prefix}-o-${code}`,
  borders: `${prefix}-borders`,
  ring: `${prefix}-ring`,
  ringMask: `${prefix}-ring-mask`,
});
