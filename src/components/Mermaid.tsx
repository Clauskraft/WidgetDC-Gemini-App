import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Move, Hand, Maximize2, Minimize2, Scaling, X, Cpu, Layers, Wifi, Terminal, Search, ArrowRight } from "lucide-react";
import mermaid from "mermaid";

// Interface for rich visual metadata details
interface ComponentMeta {
  category: string;
  spec: string;
  latency: string;
  uptime: string;
  description: string;
  tier: "Core" | "Agentic Layer" | "External Integration" | "Database / State";
  throughput: string;
}

// Built-in registry of known architectural nodes in the WidgeTDC system ecosystem
const METADATA_REGISTRY: Record<string, ComponentMeta> = {
  database: {
    category: "Primary Catalog Cache",
    spec: "Cloud Spanner / Local Postgres Cache",
    latency: "0.85 ms",
    uptime: "99.99%",
    description: "Serves as the durable system of record for thread logs, user workspace settings, and cached agent plans. Supports transactional queries under high throughput.",
    tier: "Database / State",
    throughput: "1.2k queries/sec"
  },
  db: {
    category: "Primary Catalog Cache",
    spec: "Cloud Spanner / Local Postgres Cache",
    latency: "0.85 ms",
    uptime: "99.99%",
    description: "Serves as the durable system of record for thread logs, user workspace settings, and cached agent plans. Supports transactional queries under high throughput.",
    tier: "Database / State",
    throughput: "1.2k queries/sec"
  },
  neo4j: {
    category: "Knowledge Graph Engine",
    spec: "Neo4j Enterprise Vector Graph v5",
    latency: "2.1 ms",
    uptime: "99.95%",
    description: "Maintains semantic entity relationship map. Tracks multi-hop links between systems, code blueprints, and execution pipelines.",
    tier: "Database / State",
    throughput: "450 indexings/sec"
  },
  graph: {
    category: "Knowledge Graph Engine",
    spec: "Neo4j Enterprise Vector Graph v5",
    latency: "2.1 ms",
    uptime: "99.95%",
    description: "Maintains semantic entity relationship map. Tracks multi-hop links between systems, code blueprints, and execution pipelines.",
    tier: "Database / State",
    throughput: "450 indexings/sec"
  },
  spanner: {
    category: "Enterprise Datastore",
    spec: "Google Cloud Spanner",
    latency: "1.1 ms",
    uptime: "99.999%",
    description: "Scalable global relational catalog. Keeps schema definitions and persistent system blueprints aligned with zero-downtime replications.",
    tier: "Database / State",
    throughput: "2.5k queries/sec"
  },
  postgresql: {
    category: "Relational Index Engine",
    spec: "PostgreSQL v15",
    latency: "0.9 ms",
    uptime: "99.99%",
    description: "Highly stable state database for user history, operational diagnostic results, and configuration files.",
    tier: "Database / State",
    throughput: "980 queries/sec"
  },
  supabase: {
    category: "Backend-as-a-Service State Store",
    spec: "Supabase Postgres & Authentication",
    latency: "1.4 ms",
    uptime: "99.98%",
    description: "Hosts remote workspace tables and user identity tokens. Facilitates real-time thread synchronization and multi-client updates.",
    tier: "Database / State",
    throughput: "1.0k queries/sec"
  },
  auth: {
    category: "Security Identity Gateway",
    spec: "Supabase JWT Validator Layer",
    latency: "1.1 ms",
    uptime: "100.00%",
    description: "Guards incoming REST operations. Validates claims, user contexts, and restricts multi-tenant boundaries under secure cryptographically signed tokens.",
    tier: "Core",
    throughput: "320 auths/sec"
  },
  identity: {
    category: "Security Identity Gateway",
    spec: "Supabase JWT Validator Layer",
    latency: "1.1 ms",
    uptime: "100.00%",
    description: "Guards incoming REST operations. Validates claims, user contexts, and restricts multi-tenant boundaries under secure cryptographically signed tokens.",
    tier: "Core",
    throughput: "320 auths/sec"
  },
  ingress: {
    category: "Reverse Proxy Router",
    spec: "Nginx Ingress Edge Router",
    latency: "0.3 ms",
    uptime: "100.00%",
    description: "Accepts primary HTTP/WebSocket connections on port 3000. Forwards requests to local express services or static React workspace content.",
    tier: "Core",
    throughput: "4.8k requests/sec"
  },
  gateway: {
    category: "Reverse Proxy Router",
    spec: "Nginx Ingress Edge Router",
    latency: "0.3 ms",
    uptime: "100.00%",
    description: "Accepts primary HTTP/WebSocket connections on port 3000. Forwards requests to local express services or static React workspace content.",
    tier: "Core",
    throughput: "4.8k requests/sec"
  },
  architect: {
    category: "Orchestration & Reasoning LLM",
    spec: "ArchitectGPT Runtime Engine",
    latency: "850 ms",
    uptime: "99.99%",
    description: "Performs agentic reason-and-act task routing, parses incoming multi-modal requests, and maps tools to executable plans.",
    tier: "Agentic Layer",
    throughput: "35 tps"
  },
  llm: {
    category: "Orchestration & Reasoning LLM",
    spec: "ArchitectGPT Runtime Engine",
    latency: "850 ms",
    uptime: "99.99%",
    description: "Performs agentic reason-and-act task routing, parses incoming multi-modal requests, and maps tools to executable plans.",
    tier: "Agentic Layer",
    throughput: "35 tps"
  },
  orchestrator: {
    category: "Agent Router & Planner",
    spec: "Dynamic Intent Routing Script",
    latency: "4.2 ms",
    uptime: "100.00%",
    description: "Inspects incoming queries to match system intents. Orchestrates execution of NotebookLM, GraphRAG, and TDD diagnostic pipelines.",
    tier: "Agentic Layer",
    throughput: "140 flows/sec"
  },
  agent: {
    category: "Agent Router & Planner",
    spec: "Dynamic Intent Routing Script",
    latency: "4.2 ms",
    uptime: "100.00%",
    description: "Inspects incoming queries to match system intents. Orchestrates execution of NotebookLM, GraphRAG, and TDD diagnostic pipelines.",
    tier: "Agentic Layer",
    throughput: "140 flows/sec"
  },
  notebooklm: {
    category: "Contextual Document Grounding",
    spec: "NotebookLM Pipeline Controller",
    latency: "250 ms",
    uptime: "99.95%",
    description: "Dynamically accesses private uploaded user documents and reference text sources to ground queries with absolute domain facts.",
    tier: "External Integration",
    throughput: "24 queries/sec"
  },
  graphrag: {
    category: "Topological Search Retriever",
    spec: "GraphRAG Integration Controller",
    latency: "1.4s",
    uptime: "99.90%",
    description: "Synthesizes dual-retrieval indexes by matching dense vector similarity with structural entity path relationships across Neo4j nodes.",
    tier: "External Integration",
    throughput: "12 lookups/sec"
  },
  sonar: {
    category: "Operational Health Telemetry",
    spec: "Automated Telemetry Receiver Daemon",
    latency: "10 ms",
    uptime: "100.00%",
    description: "Continuously tracks microservice latencies, connection pool statistics, and detects network partitions in sandbox runtime layers.",
    tier: "Core",
    throughput: "100 pings/sec"
  },
  pulse: {
    category: "Operational Health Telemetry",
    spec: "Automated Telemetry Receiver Daemon",
    latency: "10 ms",
    uptime: "100.00%",
    description: "Continuously tracks microservice latencies, connection pool statistics, and detects network partitions in sandbox runtime layers.",
    tier: "Core",
    throughput: "100 pings/sec"
  },
  tdd: {
    category: "Continuous Diagnostic Pipeline",
    spec: "Jest Coverage Unit Spec Runner",
    latency: "18 ms",
    uptime: "100.00%",
    description: "Validates code deployments and mock integrations across active branches. Prevents breaking changes from migrating into staging environments.",
    tier: "Core",
    throughput: "8 suites/sec"
  },
  test: {
    category: "Continuous Diagnostic Pipeline",
    spec: "Jest Coverage Unit Spec Runner",
    latency: "18 ms",
    uptime: "100.00%",
    description: "Validates code deployments and mock integrations across active branches. Prevents breaking changes from migrating into staging environments.",
    tier: "Core",
    throughput: "8 suites/sec"
  },
  dashboard: {
    category: "Workspace Operations Console",
    spec: "React Analytics Client Dashboard",
    latency: "1.1 ms",
    uptime: "100.00%",
    description: "Standard web controller designed for developers to inspect live agent chains, toggle Mermaid diagram themes, and issue test sonar pulses.",
    tier: "Core",
    throughput: "Unlimited"
  }
};

