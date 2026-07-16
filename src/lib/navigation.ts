/**
 * Single source of truth for app navigation (GF-PR1).
 *
 * AppSidebar, TopBar and CommandPalette all render from this registry, so a
 * nav entry cannot exist without a real route — the "dead click" class of bug
 * (hash anchors, label-only rows) is structurally impossible. shell.spec.ts
 * iterates this list end-to-end in a real browser.
 *
 * Stub pages built on deterministic demo data (/capabilities, /audit-factory)
 * are deliberately NOT here: they stay reachable via the command palette with
 * a "(preview)" label, but never from primary navigation.
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Boxes,
  BrainCircuit,
  FileText,
  Gem,
  LineChart,
  Network,
  Newspaper,
  NotebookPen,
  Puzzle,
  Radar,
  ScrollText,
  Settings,
  Sparkles,
} from "lucide-react";

export interface NavEntry {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: readonly NavEntry[] = [
  {
    to: "/",
    label: "Chat",
    description: "Type the demand — the platform routes it",
    icon: BrainCircuit,
  },
  {
    to: "/observability",
    label: "Work",
    description: "Fleet health and tool telemetry",
    icon: Radar,
  },
];

export const LIBRARY_NAV: readonly NavEntry[] = [
  { to: "/graph", label: "Graph", description: "Readback map, not write authority", icon: Network },
  {
    to: "/engagements",
    label: "Missions",
    description: "Client context and active work",
    icon: Boxes,
  },
  {
    to: "/deliverable",
    label: "Evidence",
    description: "Artifacts, proof and handoff",
    icon: FileText,
  },
  { to: "/patterns", label: "Playbooks", description: "Reusable WDC patterns", icon: BookOpen },
  {
    to: "/consulting",
    label: "Consulting",
    description: "BOM assembly from building blocks",
    icon: Puzzle,
  },
  {
    to: "/adoption",
    label: "Adoption",
    description: "Platform usage and flywheel metrics",
    icon: LineChart,
  },
  { to: "/news", label: "News", description: "Curated intelligence feed", icon: Newspaper },
  {
    to: "/storyline",
    label: "Storyline",
    description: "Structured narrative wizard",
    icon: NotebookPen,
  },
  {
    to: "/monday-review",
    label: "Monday review",
    description: "Weekly operating report",
    icon: ScrollText,
  },
  { to: "/gems", label: "Gems", description: "Focused assistant widgets", icon: Gem },
];

export const FOOTER_NAV: readonly NavEntry[] = [
  {
    to: "/settings",
    label: "Settings",
    description: "Local preferences and storage",
    icon: Settings,
  },
  { to: "/debug/logs", label: "Debug logs", description: "Server log lookup", icon: Sparkles },
];

export function allNavEntries(): NavEntry[] {
  return [...PRIMARY_NAV, ...LIBRARY_NAV, ...FOOTER_NAV];
}

/** Longest-prefix title resolution so child routes inherit their section title. */
export function pageTitleFor(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/c/")) return "Chat";
  const match = allNavEntries()
    .filter((e) => e.to !== "/" && (pathname === e.to || pathname.startsWith(`${e.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "WDC Agent Office";
}
