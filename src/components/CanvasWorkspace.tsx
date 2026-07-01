import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Minus, Plus, RotateCcw } from "lucide-react";
import { ObjectInspector } from "@/components/ObjectInspector";
import {
  createCanvasObjectFromPalette,
  createCanvasWorkspaceDocument,
  resolveCanvasPalette,
  type CanvasObjectType,
  type CanvasWorkspaceDocument,
  type CanvasWorkspaceObject,
} from "@/lib/canvasWorkspace";
import type { WorkMode } from "@/lib/workModes";
import { cn } from "@/lib/utils";

type StoredCanvasState = {
  objects: CanvasWorkspaceObject[];
  selectedObjectId: string;
  zoom: number;
  offset: { x: number; y: number };
};

type DragState =
  | { type: "object"; id: string; startX: number; startY: number; originX: number; originY: number }
  | { type: "pan"; startX: number; startY: number; originX: number; originY: number }
  | null;

function loadStoredCanvasState(document: CanvasWorkspaceDocument): StoredCanvasState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(document.persistence.storageKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCanvasState>;
    if (!Array.isArray(parsed.objects) || parsed.objects.length === 0) return null;
    return {
      objects: parsed.objects,
      selectedObjectId: parsed.selectedObjectId ?? parsed.objects[0].id,
      zoom: typeof parsed.zoom === "number" ? parsed.zoom : 0.92,
      offset: parsed.offset ?? { x: 0, y: 0 },
    };
  } catch {
    return null;
  }
}

function getObjectCenter(object: CanvasWorkspaceObject) {
  return {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
}

function edgePath(from: CanvasWorkspaceObject, to: CanvasWorkspaceObject) {
  const a = getObjectCenter(from);
  const b = getObjectCenter(to);
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

export function CanvasWorkspace({
  mode,
  onCopyPrompt,
}: {
  mode: WorkMode;
  onCopyPrompt: () => void;
}) {
  const document = useMemo(() => createCanvasWorkspaceDocument(mode), [mode]);
  const palette = useMemo(() => resolveCanvasPalette(mode), [mode]);
  const [objects, setObjects] = useState(document.objects);
  const [selectedObjectId, setSelectedObjectId] = useState(document.objects[0].id);
  const [zoom, setZoom] = useState(0.92);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState>(null);

  useEffect(() => {
    const stored = loadStoredCanvasState(document);
    setObjects(stored?.objects ?? document.objects);
    setSelectedObjectId(stored?.selectedObjectId ?? document.objects[0].id);
    setZoom(stored?.zoom ?? 0.92);
    setOffset(stored?.offset ?? { x: 0, y: 0 });
  }, [document]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const state: StoredCanvasState = { objects, selectedObjectId, zoom, offset };
    window.localStorage.setItem(document.persistence.storageKey, JSON.stringify(state));
  }, [document.persistence.storageKey, objects, offset, selectedObjectId, zoom]);

  const selected = objects.find((object) => object.id === selectedObjectId) ?? objects[0];
  const objectById = new Map(objects.map((object) => [object.id, object]));

  const addObject = (type: CanvasObjectType) => {
    setObjects((current) => {
      const nextDocument = { ...document, objects: current };
      const object = createCanvasObjectFromPalette(nextDocument, type);
      setSelectedObjectId(object.id);
      return [...current, object];
    });
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
    setObjects((current) =>
      current.map((object) =>
        object.id === drag.id
          ? {
              ...object,
              x: drag.originX + (event.clientX - drag.startX) / zoom,
              y: drag.originY + (event.clientY - drag.startY) / zoom,
            }
          : object,
      ),
    );
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="canvas-workspace" aria-label={`${mode.label} CanvasWorkspace`}>
      <div className="agent-office-mode-palette" aria-label="Object palette">
        <div className="agent-office-workstrip-label">Object palette</div>
        <div>
          {palette.map((item) => (
            <button key={item} type="button" onClick={() => addObject(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="agent-office-workstrip">
        <div>
          <div className="agent-office-workstrip-label">Mode prompt</div>
          <p>{mode.prompt}</p>
        </div>
        <button
          type="button"
          className="agent-office-status-pill agent-office-status-pill-button"
          onClick={onCopyPrompt}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Copy
        </button>
      </div>

      <div className="agent-office-workstrip">
        <div>
          <div className="agent-office-workstrip-label">Canvas persistence</div>
          <p>{document.persistence.proofBoundary}</p>
        </div>
        <div className="agent-office-status-pill">{document.canvasMode}</div>
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
          <svg className="agent-office-links" viewBox="0 0 720 420" aria-hidden="true">
            {document.edges.map((edge) => {
              const from = objectById.get(edge.from);
              const to = objectById.get(edge.to);
              if (!from || !to) return null;
              return <path key={edge.id} d={edgePath(from, to)} />;
            })}
          </svg>
          {objects.map((object) => (
            <button
              key={object.id}
              type="button"
              className={cn(
                "agent-office-node",
                `agent-office-node-${object.tone}`,
                selected.id === object.id && "agent-office-node-selected",
              )}
              style={{
                width: object.width,
                height: object.height,
                transform: `translate(${object.x}px, ${object.y}px)`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedObjectId(object.id);
                dragRef.current = {
                  type: "object",
                  id: object.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: object.x,
                  originY: object.y,
                };
                event.currentTarget.parentElement?.parentElement?.setPointerCapture(
                  event.pointerId,
                );
              }}
            >
              <span>{object.title}</span>
              <small>
                {object.type} · {object.summary}
              </small>
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

      <ObjectInspector object={selected} document={document} />
    </section>
  );
}