export const getComponentMetadata = (id: string, label: string): ComponentMeta => {
  const normId = id.toLowerCase();
  const normLabel = label.toLowerCase();

  // Try to match key terms
  for (const key of Object.keys(METADATA_REGISTRY)) {
    if (normId.includes(key) || normLabel.includes(key)) {
      return METADATA_REGISTRY[key];
    }
  }

  // Fallback defaults
  return {
    category: "Architectural Microservice Node",
    spec: "WidgeTDC Component Grid Specs",
    latency: "1.4 ms",
    uptime: "99.98%",
    description: `Active system element representing the "${label}" component within the graph. Responsible for processing and routing related telemetry and payload messages.`,
    tier: "Core",
    throughput: "Nominal"
  };
};

export const Mermaid = ({ 
  chart,
  onNodeClick,
  highlightedNode
}: { 
  chart: string;
  onNodeClick?: (node: { id: string; label: string }) => void;
  highlightedNode?: { id: string; label: string } | null;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("widgetdc_theme") || "dark");

  // Zoom & Pan Interactive States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragMoveDistance = useRef(0);

  // Selected component node details for the popover panel
  const [selectedComp, setSelectedComp] = useState<{ id: string; label: string } | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  // Simulated node diagnostics sandbox
  const [pinging, setPinging] = useState(false);
  const [pingLogs, setPingLogs] = useState<string[]>([]);

  // Node search & filtering state
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");
  const [diagramNodes, setDiagramNodes] = useState<{ id: string; label: string }[]>([]);

  const extractNodeDetails = (nodeEl: Element) => {
    const labels = nodeEl.querySelectorAll(".nodeLabel, text, .label");
    let nodeLabel = "";
    if (labels && labels.length > 0) {
      const textArr: string[] = [];
      labels.forEach(el => {
        if (el.textContent) {
          textArr.push(el.textContent.trim());
        }
      });
      nodeLabel = textArr.join(" ");
    } else {
      nodeLabel = nodeEl.textContent?.trim() || "Workspace Node";
    }

    // Deduplicate adjacent repeating words often introduced by SVG layout clones
    const words = nodeLabel.split(/\s+/);
    const uniqueWords: string[] = [];
    words.forEach(w => {
       if (uniqueWords[uniqueWords.length - 1] !== w) {
          uniqueWords.push(w);
       }
    });
    const cleanLabel = uniqueWords.join(" ").replace(/[\r\n]+/g, " ");
    const nodeId = nodeEl.id || "";
    return { id: nodeId, label: cleanLabel || "Core Service" };
  };

  const filteredNodes = diagramNodes.filter(node => {
    const lower = nodeSearchQuery.toLowerCase();
    return node.id.toLowerCase().includes(lower) || node.label.toLowerCase().includes(lower);
  });

  const handleFitToView = () => {
    if (!containerRef.current || !wrapperRef.current) return;
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    let svgWidth = 0;
    let svgHeight = 0;

    // 1. Try to parsed viewBox attribute
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        svgWidth = parts[2];
        svgHeight = parts[3];
      }
    }

    // 2. Fallback to getBBox
    if (svgWidth === 0 || svgHeight === 0) {
      try {
        const bbox = (svg as any).getBBox();
        if (bbox && bbox.width > 0 && bbox.height > 0) {
          svgWidth = bbox.width;
          svgHeight = bbox.height;
        }
      } catch (e) {
        // ignore
      }
    }

    // 3. Fallback to width/height properties
    if (svgWidth === 0 || svgHeight === 0) {
      const attrWidth = parseFloat(svg.getAttribute("width") || "0");
      const attrHeight = parseFloat(svg.getAttribute("height") || "0");
      if (attrWidth > 0 && attrHeight > 0) {
        svgWidth = attrWidth;
        svgHeight = attrHeight;
      } else {
        const rect = svg.getBoundingClientRect();
        svgWidth = rect.width;
        svgHeight = rect.height;
      }
    }

    if (svgWidth === 0 || svgHeight === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Calculate fit spacing with surrounding padding
    const padding = 48;
    const availableWidth = Math.max(wrapperRect.width - padding * 2, 100);
    const availableHeight = Math.max(wrapperRect.height - padding * 2, 100);

    const scaleX = availableWidth / svgWidth;
    const scaleY = availableHeight / svgHeight;
    const idealZoom = Math.min(scaleX, scaleY);
    const constrainedZoom = Math.min(Math.max(idealZoom, 0.1), 2.0);

    setZoom(constrainedZoom);
    setPan({ x: 0, y: 0 });
  };

  // Full-screen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keyboard shortcut to collapse full-screen (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        if (isSidePanelOpen) {
          setIsSidePanelOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, isSidePanelOpen]);

  // Reset states when diagram changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedComp(null);
    setIsSidePanelOpen(false);
    setPingLogs([]);
    setNodeSearchQuery("");
    setDiagramNodes([]);
  }, [chart, theme]);

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem("widgetdc_theme") || "dark");
    };
    window.addEventListener("theme-changed", handleThemeChange);
    return () => {
      window.removeEventListener("theme-changed", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Dynamically re-initialize mermaid for the active rendering run
    mermaid.initialize({
      startOnLoad: false,
      theme: theme as any,
      securityLevel: "loose",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
    });

    if (containerRef.current) {
      mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart).then((result) => {
         if (containerRef.current && isMounted) {
            containerRef.current.innerHTML = result.svg;
            const svg = containerRef.current.querySelector('svg');
            if (svg) {
                const viewBox = svg.getAttribute("viewBox");
                const viewBoxParts = viewBox?.split(/[\s,]+/).map(Number) || [];
                const intrinsicWidth =
                  viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[2]) && viewBoxParts[2] > 0
                    ? viewBoxParts[2]
                    : null;
                const intrinsicHeight =
                  viewBoxParts.length === 4 && Number.isFinite(viewBoxParts[3]) && viewBoxParts[3] > 0
                    ? viewBoxParts[3]
                    : null;
                svg.style.maxWidth = "none";
                svg.style.width = intrinsicWidth ? `${intrinsicWidth}px` : "max-content";
                svg.style.height = intrinsicHeight ? `${intrinsicHeight}px` : "auto";
                svg.style.userSelect = "none";
            }

            // Extract rendered nodes for side panel view list & filtering matches
            const nodeElements = containerRef.current.querySelectorAll('.node');
            const extracted: { id: string; label: string }[] = [];
            nodeElements.forEach(el => {
              extracted.push(extractNodeDetails(el));
            });
            setDiagramNodes(extracted);
            requestAnimationFrame(() => {
              requestAnimationFrame(handleFitToView);
            });
            window.setTimeout(handleFitToView, 180);
         }
      }).catch(e => {
         console.error(e);
         if (containerRef.current && isMounted) {
             containerRef.current.innerHTML = `<div class="text-red-400 p-4 font-mono text-sm">Failed to render Mermaid diagram</div>`;
         }
      });
    }
    return () => { isMounted = false; };
  }, [chart, theme]);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(handleFitToView);
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [chart, theme, isFullscreen]);

  // Synchronize internal select state with parent highlightedNode prop
  useEffect(() => {
    if (highlightedNode) {
      const match = diagramNodes.find(node => 
        node.id.toLowerCase() === highlightedNode.id.toLowerCase() ||
        node.label.toLowerCase() === highlightedNode.label.toLowerCase()
      );
      if (match) {
        setSelectedComp(match);
        setIsSidePanelOpen(true);
      }
    }
  }, [highlightedNode, diagramNodes]);

  // Apply real-time node highlighting and filtering with smooth CSS transitions
  useEffect(() => {
    if (!containerRef.current) return;
    const nodeElements = containerRef.current.querySelectorAll('.node');
    const lowerQuery = nodeSearchQuery.trim().toLowerCase();
    const activeLabel = highlightedNode?.label.toLowerCase() || "";
    const activeId = highlightedNode?.id.toLowerCase() || "";

    if (!lowerQuery && !activeLabel && !activeId) {
      // Clear filters & restore default styling
      nodeElements.forEach((el) => {
        const hEl = el as HTMLElement;
        hEl.style.opacity = "";
        hEl.style.filter = "";
        hEl.style.transform = "";
        hEl.style.transition = "all 0.3s ease";
      });
      return;
    }

    nodeElements.forEach((el) => {
      const hEl = el as HTMLElement;
      const details = extractNodeDetails(hEl);
      const isSearchMatch = lowerQuery && (
        details.id.toLowerCase().includes(lowerQuery) || 
        details.label.toLowerCase().includes(lowerQuery)
      );
      const isClickedMatch = (activeId && details.id.toLowerCase() === activeId) || 
                             (activeLabel && details.label.toLowerCase() === activeLabel);

      if (isSearchMatch || isClickedMatch) {
        hEl.style.opacity = "1";
        // Standout glow styling
        hEl.style.filter = "brightness(1.25) drop-shadow(0px 0px 14px rgba(99,102,241,0.95))";
        hEl.style.transform = "scale(1.05)";
        hEl.style.transformOrigin = "center";
        hEl.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
      } else {
        hEl.style.opacity = "0.15";
        hEl.style.filter = "grayscale(0.6) opacity(0.3) blur(0.5px)";
        hEl.style.transform = "scale(0.97)";
        hEl.style.transformOrigin = "center";
        hEl.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
      }
    });
  }, [nodeSearchQuery, diagramNodes, highlightedNode]);

  // Touch and Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only accept left click
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragMoveDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    dragMoveDistance.current = Math.sqrt(dx * dx + dy * dy);

    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const direction = e.deltaY < 0 ? 1 : -1;
    setZoom((prevZoom) => {
      const nextZoom = prevZoom + direction * zoomFactor;
      return Math.min(Math.max(nextZoom, 0.1), 4);
    });
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z + 0.15, 4));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z - 0.15, 0.1));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Click on diagram to intercept node selection via event delegation
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If user panned/dragged, don't trigger click action
    if (dragMoveDistance.current > 6) {
      return;
    }

    const target = e.target as HTMLElement;
    const nodeEl = target.closest(".node");

    if (nodeEl) {
      e.stopPropagation();

      // Retrieve and sanitize text content of the node label
      const labels = nodeEl.querySelectorAll(".nodeLabel, text, .label");
      let nodeLabel = "";
      if (labels && labels.length > 0) {
        const textArr: string[] = [];
        labels.forEach(el => {
          if (el.textContent) {
            textArr.push(el.textContent.trim());
          }
        });
        nodeLabel = textArr.join(" ");
      } else {
        nodeLabel = nodeEl.textContent?.trim() || "Workspace Node";
      }

      // Deduplicate adjacent repeating words often introduced by SVG layout clones
      const words = nodeLabel.split(/\s+/);
      const uniqueWords: string[] = [];
      words.forEach(w => {
         if (uniqueWords[uniqueWords.length - 1] !== w) {
            uniqueWords.push(w);
         }
      });
      const cleanLabel = uniqueWords.join(" ").replace(/[\r\n]+/g, " ");
      const nodeId = nodeEl.id || "";

      const comp = {
         id: nodeId,
         label: cleanLabel || "Core Service"
      };
      setSelectedComp(comp);
      setPingLogs([]);
      setIsSidePanelOpen(true);
      if (onNodeClick) {
         onNodeClick(comp);
      }
    }
  };

  // Run mock telemetry ping simulator
  const runNodePing = () => {
    if (!selectedComp || pinging) return;
    setPinging(true);
    setPingLogs([`[INFO] Starting diagnostic pulse for node ${selectedComp.id}...`]);

    setTimeout(() => {
      setPingLogs(prev => [...prev, `[PING] Roundtrip measured: ${getComponentMetadata(selectedComp.id, selectedComp.label).latency}`]);
    }, 400);

    setTimeout(() => {
      setPingLogs(prev => [...prev, `[HEALTH] Schema verification status: NOMINAL`]);
    }, 800);

    setTimeout(() => {
      setPingLogs(prev => [...prev, `[SUCCESS] Connection secure. Operational status is inside acceptable bounds.`]);
      setPinging(false);
    }, 1200);
  };

  const currentMeta = selectedComp ? getComponentMetadata(selectedComp.id, selectedComp.label) : null;

  return (
    <div 
      ref={wrapperRef}
      className={`select-none overflow-auto group/mermaid bg-[#141517] transition-all duration-300 relative ${
        isFullscreen 
          ? "fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none" 
          : "relative w-full h-full rounded-none border-0"
      }`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
      onClick={handleContainerClick}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .node {
          cursor: pointer !important;
          pointer-events: auto !important;
          transition: filter 0.2s, opacity 0.2s, transform 0.2s !important;
        }
        .node:hover {
          filter: brightness(1.2) drop-shadow(0px 0px 8px rgba(99,102,241,0.5)) !important;
          opacity: 0.95 !important;
        }
      `}} />

      {/* Floating Canvas Action Bar */}
      <div className="absolute right-4 top-4 bg-[#1e1e21]/90 border border-[#262629] rounded-xl p-1.5 flex items-center gap-2 shadow-2xl z-20 backdrop-blur-md opacity-100 md:opacity-0 md:group-hover/mermaid:opacity-100 transition-opacity duration-300">
        <div className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#131416] border border-[#2a2b30] text-[#c4c4ca]">
          {Math.round(zoom * 100)}%
        </div>
        
        <div className="h-4 w-[1px] bg-[#2a2b30] mx-0.5" />

        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2c2d30] transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2c2d30] transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleFitToView}
          title="Fit to View"
          className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2c2d30] transition-colors flex items-center justify-center"
        >
          <Scaling className="w-4 h-4 text-emerald-400" />
        </button>

        <button
          onClick={handleReset}
          title="Reset Zoom & Pan"
          className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2c2d30] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-[#2a2b30] mx-0.5" />

        <button
          onClick={() => {
            setIsSidePanelOpen(!isSidePanelOpen);
          }}
          title={isSidePanelOpen ? "Close Side Explorer" : "Search & Highlight Nodes"}
          className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
            isSidePanelOpen ? "text-[#4da1fe] bg-[#2c2d30]" : "text-[#8e8e93] hover:text-white hover:bg-[#2c2d30]"
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-[#2a2b30] mx-0.5" />

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? "Exit Full Screen (Esc)" : "Full Screen View"}
          className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2c2d30] transition-colors flex items-center justify-center"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400 animate-pulse" /> : <Maximize2 className="w-4 h-4 text-indigo-400" />}
        </button>
      </div>

      {/* Floating Hint for Usability */}
      <div className="absolute bottom-4 left-4 pointer-events-none text-[10px] font-medium text-[#8e8e93] flex items-center gap-1.5 bg-[#18191b]/80 backdrop-blur-sm border border-[#262629]/60 px-2.5 py-1 rounded-full z-10 opacity-100 group-hover/mermaid:opacity-0 transition-opacity duration-300">
        <Hand className="w-3.5 h-3.5" />
        <span>Drag to pan, Scroll to zoom • Click node for details{isFullscreen && " • Esc to exit"}</span>
      </div>

      {/* Architectural Node Metadata Interactive Side Sheet */}
      <div 
        className={`absolute top-0 right-0 h-full w-[340px] sm:w-[380px] bg-[#17181c]/95 border-l border-[#262629] backdrop-blur-xl z-20 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isSidePanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()} // Stop bubbling so clicking the panel doesn't close it
      >
        {isSidePanelOpen && (
          <>
            {/* Slide Sheet Header */}
            <div className="p-4 border-b border-[#25262a] flex items-center justify-between bg-[#191a1e]/80 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 font-mono">
                    System Explorer
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#f4f4f5] tracking-tight">
                  {selectedComp ? "Component Details" : "Diagram Nodes"}
                </h3>
              </div>

              <button
                onClick={() => setIsSidePanelOpen(false)}
                className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#25262a] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Integrated Search Tool always visible inside side panel */}
            <div className="p-4 border-b border-[#25262a]/60 bg-[#141518] space-y-2 shrink-0">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-[#8e8e93] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter and highlight nodes..."
                  value={nodeSearchQuery}
                  onChange={(e) => setNodeSearchQuery(e.target.value)}
                  className="w-full bg-[#0c0d0f] border border-[#2a2b30] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl pl-9 pr-8 py-2 text-xs text-white outline-none placeholder:text-[#68686d] transition-all"
                />
                {nodeSearchQuery && (
                  <button
                    onClick={() => setNodeSearchQuery("")}
                    className="absolute right-2.5 p-1 text-[#8e8e93] hover:text-white rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {nodeSearchQuery && (
                <div className="text-[10px] font-mono text-[#8a8a93] flex justify-between items-center px-1">
                  <span>Highlighted in diagram</span>
                  <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-semibold scale-95">
                    Filtering
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable Main Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {selectedComp && currentMeta ? (
                <>
                  {/* Selected Component Header card */}
                  <div className="bg-[#1c1d22] border border-[#26272c] rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-[#8e8e93] tracking-wider">Active Selection</span>
                      <button 
                        onClick={() => setSelectedComp(null)}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Node List</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white tracking-tight leading-snug">
                        {selectedComp.label}
                      </h4>
                      <span className="inline-block text-[9px] font-mono text-[#8a8a93] bg-[#0c0d0f] px-1.5 py-0.5 rounded border border-[#1e1f24] mt-1 select-all">
                        ID: {selectedComp.id}
                      </span>
                    </div>
                  </div>

                  {/* Category Classification */}
                  <div className="space-y-1 bg-[#1d1f24]/50 border border-[#24262b] rounded-xl p-3">
                    <div className="text-[10px] text-[#8e8e93] font-mono uppercase tracking-wider">Classification</div>
                    <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{currentMeta.category}</span>
                    </div>
                    <div className="text-[10px] text-indigo-300 font-mono italic">
                      Tier: {currentMeta.tier}
                    </div>
                  </div>

                  {/* Functional Role Description */}
                  <div className="space-y-1.5">
                    <h4 className="text-[11px] uppercase text-[#8e8e93] font-mono font-semibold tracking-wider">Architectural Role</h4>
                    <p className="text-xs text-[#b4b4bb] leading-relaxed">
                      {currentMeta.description}
                    </p>
                  </div>

                  {/* Technical Specifications Grid */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] uppercase text-[#8e8e93] font-mono font-semibold tracking-wider">Active Specifications</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-[#121316] border border-[#1e1f24] p-2.5 rounded-lg space-y-1">
                        <div className="text-[#8e8e93] text-[9px] uppercase">Engine/Spec</div>
                        <div className="text-white truncate" title={currentMeta.spec}>{currentMeta.spec}</div>
                      </div>
                      <div className="bg-[#121316] border border-[#1e1f24] p-2.5 rounded-lg space-y-1">
                        <div className="text-[#8e8e93] text-[9px] uppercase">Uptime</div>
                        <div className="text-white">{currentMeta.uptime}</div>
                      </div>
                      <div className="bg-[#121316] border border-[#1e1f24] p-2.5 rounded-lg space-y-1">
                        <div className="text-[#8e8e93] text-[9px] uppercase font-bold text-indigo-400">Response</div>
                        <div className="text-indigo-300 font-bold">{currentMeta.latency}</div>
                      </div>
                      <div className="bg-[#121316] border border-[#1e1f24] p-2.5 rounded-lg space-y-1">
                        <div className="text-[#8e8e93] text-[9px] uppercase">Throughput</div>
                        <div className="text-white">{currentMeta.throughput}</div>
                      </div>
                    </div>
                  </div>

                  {/* Component Telemetry Testing Console */}
                  <div className="pt-2">
                    <div className="border border-[#262629] rounded-xl p-4 bg-[#0a0a0c] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#8a8a93] uppercase tracking-wider flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Node Probe Console</span>
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                          v1.45
                        </span>
                      </div>

                      <button
                        onClick={runNodePing}
                        disabled={pinging}
                        className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                      >
                        <Cpu className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
                        <span>{pinging ? "Sending Ping..." : "Run Active Node Diagnostic"}</span>
                      </button>

                      {pingLogs.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-[#121316] border border-[#1d1f24] font-mono text-[10px] space-y-1 text-[#a5f3fc] overflow-x-auto max-h-[120px] scrollbar-thin">
                          {pingLogs.map((log, index) => (
                            <div key={index} className="whitespace-pre-nowrap border-l-2 border-indigo-500 pl-1.5 py-0.5 leading-snug">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Node list view and list search results */
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#8e8e93] font-mono px-1">
                    <span>Components Found ({filteredNodes.length})</span>
                    <span>Click to Inspect Spec</span>
                  </div>
                  
                  <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredNodes.map((node) => {
                      const meta = getComponentMetadata(node.id, node.label);
                      return (
                        <button
                          key={node.id}
                          onClick={() => {
                            setSelectedComp(node);
                            setPingLogs([]);
                            if (onNodeClick) {
                              onNodeClick(node);
                            }
                          }}
                          className="w-full text-left p-3 rounded-xl bg-[#1d1e22]/40 hover:bg-[#232429] border border-[#26272c]/80 hover:border-indigo-500/40 transition-all flex items-start justify-between group cursor-pointer"
                        >
                          <div className="space-y-1 pr-2 truncate">
                            <div className="font-semibold text-xs text-white group-hover:text-indigo-400 transition-colors truncate">
                              {node.label}
                            </div>
                            <div className="text-[10px] text-[#8e8e93] font-mono truncate">
                              ID: {node.id}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                              {meta.tier}
                            </span>
                            <span className="text-[9px] font-mono text-[#8a8a93]">
                              {meta.latency}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    
                    {filteredNodes.length === 0 && (
                      <div className="p-8 text-center text-xs text-[#8e8e93] border border-dashed border-[#2a2b30] rounded-xl bg-[#141517]/30 space-y-1">
                        <p>No components match your search</p>
                        <button
                          onClick={() => setNodeSearchQuery("")}
                          className="text-xs text-indigo-400 hover:underline mt-1 font-medium"
                        >
                          Clear Search Query
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Slide Sheet Footer Metadata Context */}
            <div className="p-4 border-t border-[#25262a] bg-[#111215] flex items-center justify-between text-[10px] text-[#8e8e93] font-mono shrink-0">
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Sync state: Live</span>
              </span>
              <span>REST JSON Layer</span>
            </div>
          </>
        )}
      </div>

      {/* Actual Render Viewport */}
      <div 
        className="min-w-full min-h-full inline-flex justify-center items-center p-8 text-center select-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "top left",
          transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
          cursor: isDragging ? "grabbing" : "grab"
        }}
      >
        <div 
          ref={containerRef} 
          className="inline-flex min-w-max min-h-max justify-center items-center pointer-events-auto" 
        />
      </div>
    </div>
  );
};
