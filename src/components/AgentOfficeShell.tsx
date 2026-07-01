import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  AppWindow,
  BookOpen,
  Brain,
  CheckCircle2,
  Crosshair,
  FileSearch,
  MessageSquare,
  Minus,
  Network,
  Plus,
  Radar,
  RotateCcw,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  createLearningBroadcastEnvelope,
  getProductionStage,
  resolveAgentOfficeProductionLoop,
  summarizeCompetenceMapping,
  summarizeOperationalLedgers,
  summarizeProofGate,
  type DemandLoopScopeId,
  type ProductionLoopStageId,
} from "@/lib/agentOfficeProductionLoop";
import { cn } from "@/lib/utils";

type WorkScopeId = DemandLoopScopeId;

type WorkScope = {
  id: WorkScopeId;
  label: string;
  title: string;
  description: string;
  icon: typeof AppWindow;
  accent: string;
  prompt: string;
};

type CanvasNode = {
  id: string;
  label: string;
  meta: string;
  x: number;
  y: number;
  tone: string;
};

const scopes: WorkScope[] = [
  {
    id: "app",
    label: "App",
    title: "Build app",
    description: "Produkt, UX, repo, roadmap og leverance samlet i et spor.",
    icon: AppWindow,
    accent: "agent-office-scope-blue",
    prompt: "Lav en WDC-gated app-plan med scope, UX, arkitektur, work items og verifikation.",
  },
  {
    id: "book",
    label: "Bog",
    title: "Write book",
    description: "Outline, kapitler, research notes og redaktionel fremdrift.",
    icon: BookOpen,
    accent: "agent-office-scope-gold",
    prompt: "Byg et bogprojekt med synopsis, kapitelstruktur, research-backlog og skriveplan.",
  },
  {
    id: "investigation",
    label: "Efterforsk",
    title: "Investigate",
    description: "Hypoteser, kilder, beviser, forbindelser og næste spørgsmål.",
    icon: FileSearch,
    accent: "agent-office-scope-red",
    prompt: "Start en efterforskning med hypoteser, kildematrix, bevisgraf og åbne usikkerheder.",
  },
  {
    id: "operate",
    label: "WDC",
    title: "Operate WDC",
    description: "Agent Office, graph state, claims, gates og runtime readbacks.",
    icon: Radar,
    accent: "agent-office-scope-green",
    prompt: "Kør WDC Agent Office status: boot, claims, A2A, proof gates og næste sikre handling.",
  },
  {
    id: "general",
    label: "General",
    title: "Think",
    description: "Åben assistent-mode med canvas-noter og beslutningsspor.",
    icon: Brain,
    accent: "agent-office-scope-violet",
    prompt: "Hjælp mig med at tænke klart: opsummer mål, muligheder, tradeoffs og næste handling.",
  },
];

const nodesByScope: Record<WorkScopeId, CanvasNode[]> = {
  app: [
    { id: "intent", label: "Intent", meta: "Scope + user", x: 62, y: 70, tone: "blue" },
    { id: "ux", label: "Experience", meta: "Chat + canvas", x: 258, y: 44, tone: "gold" },
    { id: "build", label: "Build slice", meta: "Branch + PR", x: 213, y: 214, tone: "green" },
    { id: "proof", label: "Proof", meta: "Tests + gates", x: 448, y: 154, tone: "violet" },
  ],
  book: [
    { id: "premise", label: "Premise", meta: "Thesis", x: 70, y: 58, tone: "gold" },
    { id: "outline", label: "Outline", meta: "Chapters", x: 280, y: 78, tone: "blue" },
    { id: "research", label: "Research", meta: "Sources", x: 158, y: 240, tone: "red" },
    { id: "draft", label: "Draft", meta: "Next pages", x: 436, y: 224, tone: "green" },
  ],
  investigation: [
    { id: "question", label: "Question", meta: "Unknown", x: 60, y: 90, tone: "red" },
    { id: "sources", label: "Sources", meta: "Evidence", x: 263, y: 48, tone: "blue" },
    { id: "links", label: "Links", meta: "Relations", x: 236, y: 236, tone: "violet" },
    { id: "next", label: "Next pivot", meta: "Action", x: 466, y: 162, tone: "gold" },
  ],
  operate: [
    { id: "boot", label: "Boot", meta: "Session", x: 72, y: 62, tone: "green" },
    { id: "claim", label: "Claim", meta: "Files", x: 286, y: 52, tone: "blue" },
    { id: "gate", label: "Gate", meta: "Conflicts", x: 204, y: 230, tone: "gold" },
    { id: "close", label: "Closeout", meta: "Proof", x: 452, y: 210, tone: "violet" },
  ],
  general: [
    { id: "goal", label: "Goal", meta: "Desired state", x: 82, y: 74, tone: "violet" },
    { id: "options", label: "Options", meta: "Choices", x: 286, y: 50, tone: "blue" },
    { id: "tradeoffs", label: "Tradeoffs", meta: "Risks", x: 212, y: 234, tone: "gold" },
    { id: "next", label: "Next", meta: "Move", x: 462, y: 176, tone: "green" },
  ],
};

