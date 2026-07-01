import type { DemandLoopScopeId } from "@/lib/agentOfficeProductionLoop";

export type WorkModeId = DemandLoopScopeId;

export type WorkModeStarter = {
  title: string;
  body: string;
};

export type WorkMode = {
  id: WorkModeId;
  label: "General" | "Build App" | "Write Book" | "Investigate" | "Operate WDC";
  shortLabel: string;
  title: string;
  description: string;
  chatGreeting: string;
  chatTagline: string;
  prompt: string;
  canvasPalette: string[];
  starters: WorkModeStarter[];
};

export type WorkModeChatContext = Pick<
  WorkMode,
  "id" | "chatGreeting" | "chatTagline" | "prompt" | "starters"
>;

export const WORK_MODES: WorkMode[] = [
  {
    id: "general",
    label: "General",
    shortLabel: "General",
    title: "Think clearly",
    description: "Open assistant mode for goals, options, tradeoffs and next moves.",
    chatGreeting: "Hvad skal WDC hjælpe med at afklare?",
    chatTagline: "General mode samler mål, muligheder, tradeoffs og næste handling.",
    prompt: "Hjælp mig med at tænke klart: opsummer mål, muligheder, tradeoffs og næste handling.",
    canvasPalette: ["Decision", "Risk", "Source", "Timeline event"],
    starters: [
      {
        title: "Afklar målet",
        body: "Hjælp mig med at formulere målet, beslutningskriterierne og den næste sikre handling.",
      },
      {
        title: "Vurder muligheder",
        body: "Lav en kort option matrix med tradeoffs, risici og anbefalet næste skridt.",
      },
      {
        title: "Lav beslutningsspor",
        body: "Omsæt denne situation til beslutninger, antagelser, åbne spørgsmål og evidensbehov.",
      },
      {
        title: "Byg arbejdscanvas",
        body: "Foreslå et visuelt canvas med mål, aktører, risici og næste handlinger.",
      },
    ],
  },
  {
    id: "app",
    label: "Build App",
    shortLabel: "App",
    title: "Build app",
    description: "Product, UX, repo, roadmap and delivery as one governed work lane.",
    chatGreeting: "Hvilken app bygger vi?",
    chatTagline: "Build App mode forbinder produkt, UX, arkitektur, PR og verificering.",
    prompt: "Lav en WDC-gated app-plan med scope, UX, arkitektur, work items og verifikation.",
    canvasPalette: ["Component", "Route step", "Work item", "PR"],
    starters: [
      {
        title: "App-scope",
        body: "Lav en WDC-gated app-plan med scope, UX, arkitektur, work items og verifikation.",
      },
      {
        title: "Slice-plan",
        body: "Skær denne app-idé ned til første sikre PR med tests, risici og proof boundary.",
      },
      {
        title: "UX-flow",
        body: "Design et roligt chat-first UX-flow med tom state, hovedhandlinger og fejltilstande.",
      },
      {
        title: "Repo-readiness",
        body: "Lav en buildability-checkliste for repo, env, tests, CI og release-gates.",
      },
    ],
  },
  {
    id: "book",
    label: "Write Book",
    shortLabel: "Book",
    title: "Write book",
    description: "Outline, chapters, research notes and editorial progress.",
    chatGreeting: "Hvilken bog skriver vi?",
    chatTagline: "Write Book mode samler premise, kapitler, research og skrivefremdrift.",
    prompt: "Byg et bogprojekt med synopsis, kapitelstruktur, research-backlog og skriveplan.",
    canvasPalette: ["Chapter", "Entity", "Source", "Decision"],
    starters: [
      {
        title: "Bog-outline",
        body: "Byg et bogprojekt med synopsis, kapitelstruktur, research-backlog og skriveplan.",
      },
      {
        title: "Kapitelarkitektur",
        body: "Lav en kapitelstruktur med hovedargument, scener/sektioner og researchbehov.",
      },
      {
        title: "Research wall",
        body: "Organiser kilder, citater, temaer og åbne spørgsmål til en evidence wall.",
      },
      {
        title: "Redaktionel plan",
        body: "Lav en ugentlig skriveplan med milestones, reviewpunkter og stopkriterier.",
      },
    ],
  },
  {
    id: "investigation",
    label: "Investigate",
    shortLabel: "Investigate",
    title: "Investigate",
    description: "Hypotheses, sources, evidence, relationships and next pivots.",
    chatGreeting: "Hvad undersøger vi?",
    chatTagline: "Investigate mode gør hypoteser, kilder, beviser og næste pivots synlige.",
    prompt: "Start en efterforskning med hypoteser, kildematrix, bevisgraf og åbne usikkerheder.",
    canvasPalette: ["Entity", "Evidence", "Source", "Risk"],
    starters: [
      {
        title: "Efterforskningsplan",
        body: "Start en efterforskning med hypoteser, kildematrix, bevisgraf og åbne usikkerheder.",
      },
      {
        title: "Hypoteser",
        body: "Lav konkurrerende hypoteser med beviser for/imod, usikkerhed og næste datakilder.",
      },
      {
        title: "Entity map",
        body: "Kortlæg personer, organisationer, events, relationer og åbne forbindelser.",
      },
      {
        title: "Næste pivot",
        body: "Find næste mest værdifulde efterforskningspivot og hvad der ville falsificere den.",
      },
    ],
  },
  {
    id: "operate",
    label: "Operate WDC",
    shortLabel: "WDC",
    title: "Operate WDC",
    description: "Agent Office, graph state, claims, gates and runtime readbacks.",
    chatGreeting: "Hvad skal WDC-operatøren kontrollere?",
    chatTagline: "Operate WDC mode holder boot, claims, A2A, proof gates og næste handling samlet.",
    prompt: "Kør WDC Agent Office status: boot, claims, A2A, proof gates og næste sikre handling.",
    canvasPalette: ["Session", "A2A message", "Claim", "Proof gate"],
    starters: [
      {
        title: "Boot-status",
        body: "Kør WDC Agent Office status: boot, claims, A2A, proof gates og næste sikre handling.",
      },
      {
        title: "Claim hygiene",
        body: "Gennemgå aktive claims, source scopes, konflikter og præcis næste koordination.",
      },
      {
        title: "Proof boundary",
        body: "Forklar hvad der er code proof, graph proof og runtime proof i den aktuelle opgave.",
      },
      {
        title: "Closeout",
        body: "Lav en closeout med verification, proof boundary, remaining gaps og A2A learning.",
      },
    ],
  },
];

export const DEFAULT_WORK_MODE_ID: WorkModeId = "general";

export function getWorkMode(id: WorkModeId | string | undefined): WorkMode {
  return WORK_MODES.find((mode) => mode.id === id) ?? WORK_MODES[0];
}

export function toWorkModeChatContext(mode: WorkMode): WorkModeChatContext {
  return {
    id: mode.id,
    chatGreeting: mode.chatGreeting,
    chatTagline: mode.chatTagline,
    prompt: mode.prompt,
    starters: mode.starters,
  };
}
