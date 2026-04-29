import { AVATAR_COLORS } from "./theme";
import type { Priority, Status } from "./types";

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const dayOffset = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const initials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const formatDue = (iso?: string | null) => {
  if (!iso) return "No due date";
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0 && diff > -7) return `${Math.abs(diff)}d overdue`;
  if (diff > 0 && diff < 7) return `In ${diff}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const formatRelTime = (ts: string) => {
  const normalized = /(?:z|[+-]\d{2}:\d{2})$/i.test(ts) ? ts : `${ts}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff <= 43200) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

export const nowTimestamp = () => new Date().toISOString();

export const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done"
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

export const STATUS_ORDER: Status[] = ["todo", "in-progress", "review", "done"];
export const ACTIVE_STATUSES: Status[] = ["todo", "in-progress", "review"];

export const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
