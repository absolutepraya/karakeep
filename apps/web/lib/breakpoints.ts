// Tailwind's default screen breakpoints (px). Previously read at runtime via
// tailwindcss/resolveConfig, which Tailwind v4 removed. The masonry grid only
// needs sm/md/lg to decide column counts.
export const SCREENS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;
