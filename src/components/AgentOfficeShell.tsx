import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  AppWindow,
  BookOpen,
  Brain,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  GitBranch,
  Radar,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AgentOfficeCommandPalette } from "@/components/AgentOfficeCommandPalette";
import { BrokerageRouteCard } from "@/components/BrokerageRouteCard";
import { CanvasWorkspace } from "@/components/CanvasWorkspace";
import { CapabilityLibrary } from "@/components/CapabilityLibrary";
import { ComposeRecipePanel } from "@/components/ComposeRecipePanel";
import { LibraryNav } from "@/components/LibraryNav";
import { ObjectInspector, type InspectableObject } from "@/components/ObjectInspector";
import { ProjectTreePanel } from "@/components/ProjectTreePanel";
import { SystemStatusPill } from "@/components/SystemStatusPill";
import { WDCObjectCard } from "@/components/WDCObjectCard";
import { WorldClassAssessment } from "@/components/WorldClassAssessment";
import {
  buildBuildabilityLedger,
  buildEvidenceContractLedger,
  buildMappingCandidateLedger,
  buildProofAdoptionLadder,
  buildProductionLoopCoverageMatrix,
  createLearningBroadcastEnvelope,
  getProductionStage,
  resolveAgentOfficeProductionLoop,
  summarizeCompetenceMapping,
  summarizeOperationalLedgers,
  summarizeProofGate,
  type ProductionLoopStageId,
} from "@/lib/agentOfficeProductionLoop";
import { buildAgentOfficeStatus } from "@/lib/agentOfficeStatus";
import { buildBrokerageRouteCard } from "@/lib/brokerageRoute";
import { buildCapabilityLibrary, type CapabilityLibraryFilters } from "@/lib/capabilityLibrary";
import { buildCapabilityRecipe } from "@/lib/capabilityRecipe";
import { buildWDCObjectCards } from "@/lib/wdcObjectCards";
import { cn } from "@/lib/utils";
import { buildWorldClassAssessment } from "@/lib/worldClassContract";
import {
  DEFAULT_WORK_MODE_ID,
  WORK_MODES,
  toWorkModeChatContext,
  type WorkMode,
  type WorkModeId,
} from "@/lib/workModes";

type WorkModeView = WorkMode & {
  icon: typeof AppWindow;
  accent: string;
};

const modeVisuals: Record<WorkModeId, Pick<WorkModeView, "icon" | "accent">> = {
  general: { icon: Brain, accent: "agent-office-scope-violet" },
  app: { icon: AppWindow, accent: "agent-office-scope-blue" },
  book: { icon: BookOpen, accent: "agent-office-scope-gold" },
  investigation: { icon: FileSearch, accent: "agent-office-scope-red" },
  operate: { icon: Radar, accent: "agent-office-scope-green" },
};

const workModes: WorkModeView[] = WORK_MODES.map((mode) => ({
  ...mode,
  ...modeVisuals[mode.id],
}));

const FIGMA_SURFACE = {
  name: "Figma Product Surface v1",
  url: "https://www.figma.com/design/mlnm4xnjrO0aEgVJ7erb6d",
  desktopNode: "2:2",
  mobileNode: "2:139",
  branch: "codex/lin-953-figma-surface-sync",
  boundary: [
    "candidate/L1 only",
    "no graph writes",
    "no Railway mutation",
    "no claim promotion",
    "Vercel paused",
  ],
};

const wdcCliToolbox = [
  {
    command: "wdc boot session",
    state: "ready",
    description: "Hydrates Agent Office session, WorkBOM and A2A context.",
  },
  {
    command: "wdc route-validate",
    state: "ready",
    description: "Keeps demand routing explicit before implementation.",
  },
  {
    command: "adaptive_bom.compose",
    state: "candidate",
    description: "Composes Lego/BOM candidates without graph promotion.",
  },
  {
    command: "wdc a2a send",
    state: "gated",
    description: "Broadcasts handoff or review requests through typed A2A.",
  },
  {
    command: "proof boundary readback",
    state: "blocked",
    description: "Runtime proof waits for deployed SHA plus three route checks.",
  },
];

function WDCLogoMark() {
  return (
    <span className="wdc-logo-mark" aria-label="WDC logo">
      <span className="wdc-logo-mark-antenna" />
      <span className="wdc-logo-mark-face">
        <span />
        <span />
      </span>
    </span>
  );
}

