import { Platform } from "react-native";

export const COLORS = {
  bg: "#f7f8fa",
  surface: "#ffffff",
  surfaceSoft: "#fbfcfe",
  border: "#e5e8ee",
  text: "#0b1220",
  textSoft: "#4a5468",
  textMuted: "#7b8597",
  accent: "#2563eb",
  accentSoft: "#eff4ff",
  success: "#16a34a",
  successSoft: "#ecfdf3",
  warning: "#d97706",
  warningSoft: "#fff7ed",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  high: "#dc2626",
  highSoft: "#fef2f2",
  medium: "#d97706",
  mediumSoft: "#fff7ed",
  low: "#0891b2",
  lowSoft: "#ecfeff",
  todo: "#64748b",
  progress: "#2563eb",
  review: "#7c3aed",
  done: "#16a34a"
};

export const SHADOW = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.06,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4
};

export const SIZES = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22
};

export const FONT = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System"
});

export const AVATAR_COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c",
  "#16a34a", "#0891b2", "#9333ea", "#e11d48",
  "#0d9488", "#ca8a04", "#4f46e5", "#dc2626"
];
