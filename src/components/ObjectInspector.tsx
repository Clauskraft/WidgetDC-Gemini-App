import { Crosshair, Network, Settings2 } from "lucide-react";
import type { CanvasWorkspaceDocument, CanvasWorkspaceObject } from "@/lib/canvasWorkspace";

export type ObjectInspectorProps = {
  object: CanvasWorkspaceObject;
  document: CanvasWorkspaceDocument;
};

export function ObjectInspector({ object, document }: ObjectInspectorProps) {
  return (
    <div className="agent-office-inspector" aria-label="Object inspector">
      <div className="agent-office-inspector-icon">
        <Crosshair className="h-4 w-4" />
      </div>
      <div>
        <div className="agent-office-workstrip-label">Object inspector</div>
        <strong>{object.title}</strong>
        <p>
          {object.type} · {object.summary}
        </p>
        <p>{object.proofBoundary}</p>
      </div>
      <div className="agent-office-inspector-meta">
        <span>{document.canvasMode}</span>
        <span>{document.persistence.kind}</span>
      </div>
      <Network className="ml-auto h-4 w-4 text-muted-foreground" />
      <Settings2 className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
