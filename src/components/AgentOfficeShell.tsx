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
  FileSearch,
  Radar,
  Sparkles,
} from "lucide-react";
import { AgentOfficeCommandPalette } from "@/components/AgentOfficeCommandPalette";
import { BrokerageRouteCard } from "@/components/BrokerageRouteCard";
import { CanvasWorkspace } from "@/components/CanvasWorkspace";
import { CapabilityLibrary } from "@/components/CapabilityLibrary";
import { ComposeRecipePanel } from "@/components/ComposeRecipePanel";
import { LibraryNav } from "@/components/LibraryNav";
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
import { buildCapabilityLibrary, type CapabilityKind } from "@/lib/capabilityLibrary";
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

export function AgentOfficeShell({ children }: { children: ReactNode }) {
  const [activeScopeId, setActiveScopeId] = useState<WorkModeId>(DEFAULT_WORK_MODE_ID);
  const [selectedStageId, setSelectedStageId] = useState<ProductionLoopStageId>("demand");
  const [activeCapabilityKind, setActiveCapabilityKind] = useState<CapabilityKind>("agent");
  const [selectedCapabilityIds, setSelectedCapabilityIds] = useState<string[]>([]);

  const activeScope = workModes.find((scope) => scope.id === activeScopeId) ?? workModes[0];
  const productionLoop = resolveAgentOfficeProductionLoop(activeScope.id);
  const capabilityLibrary = useMemo(() => buildCapabilityLibrary(), []);
  const selectedCapabilities = useMemo(
    () => capabilityLibrary.filter((entry) => selectedCapabilityIds.includes(entry.id)),
    [capabilityLibrary, selectedCapabilityIds],
  );
  const recipe = useMemo(
    () => buildCapabilityRecipe(activeScope.title, selectedCapabilities),
    [activeScope.title, selectedCapabilities],
  );
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
    <div className="agent-office-shell">
      <section className="agent-office-chat">{workspaceChildren}</section>
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
          <div className="agent-office-header-actions">
            <SystemStatusPill status={systemStatus} />
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

        <ProjectTreePanel refs={productionLoop.projectTreeRefs} phase="activity_start" />

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

        <LibraryNav activeKind={activeCapabilityKind} onSelectKind={setActiveCapabilityKind} />

        <CapabilityLibrary
          entries={capabilityLibrary}
          activeKind={activeCapabilityKind}
          selectedIds={selectedCapabilityIds}
          onToggle={toggleCapability}
        />

        <ComposeRecipePanel recipe={recipe} />

        <WorldClassAssessment assessment={worldClassAssessment} />

        <CanvasWorkspace mode={activeScope} onCopyPrompt={insertPrompt} />

        <BrokerageRouteCard card={brokerageRouteCard} />

        <section className="wdc-object-card-section" aria-label="WDC visual object cards">
          <div className="agent-office-panel-head">
            <div>
              <div className="agent-office-workstrip-label">WDC objects</div>
              <strong>Readable process cards</strong>
            </div>
            <span>no raw JSON default</span>
          </div>
          <div className="wdc-object-card-grid">
            {wdcObjectCards.map((card) => (
              <WDCObjectCard key={card.id} card={card} />
            ))}
          </div>
        </section>

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
            BuildabilityLedger: {buildabilityLedger.length - buildabilityBlockedCount}/
            {buildabilityLedger.length} ready; blocked {buildabilityBlockedCount}. WorkBOM and
            RouteCatalog stay separate from runtime proof.
          </p>
          <p>
            EvidenceContractLedger:{" "}
            {evidenceContractLedger.length - evidenceContractIncompleteCount}/
            {evidenceContractLedger.length} complete; incomplete {evidenceContractIncompleteCount}.
            source_fit_score and extraction_contract stay visible.
          </p>
          <p>
            MappingCandidateLedger: candidates {mappingCandidateLedger.length} / mapped{" "}
            {mappingMappedCount}; every production-loop edge keeps source_fit_score and
            extraction_contract candidate-only.
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
            CoverageMatrix: {coverageMatrix.length - coverageDebtCount}/{coverageMatrix.length}{" "}
            covered; debt {coverageDebtCount}. Required/provided matching remains primary.
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
          <p>
            ProofAdoptionLadder: {proofAdoptionLadder.length - proofAdoptionBlockedCount}/
            {proofAdoptionLadder.length} satisfied; blocked {proofAdoptionBlockedCount}.
          </p>
          <p>
            StopConditionLedger: {stopConditionBlockedCount} promotion blockers. Candidate counts,
            readback and missing corpus evidence remain proof-ineligible.
          </p>
        </div>

        <div className="agent-office-governance-grid">
          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">EvidenceContractLedger</div>
                <strong>Fit score + extraction</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {evidenceContractLedger.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.status}</code>
                  <span title={item.contractArtifact}>{item.label}</span>
                  <small title={item.proofBoundary}>
                    {item.source_fit_score === null
                      ? item.source
                      : `${item.source} ${item.source_fit_score.toFixed(2)}`}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">MappingCandidateLedger</div>
                <strong>Loop edges</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {mappingCandidateLedger.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.state}</code>
                  <span title={item.proofBoundary}>
                    {item.source_ref} -&gt; {item.target_ref}
                  </span>
                  <small title={item.extraction_contract.contract_version}>
                    {item.source_fit_score.toFixed(2)}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="agent-office-mini-panel">
            <div className="agent-office-panel-head">
              <div>
                <div className="agent-office-workstrip-label">BuildabilityLedger</div>
                <strong>WorkBOM + RouteCatalog</strong>
              </div>
            </div>
            <div className="agent-office-ref-list">
              {buildabilityLedger.map((item) => (
                <div key={item.id} className="agent-office-ref-row">
                  <code>{item.status}</code>
                  <span title={item.proofBoundary}>{item.label}</span>
                  <small>{item.source}</small>
                </div>
              ))}
            </div>
          </section>

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

        <div className="agent-office-loop" aria-label="Production loop requirement coverage">
          <div className="agent-office-panel-head">
            <div>
              <div className="agent-office-workstrip-label">CoverageMatrix</div>
              <strong>Objective requirements</strong>
            </div>
            <span>
              covered {coverageMatrix.length - coverageDebtCount}/{coverageMatrix.length}
            </span>
          </div>
          <div className="agent-office-ref-list">
            {coverageMatrix.map((item) => (
              <div key={item.id} className="agent-office-ref-row">
                <code>{item.status}</code>
                <span title={item.proofBoundary}>{item.label}</span>
                <small>{item.evidence.length}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="agent-office-loop" aria-label="Proof adoption ladder">
          <div className="agent-office-panel-head">
            <div>
              <div className="agent-office-workstrip-label">ProofAdoptionLadder</div>
              <strong>From evidence to runtime proof</strong>
            </div>
            <span>
              satisfied {proofAdoptionLadder.length - proofAdoptionBlockedCount}/
              {proofAdoptionLadder.length}
            </span>
          </div>
          <div className="agent-office-ref-list">
            {proofAdoptionLadder.map((item) => (
              <div key={item.id} className="agent-office-ref-row">
                <code>{item.status}</code>
                <span title={item.proofBoundary}>{item.label}</span>
                <small>
                  {item.availableEvidence.length}/{item.requiredEvidence.length}
                </small>
              </div>
            ))}
          </div>
        </div>

        <div className="agent-office-loop" aria-label="Stop condition ledger">
          <div className="agent-office-panel-head">
            <div>
              <div className="agent-office-workstrip-label">StopConditionLedger</div>
              <strong>Promotion blockers</strong>
            </div>
            <span>blocked {stopConditionBlockedCount}</span>
          </div>
          <div className="agent-office-ref-list">
            {productionLoop.stopConditions.map((item) => (
              <div key={item.id} className="agent-office-ref-row">
                <code>{item.severity}</code>
                <span title={item.proofBoundary}>{item.label}</span>
                <small title={item.nextAction}>{item.source}</small>
              </div>
            ))}
          </div>
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
      </aside>
    </div>
  );
}