function FigmaSurfaceSyncPanel() {
  return (
    <section className="agent-office-figma-panel" aria-label="Figma product surface sync">
      <div className="agent-office-panel-head">
        <div className="agent-office-figma-title">
          <WDCLogoMark />
          <div>
            <strong>{FIGMA_SURFACE.name}</strong>
            <span>{`Desktop node ${FIGMA_SURFACE.desktopNode} · Mobile node ${FIGMA_SURFACE.mobileNode}`}</span>
          </div>
        </div>
        <a href={FIGMA_SURFACE.url} target="_blank" rel="noreferrer">
          Design source
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <p>
        Gemini App mirrors the Figma direction as a chat-first product surface: assistant first,
        resizable canvas second, WDC CLI tools and proof gates always visible as typed boundaries.
      </p>
      <div className="agent-office-proof-strip">
        {FIGMA_SURFACE.boundary.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function WdcCliToolboxPanel() {
  return (
    <section className="agent-office-figma-panel" aria-label="WDC CLI toolbox">
      <div className="agent-office-panel-head">
        <div className="agent-office-figma-title">
          <Terminal className="h-4 w-4" />
          <div>
            <strong>WDC CLI toolbox</strong>
            <span>Boot · route · BOM · A2A · proof boundary</span>
          </div>
        </div>
        <span className="agent-office-branch-chip">
          <GitBranch className="h-3.5 w-3.5" />
          {FIGMA_SURFACE.branch}
        </span>
      </div>
      <div className="agent-office-toolbox-grid">
        {wdcCliToolbox.map((tool) => (
          <div className="agent-office-command-chip" data-state={tool.state} key={tool.command}>
            <code>{tool.command}</code>
            <span>{tool.state}</span>
            <p>{tool.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function WorkModeSwitcher({
  activeModeId,
  modes,
  onSelect,
}: {
  activeModeId: WorkModeId;
  modes: WorkModeView[];
  onSelect: (id: WorkModeId) => void;
}) {
  return (
    <div className="agent-office-scopes" role="tablist" aria-label="Work modes">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = mode.id === activeModeId;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(mode.id)}
            className={cn("agent-office-scope", mode.accent, active && "agent-office-scope-active")}
            title={mode.description}
          >
            <Icon className="h-4 w-4" />
            <span>{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function CapabilityLibraryWorkspace({
  entries,
  selectedIds,
  onToggle,
}: {
  entries: ReturnType<typeof buildCapabilityLibrary>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [filters, setFilters] = useState<CapabilityLibraryFilters>({
    kind: "agent",
    domain: "all",
    readiness: "all",
    evidence: "all",
    query: "",
  });

  return (
    <>
      <LibraryNav filters={filters} onChange={setFilters} />
      <CapabilityLibrary
        entries={entries}
        filters={filters}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    </>
  );
}

export function AgentOfficeShell({ children }: { children: ReactNode }) {
  const [activeScopeId, setActiveScopeId] = useState<WorkModeId>(DEFAULT_WORK_MODE_ID);
  const [selectedStageId, setSelectedStageId] = useState<ProductionLoopStageId>("demand");
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);
  const [canvasVisible, setCanvasVisible] = useState(true);

  const activeScope = workModes.find((scope) => scope.id === activeScopeId) ?? workModes[0];
  const productionLoop = resolveAgentOfficeProductionLoop(activeScope.id);
  const capabilityLibrary = useMemo(() => buildCapabilityLibrary(), []);
  const selectedCapabilities = useMemo(
    () => capabilityLibrary.filter((entry) => selectedCapabilityIds.includes(entry.id)),
    [capabilityLibrary, selectedCapabilityIds],
  );
  const inspectedCapability = useMemo(
    () =>
      selectedCapabilityIds.length
        ? capabilityLibrary.find(
            (entry) => entry.id === selectedCapabilityIds[selectedCapabilityIds.length - 1],
          )
        : undefined,
    [capabilityLibrary, selectedCapabilityIds],
  );
  const recipe = useMemo(
    () => buildCapabilityRecipe(activeScope.title, selectedCapabilities),
    [activeScope.title, selectedCapabilities],
  );
  const inspectedObject = useMemo<InspectableObject>(() => {
    if (inspectedCapability) {
      const styleSections = inspectedCapability.style_profile
        ? [
            {
              label: "style",
              value: `${inspectedCapability.style_profile.tone}; ${inspectedCapability.style_profile.density}; ${inspectedCapability.style_profile.diagram_family}`,
            },
            {
              label: "palette",
              value: inspectedCapability.style_profile.palette.join(", "),
            },
            {
              label: "targets",
              value: inspectedCapability.style_profile.artifact_targets.join(", "),
            },
            {
              label: "risk",
              value: `${inspectedCapability.style_profile.visual_risk_level}; ${inspectedCapability.style_profile.executive_depth}`,
            },
          ]
        : [];
      const visualSections = inspectedCapability.visual_strategy
        ? [
            {
              label: "visual",
              value: `${inspectedCapability.visual_strategy.visualization_family}; mermaid=${inspectedCapability.visual_strategy.mermaid_type}; drawio=${inspectedCapability.visual_strategy.drawio_type}`,
            },
            {
              label: "widget",
              value: inspectedCapability.visual_strategy.widget_slot,
            },
            {
              label: "profiles",
              value: inspectedCapability.visual_strategy.style_profile_ids.join(", "),
            },
            {
              label: "boundary",
              value: `${inspectedCapability.visual_strategy.proof_boundary}; graph_writes=${inspectedCapability.visual_strategy.graph_writes}; claim_mutations=${inspectedCapability.visual_strategy.claim_mutations}`,
            },
          ]
        : [];

      return {
        title: inspectedCapability.label,
        type: inspectedCapability.kind,
        summary: inspectedCapability.description,
        proofBoundary: inspectedCapability.proof_eligible
          ? "Proof eligibility must still be read back from WDC runtime gates."
          : "Candidate/projection only. This cannot execute, write graph data, or promote claims.",
        status: inspectedCapability.readiness,
        nextAction: "Compose or dry-run through WDC Agent Office before any execution.",
        meta: [
          { label: "repo", value: inspectedCapability.source_repo },
          { label: "domain", value: inspectedCapability.domain },
          { label: "fit", value: inspectedCapability.source_fit_score.toFixed(2) },
          { label: "mapped", value: "graph_readback_only" },
        ],
        sections: [
          { label: "does", value: inspectedCapability.description },
          {
            label: "recommended",
            value: `Provides ${inspectedCapability.provided_competences.join(", ")}`,
          },
          { label: "requires", value: inspectedCapability.required_competences.join(", ") },
          { label: "source", value: inspectedCapability.source_ref },
          {
            label: "contract",
            value: inspectedCapability.extraction_contract.required_fields.join(", "),
          },
          { label: "cost", value: "P0 read-only preview; provider executions=0" },
          ...styleSections,
          ...visualSections,
        ],
      };
    }

    return {
      title: recipe.intent,
      type: "candidate_recipe",
      summary: `${recipe.candidate_count} selected candidates; mapped_count=${recipe.mapped_count} from ${recipe.mapped_count_source}.`,
      proofBoundary:
        "Recipe composition is candidate-only and projection-only until WDC approval and runtime readback exist.",
      status: recipe.activation.status,
      nextAction: recipe.activation.next_action,
      meta: [
        { label: "candidate", value: String(recipe.candidate_count) },
        { label: "mapped", value: String(recipe.mapped_count) },
        { label: "source", value: recipe.mapped_count_source },
      ],
      sections: [
        { label: "missing", value: recipe.activation.missing_competence },
        { label: "graph", value: `graph_write_allowed=${recipe.graph_write_allowed}` },
        { label: "proof", value: `proof_eligible=${recipe.proof_eligible}` },
      ],
    };
  }, [inspectedCapability, recipe]);
  const systemStatus = buildAgentOfficeStatus(productionLoop);
  const brokerageRouteCard = buildBrokerageRouteCard(activeScope.id);
  const worldClassAssessment = useMemo(
    () =>
      buildWorldClassAssessment({
        capabilityEntries: capabilityLibrary,
        recipe,
        routeCard: brokerageRouteCard,
        projectTreeRefs: productionLoop.projectTreeRefs,
      }),
    [brokerageRouteCard, capabilityLibrary, productionLoop.projectTreeRefs, recipe],
  );
  const productionLoopSummary = summarizeCompetenceMapping(productionLoop.competenceRows);
  const learningEnvelope = createLearningBroadcastEnvelope(productionLoop);
  const proofGateSummary = summarizeProofGate(productionLoop.proofGate);
  const operationalSummary = summarizeOperationalLedgers(productionLoop);
  const buildabilityLedger = buildBuildabilityLedger(productionLoop);
  const buildabilityBlockedCount = buildabilityLedger.filter(
    (item) => item.status === "blocked",
  ).length;
  const evidenceContractLedger = buildEvidenceContractLedger(productionLoop);
  const evidenceContractIncompleteCount = evidenceContractLedger.filter(
    (item) => item.status === "incomplete",
  ).length;
  const mappingCandidateLedger = buildMappingCandidateLedger(productionLoop);
  const mappingMappedCount = mappingCandidateLedger.filter(
    (item) => item.state === "mapped",
  ).length;
  const coverageMatrix = buildProductionLoopCoverageMatrix(productionLoop);
  const coverageDebtCount = coverageMatrix.filter((item) => item.status === "debt").length;
  const proofAdoptionLadder = buildProofAdoptionLadder(productionLoop);
  const wdcObjectCards = buildWDCObjectCards(productionLoop);
  const proofAdoptionBlockedCount = proofAdoptionLadder.filter(
    (item) => item.status === "blocked",
  ).length;
  const stopConditionBlockedCount = productionLoop.stopConditions.filter(
    (item) => !item.proofEligible,
  ).length;
  const selectedStage = getProductionStage(productionLoop, selectedStageId);
  const chatMode = useMemo(() => toWorkModeChatContext(activeScope), [activeScope]);
  const workspaceChildren = useMemo(
    () =>
      Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        if (typeof child.type === "string") return child;
        return cloneElement(child as ReactElement<{ workMode?: typeof chatMode }>, {
          workMode: chatMode,
        });
      }),
    [children, chatMode],
  );

  const setScope = (id: WorkModeId) => {
    setActiveScopeId(id);
  };

  const toggleCapability = (id: string) => {
    setSelectedCapabilityIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const insertPrompt = () => {
    void navigator.clipboard?.writeText(activeScope.prompt);
  };

  return (
    <div
      className="agent-office-shell agent-office-chat-first-shell"
      style={{
        display: "grid",
        gridTemplateColumns: canvasVisible
          ? "minmax(0, 1fr) minmax(360px, 42vw)"
          : "minmax(0, 1fr)",
      }}
    >
      <section className="agent-office-chat" aria-label="WDC CLI Chat home">
        <div className="agent-office-workstrip">
          <div>
            <div className="agent-office-kicker">
              <WDCLogoMark />
              Figma Product Surface v1 synced
            </div>
            <h1>WDC CLI Chat workspace</h1>
            <p>
              Start with the assistant. Canvas, library, WDC CLI tools, proof gates and debug
              details are secondary workspace surfaces, not competing landing-page walls.
            </p>
          </div>
          <div className="agent-office-header-actions">
            <SystemStatusPill status={systemStatus} />
            <button
              type="button"
              className="agent-office-status-pill"
              onClick={() => setCanvasVisible((visible) => !visible)}
            >
              {canvasVisible ? "Hide canvas" : "Show canvas"}
            </button>
            <AgentOfficeCommandPalette
              modes={WORK_MODES}
              activeModeId={activeScope.id}
              status={systemStatus}
              onSelectMode={setScope}
              onCopyPrompt={insertPrompt}
            />
          </div>
        </div>

        <WorkModeSwitcher activeModeId={activeScope.id} modes={workModes} onSelect={setScope} />

        <div className="agent-office-workstrip" aria-label="Chat state contract">
          {["pending", "streaming", "complete", "error"].map((state) => (
            <div className="agent-office-status-pill" key={state}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {state}
            </div>
          ))}
        </div>

        <FigmaSurfaceSyncPanel />

        {workspaceChildren}
      </section>

      {canvasVisible && (
        <aside
          id="agent-office-canvas"
          className="agent-office-canvas"
          aria-label="WDC Agent Office canvas"
          style={{
            minWidth: 360,
            maxWidth: 760,
            resize: "horizontal",
            overflow: "auto",
          }}
        >
          <div className="agent-office-canvas-head">
            <div>
              <div className="agent-office-kicker">
                <Sparkles className="h-3.5 w-3.5" />
                Resizable workspace
              </div>
              <h2>{activeScope.title}</h2>
              <p>{activeScope.description}</p>
            </div>
          </div>

          <CanvasWorkspace mode={activeScope} onCopyPrompt={insertPrompt} />

          <details className="agent-office-loop" open>
            <summary>WDC CLI toolbox and Figma sync</summary>
            <WdcCliToolboxPanel />
          </details>

          <details className="agent-office-loop" open>
            <summary>Capability Library and recipe composer</summary>
            <CapabilityLibraryWorkspace
              entries={capabilityLibrary}
              selectedIds={selectedCapabilityIds}
              onToggle={toggleCapability}
            />
            <ComposeRecipePanel recipe={recipe} />
            <ObjectInspector item={inspectedObject} />
          </details>

          <details className="agent-office-loop" open>
            <summary>Approval, route and proof boundary</summary>
            <div className="agent-office-debt-panel">
              <div className="agent-office-inspector-icon">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="agent-office-workstrip-label">ApprovalGatePanel</div>
                <p>
                  Missing approval.gated.execution blocks provider execution. Preview, compose,
                  explain, dry-run and approval requests are allowed; execution, graph writes,
                  deploys and claim promotion remain blocked.
                </p>
              </div>
            </div>
            <BrokerageRouteCard card={brokerageRouteCard} />
            <WorldClassAssessment assessment={worldClassAssessment} />
            <ProjectTreePanel refs={productionLoop.projectTreeRefs} phase="activity_start" />
          </details>

          <details className="agent-office-loop">
            <summary>Debug and proof ledgers</summary>
            <p>
              {selectedStage.label}: {selectedStage.proofBoundary}. Candidate, projection, dry-run
              and read-only output is never runtime proof.
            </p>
            <p>
              {productionLoop.label}: {productionLoop.demand} WorkBOM{" "}
              {productionLoop.workBom.length}, RouteCatalog {productionLoop.routeCatalog.length},
              EnvironmentBOM {operationalSummary.environmentBomCount} with debt{" "}
              {operationalSummary.environmentDebtCount}.
            </p>
            <p>
              BuildabilityLedger: {buildabilityLedger.length - buildabilityBlockedCount}/
              {buildabilityLedger.length} ready; blocked {buildabilityBlockedCount}.
            </p>
            <p>
              EvidenceContractLedger:{" "}
              {evidenceContractLedger.length - evidenceContractIncompleteCount}/
              {evidenceContractLedger.length} complete; incomplete {evidenceContractIncompleteCount}
              .
            </p>
            <p>
              MappingCandidateLedger: candidates {mappingCandidateLedger.length} / mapped{" "}
              {mappingMappedCount}; candidates {productionLoopSummary.candidateCount} / mapped{" "}
              {productionLoopSummary.mappedCount}.
            </p>
            <p>
              AgentTeamBOM {operationalSummary.agentTeamBomCount}; ExecutionLedger{" "}
              {operationalSummary.executionLedgerCount}; VerificationLedger{" "}
              {operationalSummary.verificationLedgerCount}; runtime proof claims{" "}
              {operationalSummary.runtimeProofClaims}.
            </p>
            <p>
              CoverageMatrix: {coverageMatrix.length - coverageDebtCount}/{coverageMatrix.length}{" "}
              covered; debt {coverageDebtCount}.
            </p>
            <p>
              LearningExtractor: {learningEnvelope.transport} {learningEnvelope.messageType} for{" "}
              {learningEnvelope.artifactId}; adoption state {learningEnvelope.adoptionState}.
            </p>
            <p>
              ProofGate: {proofGateSummary.claim}; evidence {proofGateSummary.presentCount}/
              {proofGateSummary.presentCount + proofGateSummary.missingCount}; verification passes{" "}
              {proofGateSummary.passedVerifications}/{proofGateSummary.requiredPasses}.
            </p>
            <p>
              ProofAdoptionLadder: {proofAdoptionLadder.length - proofAdoptionBlockedCount}/
              {proofAdoptionLadder.length} satisfied; StopConditionLedger blockers{" "}
              {stopConditionBlockedCount}.
            </p>
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
          </details>

          <details className="wdc-object-card-section">
            <summary>WDC object cards</summary>
            <div className="agent-office-workstrip-label">Readable process cards</div>
            <p className="agent-office-boundary-copy">no raw JSON default</p>
            <div className="wdc-object-card-grid">
              {wdcObjectCards.map((card) => (
                <WDCObjectCard key={card.id} card={card} />
              ))}
            </div>
          </details>

          <ProjectTreePanel refs={productionLoop.projectTreeRefs} phase="activity_closeout" />
        </aside>
      )}
    </div>
  );
}
