/**
 * `slug` must start with a letter — the same constraint the invitation site's route carries.
 * Its own file, with no imports, so vite.config.ts can use it too.
 */
export const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/