export function AgentOfficeShell({ children }: { children: ReactNode }) {
  const [activeScopeId, setActiveScopeId] = useState<WorkScopeId>("app");
  const [selectedNode, setSelectedNode] = useState("intent");
  const [selectedStageId, setSelectedStageId] = useState<ProductionLoopStageId>("demand");
  const [zoom, setZoom] = useState(0.92);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<
    | { type: "node"; id: string; startX: number; startY: number; originX: number; originY: number }
    | { type: "pan"; startX: number; startY: number; originX: number; originY: number }
    | null
  >(null);

  const activeScope = scopes.find((scope) => scope.id === activeScopeId) ?? scopes[0];
  const nodes = useMemo(
    () =>
      nodesByScope[activeScope.id].map((node) => ({
        ...node,
        ...(positions[`${activeScope.id}:${node.id}`] ?? {}),
      })),
    [activeScope.id, positions],
  );
  const selected = nodes.find((node) => node.id === selectedNode) ?? nodes[0];
  const productionLoop = resolveAgentOfficeProductionLoop(activeScope.id);
  const productionLoopSummary = summarizeCompetenceMapping(productionLoop.competenceRows);
  const learningEnvelope = createLearningBroadcastEnvelope(productionLoop);
  const proofGateSummary = summarizeProofGate(productionLoop.proofGate);
  const operationalSummary = summarizeOperationalLedgers(productionLoop);
  const selectedStage = getProductionStage(productionLoop, selectedStageId);

  const setScope = (id: WorkScopeId) => {
    setActiveScopeId(id);
    setSelectedNode(nodesByScope[id][0].id);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "pan") {
      setOffset({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      });
      return;
    }
    setPositions((current) => ({
      ...current,
      [`${activeScope.id}:${drag.id}`]: {
        x: drag.originX + (event.clientX - drag.startX) / zoom,
        y: drag.originY + (event.clientY - drag.startY) / zoom,
      },
    }));
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const insertPrompt = () => {
    void navigator.clipboard?.writeText(activeScope.prompt);
  };

  return (
    <div className="agent-office-shell">
      <section className="agent-office-chat">{children}</section>
      <aside
        id="agent-office-canvas"
        className="agent-office-canvas"
        aria-label="WDC Agent Office canvas"
      >
        <div className="agent-office-canvas-head">
          <div>
            <div className="agent-office-kicker">
              <Sparkles className="h-3.5 w-3.5" />
              WDC Agent Office
            </div>
            <h1>{activeScope.title}</h1>
          </div>
          <button
            type="button"
            className="agent-office-icon-button"
            onClick={insertPrompt}
            title="Kopier scope-prompt"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>

        <div className="agent-office-scopes" role="tablist" aria-label="Work scopes">
          {scopes.map((scope) => {
            const Icon = scope.icon;
            const active = scope.id === activeScope.id;
            return (
              <button
                key={scope.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(scope.id)}
                className={cn(
                  "agent-office-scope",
                  scope.accent,
                  active && "agent-office-scope-active",
                )}
                title={scope.description}
              >
                <Icon className="h-4 w-4" />
                <span>{scope.label}</span>
              </button>
            );
          })}
        </div>

        <div className="agent-office-workstrip">
          <div>
            <div className="agent-office-workstrip-label">Scope</div>
            <p>{activeScope.description}</p>
          </div>
          <div className="agent-office-status-pill">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Claimed
          </div>
        </div>

        <div className="agent-office-loop" aria-label="Demand to proof production loop">
          <div className="agent-office-panel-head">
            <div>
              <div className="agent-office-workstrip-label">Production loop</div>
              <strong>Demand -&gt; LearningExtractor</strong>
            </div>
            <span>
              candidates {productionLoopSummary.candidateCount} / mapped{" "}
              {productionLoopSummary.mappedCount}
            </span>
          </div>
          <div className="agent-office-loop-track">
            {productionLoop.stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                className={cn(
                  "agent-office-loop-stage",
                  selectedStage.id === stage.id && "agent-office-loop-stage-active",
                )}
                onClick={() => setSelectedStageId(stage.id)}
                title={stage.proofBoundary}
              >
                <small>{String(index + 1).padStart(2, "0")}</small>
                <span>{stage.label}</span>
              </button>
            ))}
          </div>
          <p>
            {selectedStage.label}: {selectedStage.proofBoundary}. Candidate, projection, dry-run and
            read-only output is never runtime proof.
          </p>
          <p>
            {productionLoop.label}: {productionLoop.demand} WorkBOM {productionLoop.workBom.length},
            RouteCatalog {productionLoop.routeCatalog.length}, EnvironmentBOM{" "}
            {operationalSummary.environmentBomCount} with debt{" "}
            {operationalSummary.environmentDebtCount}.
          </p>
          <p>
            AgentTeamBOM {operationalSummary.agentTeamBomCount}; ExecutionLedger{" "}
            {operationalSummary.executionLedgerCount} with{" "}
            {operationalSummary.claimGatedExecutionCount} claim-gated steps; VerificationLedger{" "}
            {operationalSummary.verificationLedgerCount} / runtime proof claims{" "}
            {operationalSummary.runtimeProofClaims}; CloseoutTree{" "}
            {operationalSummary.closeoutTreeCount}.
          </p>
          <p>
            LearningExtractor: {learningEnvelope.transport} {learningEnvelope.messageType} for{" "}
            {learningEnvelope.artifactId}; adoption state {learningEnvelope.adoptionState}.
          </p>
          <p>
            ProofGate: {proofGateSummary.claim}; evidence {proofGateSummary.presentCount}/
            {proofGateSummary.presentCount + proofGateSummary.missingCount}; verification passes{" "}
            {proofGateSummary.passedVerifications}/{proofGateSummary.requiredPasses}.{" "}
            {productionLoop.proofGate.boundary}
          </p>
        </div>

        <div
          className="agent-office-board"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            dragRef.current = {
              type: "pan",
              startX: event.clientX,
              startY: event.clientY,
              originX: offset.x,
              originY: offset.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <div
            className="agent-office-board-world"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
          >
            <svg className="agent-office-links" viewBox="0 0 640 360" aria-hidden="true">
              <path
                d={`M ${nodes[0].x + 82} ${nodes[0].y + 32} C 190 64, 205 68, ${nodes[1].x} ${nodes[1].y + 32}`}
              />
              <path
                d={`M ${nodes[1].x + 82} ${nodes[1].y + 40} C 388 124, 390 150, ${nodes[3].x} ${nodes[3].y + 28}`}
              />
              <path
                d={`M ${nodes[0].x + 82} ${nodes[0].y + 52} C 118 198, 158 224, ${nodes[2].x} ${nodes[2].y + 32}`}
              />
              <path
                d={`M ${nodes[2].x + 82} ${nodes[2].y + 32} C 342 278, 390 260, ${nodes[3].x} ${nodes[3].y + 52}`}
              />
            </svg>
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={cn(
                  "agent-office-node",
                  `agent-office-node-${node.tone}`,
                  selected.id === node.id && "agent-office-node-selected",
                )}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedNode(node.id);
                  dragRef.current = {
                    type: "node",
                    id: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    originX: node.x,
                    originY: node.y,
                  };
                  event.currentTarget.parentElement?.parentElement?.setPointerCapture(
                    event.pointerId,
                  );
                }}
              >
                <span>{node.label}</span>
                <small>{node.meta}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="agent-office-toolbar">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.65, value - 0.08))}
            title="Zoom ud"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="agent-office-zoom">{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.28, value + 0.08))}
            title="Zoom ind"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setOffset({ x: 0, y: 0 });
              setZoom(0.92);
            }}
            title="Nulstil view"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="agent-office-governance-grid">
          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">ProjectTree</div>
                <strong>Start + closeout</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {productionLoop.projectTreeRefs.map((item) => (
                <div key={item.ref} className="agent-office-ref-row">
                  <code>{item.ref}</code>
                  <span>{item.label}</span>
                  <small>{item.phase}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">EnvironmentBOM</div>
                <strong>Repo + evidence</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {productionLoop.environmentBom.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.category}</code>
                  <span title={item.proofBoundary}>{item.label}</span>
                  <small>{item.status}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">Competence</div>
                <strong>Required / provided</strong>
              </div>
            </div>
            <div className="agent-office-competence-list">
              {productionLoop.competenceRows.map((row) => (
                <div key={row.required} className="agent-office-competence-row">
                  <span>{row.required}</span>
                  <span>{row.provided}</span>
                  <small
                    data-state={row.state}
                    title={`source_fit_score ${row.source_fit_score.toFixed(2)} · ${
                      row.extraction_contract.artifact
                    }`}
                  >
                    {row.state}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">AgentTeamBOM</div>
                <strong>Required / provided lanes</strong>
              </div>
            </div>
            <div className="agent-office-competence-list">
              {productionLoop.agentTeamBom.map((member) => (
                <div key={member.id} className="agent-office-competence-row">
                  <span>{member.required}</span>
                  <span>{member.provided}</span>
                  <small
                    data-state={member.status}
                    title={`source_fit_score ${member.source_fit_score.toFixed(2)} · ${
                      member.extraction_contract.artifact
                    }`}
                  >
                    {member.status}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="agent-office-governance-grid">
          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">ExecutionLedger</div>
                <strong>Claim-gated work</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {productionLoop.executionLedger.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.claimRequired ? "claim" : item.stage}</code>
                  <span title={item.proofBoundary}>{item.label}</span>
                  <small>{item.status}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">VerificationLedger</div>
                <strong>Non-runtime checks</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {productionLoop.verificationLedger.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.kind}</code>
                  <span title={item.proofBoundary}>{item.label}</span>
                  <small>{item.runtimeProof ? "runtime" : item.status}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">CloseoutTree</div>
                <strong>Release + learning handoff</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {productionLoop.closeoutTree.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.handoff}</code>
                  <span title={item.proofBoundary}>{item.label}</span>
                  <small>{item.status}</small>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="agent-office-debt-panel">
          <div className="agent-office-inspector-icon">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="agent-office-workstrip-label">CapabilityDebtLedger</div>
            <p>
              Candidate count must stay separate from mapped count. Missing pieces become explicit
              debt before promotion.
            </p>
            <div className="agent-office-debt-list">
              {productionLoop.capabilityDebt.map((item) => (
                <span key={item.id} title={item.reason}>
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="agent-office-inspector">
          <div className="agent-office-inspector-icon">
            <Crosshair className="h-4 w-4" />
          </div>
          <div>
            <div className="agent-office-workstrip-label">Selected</div>
            <strong>{selected.label}</strong>
            <p>{selected.meta}</p>
          </div>
          <Network className="ml-auto h-4 w-4 text-muted-foreground" />
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </div>
      </aside>
    </div>
  );
}
