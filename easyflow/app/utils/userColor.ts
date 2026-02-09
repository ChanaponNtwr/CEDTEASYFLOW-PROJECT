const COLORS = [
  "#5B8DEF", // blue
  "#6A5ACD", // slate blue
  "#9B59B6", // purple
  "#1ABC9C", // teal
  "#3498DB", // sky
  "#E67E22", // orange
  "#E84393", // pink
];

export function getUserBannerColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const color = COLORS[Math.abs(hash) % COLORS.length];
  return color + "73"; // opacity ~45%
}
