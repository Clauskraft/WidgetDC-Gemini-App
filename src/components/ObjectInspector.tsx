import { Crosshair, Network, Settings2 } from "lucide-react";
import type { CanvasWorkspaceDocument, CanvasWorkspaceObject } from "@/lib/canvasWorkspace";

export type InspectableObject = {
  title: string;
  type: string;
  summary: string;
  proofBoundary: string;
  status?: string;
  nextAction?: string;
  sections?: Array<{ label: string; value: string }>;
  meta?: Array<{ label: string; value: string }>;
};

export type ObjectInspectorProps =
  | {
      object: CanvasWorkspaceObject;
      document: CanvasWorkspaceDocument;
      item?: never;
    }
  | {
      item: InspectableObject;
      object?: never;
      document?: never;
    };

function fromCanvasObject(
  object: CanvasWorkspaceObject,
  document: CanvasWorkspaceDocument,
): InspectableObject {
  return {
    title: object.title,
    type: object.type,
    summary: object.summary,
    proofBoundary: object.proofBoundary,
    meta: [
      { label: "canvas", value: document.canvasMode },
      { label: "persistence", value: document.persistence.kind },
    ],
  };
}

export function ObjectInspector(props: ObjectInspectorProps) {
  const inspected = "item" in props ? props.item : fromCanvasObject(props.object, props.document);
  const sections = inspected.sections ?? [];
  const meta = inspected.meta ?? [];

  return (
    <div className="agent-office-inspector" aria-label="Object inspector">
      <div className="agent-office-inspector-icon">
        <Crosshair className="h-4 w-4" />
      </div>
      <div>
        <div className="agent-office-workstrip-label">Object inspector</div>
        <strong>{inspected.title}</strong>
        <p>
          {inspected.type} · {inspected.summary}
        </p>
        <p>{inspected.proofBoundary}</p>
        {inspected.nextAction ? <p>{`Next safe action: ${inspected.nextAction}`}</p> : null}
        {sections.length ? (
          <div className="agent-office-ref-list" aria-label="Inspector sections">
            {sections.map((section) => (
              <div key={section.label} className="agent-office-ref-row">
                <code>{section.label}</code>
                <span>{section.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="agent-office-inspector-meta">
        {meta.map((item) => (
          <span key={item.label}>{`${item.label}: ${item.value}`}</span>
        ))}
      </div>
      <Network className="ml-auto h-4 w-4 text-muted-foreground" />
      <Settings2 className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
