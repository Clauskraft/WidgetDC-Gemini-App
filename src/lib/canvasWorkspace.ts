import type { WorkMode, WorkModeId } from "@/lib/workModes";

export const CANVAS_OBJECT_TYPES = [
  "Work item",
  "BOM item",
  "Route step",
  "Capability",
  "Gap",
  "Agent",
  "Claim",
  "Evidence",
  "Source",
  "Decision",
  "Risk",
  "Component",
  "PR",
  "Session",
  "A2A message",
  "Proof gate",
  "Timeline event",
  "Chapter",
  "Entity",
] as const;

export type CanvasObjectType = (typeof CANVAS_OBJECT_TYPES)[number];

export const CANVAS_MODES = [
  "Board",
  "Graph",
  "Timeline",
  "Outline",
  "Evidence Wall",
  "System Map",
] as const;

export type CanvasMode = (typeof CANVAS_MODES)[number];

export type CanvasObjectTone = "blue" | "gold" | "green" | "red" | "violet";

export type CanvasWorkspaceObject = {
  id: string;
  type: CanvasObjectType;
  title: string;
  summary: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tone: CanvasObjectTone;
  proofBoundary: string;
};

export type CanvasWorkspaceEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

export type CanvasPersistenceBoundary = {
  kind: "local-thread-bound";
  storageKey: string;
  staged: true;
  proofBoundary: string;
};

export type CanvasWorkspaceDocument = {
  id: string;
  modeId: WorkModeId;
  title: string;
  canvasMode: CanvasMode;
  objects: CanvasWorkspaceObject[];
  edges: CanvasWorkspaceEdge[];
  persistence: CanvasPersistenceBoundary;
};

const modeCanvasModes: Record<WorkModeId, CanvasMode> = {
  general: "Board",
  app: "System Map",
  book: "Outline",
  investigation: "Evidence Wall",
  operate: "Graph",
};

const objectToneByType: Partial<Record<CanvasObjectType, CanvasObjectTone>> = {
  "Work item": "blue",
  "BOM item": "violet",
  "Route step": "gold",
  Capability: "green",
  Gap: "red",
  Agent: "violet",
  Claim: "gold",
  Evidence: "green",
  Source: "blue",
  Decision: "violet",
  Risk: "red",
  Component: "blue",
  PR: "green",
  Session: "green",
  "A2A message": "blue",
  "Proof gate": "gold",
  "Timeline event": "gold",
  Chapter: "gold",
  Entity: "violet",
};

const templatesByMode: Record<
  WorkModeId,
  Array<Pick<CanvasWorkspaceObject, "type" | "title" | "summary" | "x" | "y">>
> = {
  general: [
    { type: "Decision", title: "Goal", summary: "Desired state", x: 82, y: 74 },
    { type: "Source", title: "Options", summary: "Choices", x: 286, y: 50 },
    { type: "Risk", title: "Tradeoffs", summary: "Risks", x: 212, y: 234 },
    { type: "Timeline event", title: "Next", summary: "Move", x: 462, y: 176 },
  ],
  app: [
    { type: "Work item", title: "Intent", summary: "Scope + user", x: 62, y: 70 },
    { type: "Component", title: "Experience", summary: "Chat + canvas", x: 258, y: 44 },
    { type: "PR", title: "Build slice", summary: "Branch + PR", x: 213, y: 214 },
    { type: "Route step", title: "Proof", summary: "Tests + gates", x: 448, y: 154 },
  ],
  book: [
    { type: "Decision", title: "Premise", summary: "Thesis", x: 70, y: 58 },
    { type: "Chapter", title: "Outline", summary: "Chapters", x: 280, y: 78 },
    { type: "Source", title: "Research", summary: "Sources", x: 158, y: 240 },
    { type: "Chapter", title: "Draft", summary: "Next pages", x: 436, y: 224 },
  ],
  investigation: [
    { type: "Risk", title: "Question", summary: "Unknown", x: 60, y: 90 },
    { type: "Source", title: "Sources", summary: "Evidence", x: 263, y: 48 },
    { type: "Entity", title: "Links", summary: "Relations", x: 236, y: 236 },
    { type: "Evidence", title: "Next pivot", summary: "Action", x: 466, y: 162 },
  ],
  operate: [
    { type: "Session", title: "Boot", summary: "Session", x: 72, y: 62 },
    { type: "Claim", title: "Claim", summary: "Files", x: 286, y: 52 },
    { type: "Proof gate", title: "Gate", summary: "Conflicts", x: 204, y: 230 },
    { type: "A2A message", title: "Closeout", summary: "Proof", x: 452, y: 210 },
  ],
};

export function normalizeCanvasObjectType(value: string): CanvasObjectType {
  return CANVAS_OBJECT_TYPES.find((type) => type === value) ?? "Work item";
}

export function resolveCanvasPalette(mode: WorkMode): CanvasObjectType[] {
  return mode.canvasPalette.map(normalizeCanvasObjectType);
}

export function getCanvasObjectTone(type: CanvasObjectType): CanvasObjectTone {
  return objectToneByType[type] ?? "blue";
}

export function createCanvasWorkspaceDocument(mode: WorkMode): CanvasWorkspaceDocument {
  const objects = templatesByMode[mode.id].map((template, index) => ({
    id: `${mode.id}:${template.type.toLowerCase().replaceAll(" ", "-")}:${index + 1}`,
    type: template.type,
    title: template.title,
    summary: template.summary,
    x: template.x,
    y: template.y,
    width: 170,
    height: 72,
    tone: getCanvasObjectTone(template.type),
    proofBoundary: "Canvas object state is local UI work context, not runtime proof.",
  }));

  return {
    id: `canvas:${mode.id}:starter`,
    modeId: mode.id,
    title: `${mode.label} canvas`,
    canvasMode: modeCanvasModes[mode.id],
    objects,
    edges: [
      { id: `${mode.id}:edge:1`, from: objects[0].id, to: objects[1].id, label: "frames" },
      { id: `${mode.id}:edge:2`, from: objects[1].id, to: objects[3].id, label: "drives" },
      { id: `${mode.id}:edge:3`, from: objects[0].id, to: objects[2].id, label: "risks" },
      { id: `${mode.id}:edge:4`, from: objects[2].id, to: objects[3].id, label: "gates" },
    ],
    persistence: {
      kind: "local-thread-bound",
      storageKey: `wdc-agent-office:canvas:${mode.id}`,
      staged: true,
      proofBoundary:
        "Local canvas persistence is a staged UI boundary. It is not graph persistence or runtime proof.",
    },
  };
}

export function createCanvasObjectFromPalette(
  document: CanvasWorkspaceDocument,
  type: CanvasObjectType,
): CanvasWorkspaceObject {
  const count = document.objects.filter((object) => object.type === type).length + 1;
  return {
    id: `${document.modeId}:${type.toLowerCase().replaceAll(" ", "-")}:custom:${count}`,
    type,
    title: `${type} ${count}`,
    summary: `Pinned ${document.title} object`,
    x: 128 + ((document.objects.length * 46) % 300),
    y: 116 + ((document.objects.length * 34) % 150),
    width: 170,
    height: 72,
    tone: getCanvasObjectTone(type),
    proofBoundary: "User-created canvas object is local UI work context, not runtime proof.",
  };
}
