import { useEffect, useMemo, useState } from "react";
import {
  browseDocumentCollection,
  loadDocumentCollections,
  runDocumentAggregation,
  runDocumentQuery,
  loadSavedVisualizations,
  saveDocumentVisualization,
  deleteDocumentVisualization,
  type DocumentCollectionSummary,
  type SavedVisualization,
} from "../../services/api";
import {
  createAdminDocument,
  deleteAdminDocument,
  updateAdminDocument,
} from "../../services/documentsAdminApi";
import type { EesSystem } from "../../services/registryApi";
import "./documents.css";

type Props = {
  adminUser: string | null;
  navigationRequest?: {
    mode: "dashboard";
    systemKey: string;
    requestId: number;
  } | null;
  systems: EesSystem[];
};
type DocumentRow = Record<string, unknown>;
type EditorMode = "view" | "create" | "edit";
type WorkspaceMode = "browse" | "aggregate" | "chart" | "saved" | "dashboard";
type ChartType = "bar" | "line" | "scatter" | "pie";

const DEFAULT_FILTER = "{}";
const DEFAULT_PIPELINE = "[\n  { \"$limit\": 25 }\n]";
const RESULT_LIMIT = 100;

function getDocumentKey(document: DocumentRow, index: number) {
  const id = document._id;
  if (typeof id === "string" || typeof id === "number") return String(id);
  if (id && typeof id === "object") return JSON.stringify(id);
  return `document-${index}`;
}

function documentId(document: DocumentRow | null): string | null {
  if (!document) return null;
  const value = document._id;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function editableDocument(document: DocumentRow) {
  const clone = { ...document };
  delete clone._id;
  return clone;
}

function parseEditorDocument(text: string): DocumentRow {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed) || parsed === null || typeof parsed !== "object") {
    throw new Error("Document must be a JSON object.");
  }
  return parsed as DocumentRow;
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function availableKeys(rows: DocumentRow[]) {
  const keys = new Set<string>();
  rows.slice(0, 50).forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
  return Array.from(keys);
}

function ChartPreview({
  rows,
  chartType,
  xKey,
  yKey,
}: {
  rows: DocumentRow[];
  chartType: ChartType;
  xKey: string;
  yKey: string;
}) {
  const points = rows
    .map((row, index) => ({
      label: String(row[xKey] ?? index + 1),
      value: numericValue(row[yKey]),
    }))
    .filter((item): item is { label: string; value: number } => item.value !== null)
    .slice(0, 30);

  if (!xKey || !yKey) {
    return <div className="documents-chart-empty">Choose an X field and numeric Y field.</div>;
  }

  if (points.length === 0) {
    return <div className="documents-chart-empty">No numeric values are available for this chart selection.</div>;
  }

  const width = 760;
  const height = 330;
  const pad = 42;
  const values = points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const x = (index: number) =>
    points.length === 1 ? width / 2 : pad + (index / (points.length - 1)) * (width - pad * 2);

  if (chartType === "pie") {
    const positive = points.filter((point) => point.value > 0);
    const total = positive.reduce((sum, point) => sum + point.value, 0);
    if (!total) return <div className="documents-chart-empty">Pie charts require positive numeric values.</div>;

    let offset = 0;
    return (
      <div className="documents-pie-layout">
        <svg className="documents-chart-svg pie" viewBox="0 0 360 360" role="img" aria-label="MongoDB aggregation pie chart">
          {positive.map((point, index) => {
            const fraction = point.value / total;
            const dash = fraction * 251.327;
            const gap = 251.327 - dash;
            const rotation = -90 + offset * 360;
            offset += fraction;
            return (
              <circle
                key={`${point.label}-${index}`}
                cx="180"
                cy="180"
                r="40"
                pathLength="251.327"
                fill="none"
                className={`documents-pie-slice slice-${index % 6}`}
                strokeWidth="72"
                strokeDasharray={`${dash} ${gap}`}
                transform={`rotate(${rotation} 180 180)`}
              />
            );
          })}
        </svg>
        <div className="documents-chart-legend">
          {positive.map((point, index) => (
            <div key={`${point.label}-legend-${index}`}>
              <span className={`legend-dot slice-${index % 6}`} />
              <span>{point.label}</span>
              <strong>{point.value}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <svg className="documents-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="MongoDB aggregation chart">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart-axis" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="chart-axis" />
      {chartType === "bar" &&
        points.map((point, index) => {
          const available = width - pad * 2;
          const barWidth = Math.max(8, Math.min(42, available / Math.max(points.length, 1) - 5));
          const xPos = pad + (index + 0.5) * (available / points.length) - barWidth / 2;
          const zeroY = y(0);
          const valueY = y(point.value);
          return (
            <g key={`${point.label}-${index}`}>
              <rect x={xPos} y={Math.min(zeroY, valueY)} width={barWidth} height={Math.max(2, Math.abs(zeroY - valueY))} className="chart-bar" rx="2" />
              <title>{`${point.label}: ${point.value}`}</title>
            </g>
          );
        })}
      {chartType === "line" && (
        <>
          <polyline
            points={points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ")}
            className="chart-line"
            fill="none"
          />
          {points.map((point, index) => (
            <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="4" className="chart-point">
              <title>{`${point.label}: ${point.value}`}</title>
            </circle>
          ))}
        </>
      )}
      {chartType === "scatter" &&
        points.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="5" className="chart-point scatter">
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        ))}
      <text x={pad} y={24} className="chart-scale-label">{max.toFixed(2)}</text>
      <text x={pad} y={height - 12} className="chart-scale-label">{min.toFixed(2)}</text>
      <text x={pad} y={height - 20} className="chart-x-label">{points[0]?.label}</text>
      <text x={width - pad} y={height - 20} textAnchor="end" className="chart-x-label">{points[points.length - 1]?.label}</text>
    </svg>
  );
}

export default function DocumentsPanel({
  adminUser,
  navigationRequest,
  systems,
}: Props) {
  const [database, setDatabase] = useState("ees_documents");
  const [collections, setCollections] = useState<DocumentCollectionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRow | null>(null);
  const [filterText, setFilterText] = useState(DEFAULT_FILTER);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorMode, setEditorMode] = useState<EditorMode>("view");
  const [editorText, setEditorText] = useState("{}");
  const [mutationRunning, setMutationRunning] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("browse");
  const [pipelineText, setPipelineText] = useState(DEFAULT_PIPELINE);
  const [aggregationResults, setAggregationResults] = useState<DocumentRow[]>([]);
  const [aggregationDuration, setAggregationDuration] = useState<number | null>(null);
  const [aggregationRunning, setAggregationRunning] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [savedCharts, setSavedCharts] = useState<SavedVisualization[]>([]);
  const [savedChartsLoading, setSavedChartsLoading] = useState(false);
  const [chartTitle, setChartTitle] = useState("");
  const [chartSystemKey, setChartSystemKey] = useState("");
  const [dashboardName, setDashboardName] = useState("EES Operations Overview");
  const [selectedDashboard, setSelectedDashboard] = useState("EES Operations Overview");
  const [selectedDashboardSystem, setSelectedDashboardSystem] = useState("ALL");
  const [saveChartRunning, setSaveChartRunning] = useState(false);
  const [saveChartMessage, setSaveChartMessage] = useState<string | null>(null);

  function registrySystemKey(system: EesSystem): string {
    const extended = system as EesSystem & {
      system_key?: string | null;
      key?: string | null;
      slug?: string | null;
    };

    return (
      extended.system_key ||
      extended.key ||
      extended.slug ||
      system.system_id
    );
  }

  function findSystemByLensValue(value: string): EesSystem | undefined {
    return systems.find((system) =>
      system.system_id === value ||
      registrySystemKey(system) === value
    );
  }

  function resetEditor() {
    setEditorMode("view");
    setEditorText("{}");
    setMutationError(null);
    setDeleteConfirm(false);
  }

  function resetAnalytics() {
    setPipelineText(DEFAULT_PIPELINE);
    setAggregationResults([]);
    setAggregationDuration(null);
    setXKey("");
    setYKey("");
  }

  async function loadCollection(name: string) {
    setSelected(name);
    setSelectedDocument(null);
    resetEditor();
    setError(null);
    setRunning(true);
    try {
      const result = await browseDocumentCollection(name, RESULT_LIMIT);
      setDocuments(result.documents || []);
    } catch (err) {
      setDocuments([]);
      setError(err instanceof Error ? err.message : "Unable to browse collection.");
    } finally {
      setRunning(false);
    }
  }

  async function refreshCollections() {
    setLoading(true);
    setError(null);
    try {
      const result = await loadDocumentCollections();
      const nextCollections = result.collections || [];
      setDatabase(result.database || "ees_documents");
      setCollections(nextCollections);
      const nextSelected =
        selected && nextCollections.some((item) => item.name === selected)
          ? selected
          : nextCollections[0]?.name ?? null;
      if (nextSelected) {
        await loadCollection(nextSelected);
      } else {
        setSelected(null);
        setDocuments([]);
        setSelectedDocument(null);
        resetEditor();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load MongoDB collections.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAfterMutation(nextDocument?: DocumentRow | null) {
    if (!selected) return;
    const catalog = await loadDocumentCollections();
    setDatabase(catalog.database || "ees_documents");
    setCollections(catalog.collections || []);
    const result = await browseDocumentCollection(selected, RESULT_LIMIT);
    setDocuments(result.documents || []);
    setSelectedDocument(nextDocument ?? null);
  }

  async function openCollection(name: string) {
    setFilterText(DEFAULT_FILTER);
    resetAnalytics();
    await loadCollection(name);
  }

  async function handleRunFilter() {
    if (!selected) return;
    setError(null);
    setRunning(true);
    try {
      const parsed = filterText.trim() ? JSON.parse(filterText) : {};
      if (Array.isArray(parsed) || parsed === null || typeof parsed !== "object") {
        throw new Error("MongoDB filter must be a JSON object.");
      }
      const result = await runDocumentQuery(selected, parsed as Record<string, unknown>, RESULT_LIMIT);
      setDocuments(result.documents || []);
      setSelectedDocument(null);
      resetEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run document query.");
    } finally {
      setRunning(false);
    }
  }

  async function handleRunAggregation() {
    if (!selected) return;
    setError(null);
    setAggregationRunning(true);
    try {
      const parsed = pipelineText.trim() ? JSON.parse(pipelineText) : [];
      if (!Array.isArray(parsed) || parsed.some((stage) => !stage || Array.isArray(stage) || typeof stage !== "object")) {
        throw new Error("MongoDB aggregation pipeline must be a JSON array of stage objects.");
      }
      const result = await runDocumentAggregation(
        selected,
        parsed as Record<string, unknown>[],
        250,
      );
      const rows = result.results || [];
      setAggregationResults(rows);
      setAggregationDuration(result.duration_ms ?? null);
      const keys = availableKeys(rows);
      const firstNumeric = keys.find((key) => rows.some((row) => numericValue(row[key]) !== null));
      const firstLabel = keys.find((key) => key !== firstNumeric) ?? keys[0] ?? "";
      setXKey((current) => (keys.includes(current) ? current : firstLabel));
      setYKey((current) => (keys.includes(current) ? current : firstNumeric ?? ""));
    } catch (err) {
      setAggregationResults([]);
      setAggregationDuration(null);
      setError(err instanceof Error ? err.message : "Unable to run MongoDB aggregation.");
    } finally {
      setAggregationRunning(false);
    }
  }

  async function refreshSavedCharts() {
    setSavedChartsLoading(true);
    try {
      const items = await loadSavedVisualizations();
      setSavedCharts(items);
      if (items.length > 0 && !items.some((item) => item.dashboard_name === selectedDashboard)) {
        setSelectedDashboard(items[0].dashboard_name || "EES Operations Overview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved visualizations.");
    } finally {
      setSavedChartsLoading(false);
    }
  }

  async function handleSaveChart() {
    if (!adminUser || !selected || !xKey || !yKey || aggregationResults.length === 0) return;
    const title = chartTitle.trim() || `${selected}: ${yKey} by ${xKey}`;
    const dashboard = dashboardName.trim() || "EES Operations Overview";
    setSaveChartRunning(true);
    setSaveChartMessage(null);
    try {
      const parsed = pipelineText.trim() ? JSON.parse(pipelineText) : [];
      if (!Array.isArray(parsed)) throw new Error("Aggregation pipeline must be a JSON array.");
      const created = await saveDocumentVisualization({
        title,
        collection: selected,
        system_key: chartSystemKey.trim() || undefined,
        dashboard_name: dashboard,
        chart_type: chartType,
        x_key: xKey,
        y_key: yKey,
        pipeline: parsed as Record<string, unknown>[],
        rows: aggregationResults.slice(0, 200),
      });
      setSavedCharts((current) => [created, ...current]);
      setSelectedDashboard(dashboard);
      setSaveChartMessage("Chart saved to dashboard.");
    } catch (err) {
      setSaveChartMessage(err instanceof Error ? err.message : "Unable to save chart.");
    } finally {
      setSaveChartRunning(false);
    }
  }

  function openSavedChart(chart: SavedVisualization) {
    setSelected(chart.collection);
    setPipelineText(JSON.stringify(chart.pipeline || [], null, 2));
    setAggregationResults(chart.rows || []);
    setChartType(chart.chart_type as ChartType);
    setXKey(chart.x_key);
    setYKey(chart.y_key);
    setChartTitle(chart.title);
    setChartSystemKey(chart.system_key || "");
    setDashboardName(chart.dashboard_name || "EES Operations Overview");
    setWorkspaceMode("chart");
    setSaveChartMessage(null);
  }

  async function removeSavedChart(id: string) {
    if (!adminUser) return;
    setSaveChartRunning(true);
    try {
      await deleteDocumentVisualization(id);
      setSavedCharts((current) => current.filter((item) => item._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete saved visualization.");
    } finally {
      setSaveChartRunning(false);
    }
  }

  async function handleClear() {
    setFilterText(DEFAULT_FILTER);
    setSelectedDocument(null);
    resetEditor();
    setError(null);
    if (selected) await loadCollection(selected);
  }

  function handleSelectDocument(document: DocumentRow) {
    setSelectedDocument(document);
    resetEditor();
  }

  function beginCreate() {
    if (!adminUser || !selected) return;
    setSelectedDocument(null);
    setEditorMode("create");
    setEditorText("{\n  \n}");
    setMutationError(null);
    setDeleteConfirm(false);
  }

  function beginEdit() {
    if (!adminUser || !selectedDocument) return;
    setEditorMode("edit");
    setEditorText(JSON.stringify(editableDocument(selectedDocument), null, 2));
    setMutationError(null);
    setDeleteConfirm(false);
  }

  async function saveDocument() {
    if (!adminUser || !selected || editorMode === "view") return;
    setMutationError(null);
    setMutationRunning(true);
    try {
      const payload = parseEditorDocument(editorText);
      if ("_id" in payload) throw new Error("Remove _id before saving. MongoDB manages this field.");
      const result = editorMode === "create"
        ? await createAdminDocument(selected, payload)
        : await updateAdminDocument(selected, documentId(selectedDocument) ?? "", payload);
      await refreshAfterMutation(result.document ?? null);
      resetEditor();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to save document.");
    } finally {
      setMutationRunning(false);
    }
  }

  async function confirmDelete() {
    if (!adminUser || !selected || !selectedDocument) return;
    const id = documentId(selectedDocument);
    if (!id) {
      setMutationError("Selected document does not have a valid _id.");
      return;
    }
    setMutationError(null);
    setMutationRunning(true);
    try {
      await deleteAdminDocument(selected, id);
      await refreshAfterMutation(null);
      resetEditor();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Unable to delete document.");
    } finally {
      setMutationRunning(false);
    }
  }

  useEffect(() => {
    void refreshCollections();
    void refreshSavedCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!adminUser && editorMode !== "view") resetEditor();
  }, [adminUser, editorMode]);

  useEffect(() => {
    if (!navigationRequest || navigationRequest.mode !== "dashboard") return;

    const targetSystem = systems.find((system) =>
      system.system_id === navigationRequest.systemKey ||
      registrySystemKey(system) === navigationRequest.systemKey
    );

    setWorkspaceMode("dashboard");
    setSelectedDashboardSystem(
      targetSystem
        ? registrySystemKey(targetSystem)
        : navigationRequest.systemKey,
    );
  }, [navigationRequest?.requestId, systems]);

  const selectedCount = useMemo(
    () => collections.find((item) => item.name === selected)?.document_count ?? documents.length,
    [collections, selected, documents.length],
  );
  const aggregationKeys = useMemo(() => availableKeys(aggregationResults), [aggregationResults]);
  const dashboardNames = useMemo(() => {
    const names = Array.from(new Set(savedCharts.map((item) => item.dashboard_name).filter(Boolean)));
    return names.length > 0 ? names : ["EES Operations Overview"];
  }, [savedCharts]);
  const dashboardCharts = useMemo(
    () => savedCharts.filter((item) => item.dashboard_name === selectedDashboard),
    [savedCharts, selectedDashboard],
  );

  const selectedDashboardSystemName = useMemo(() => {
    if (selectedDashboardSystem === "ALL") return "All systems";

    return (
      findSystemByLensValue(selectedDashboardSystem)?.system_name ||
      selectedDashboardSystem
    );
  }, [selectedDashboardSystem, systems]);
  const visibleDashboardCharts = useMemo(
    () => selectedDashboardSystem === "ALL"
      ? dashboardCharts
      : dashboardCharts.filter((item) => (item.system_key || "Unassigned") === selectedDashboardSystem),
    [dashboardCharts, selectedDashboardSystem],
  );
  const dashboardCollections = useMemo(
    () => new Set(visibleDashboardCharts.map((item) => item.collection)).size,
    [visibleDashboardCharts],
  );
  const dashboardSystems = useMemo(
    () => new Set(visibleDashboardCharts.map((item) => item.system_key || "Unassigned")).size,
    [visibleDashboardCharts],
  );
  const dashboardDataPoints = useMemo(
    () => visibleDashboardCharts.reduce((sum, item) => sum + (item.rows?.length || 0), 0),
    [visibleDashboardCharts],
  );

  useEffect(() => {
    if (
      selectedDashboardSystem !== "ALL" &&
      systems.length > 0 &&
      !findSystemByLensValue(selectedDashboardSystem)
    ) {
      setSelectedDashboardSystem("ALL");
    }
  }, [systems, selectedDashboardSystem]);

  return (
    <div className="documents-workspace">
      <header className="documents-header">
        <div>
          <span className="documents-kicker">DOCUMENT ENGINE</span>
          <h2>MongoDB / {database}</h2>
          <p>Browse, aggregate, chart, and administer EES telemetry, events, diagnostics, snapshots, AI interactions, and logs.</p>
        </div>
        <div className="documents-mode">
          <span className="documents-status-dot" />
          {adminUser ? `ADMIN · ${adminUser}` : "READ-ONLY"}
        </div>
      </header>

      <div className="documents-grid">
        <aside className="documents-collections">
          <div className="documents-section-title">
            <span>COLLECTIONS</span>
            <button type="button" className="documents-icon-button" title="Refresh collections" aria-label="Refresh collections" disabled={loading || running || mutationRunning || aggregationRunning} onClick={() => void refreshCollections()}>↻</button>
          </div>
          {loading && collections.length === 0 ? (
            <div className="documents-muted">Loading collections…</div>
          ) : collections.length === 0 ? (
            <div className="documents-muted">No MongoDB collections found.</div>
          ) : (
            collections.map((item) => (
              <button key={item.name} type="button" className={`documents-collection ${selected === item.name ? "active" : ""}`} onClick={() => void openCollection(item.name)}>
                <span aria-hidden="true">◫</span><strong>{item.name}</strong><small>{item.document_count}</small>
              </button>
            ))
          )}
        </aside>

        <section className="documents-main">
          <div className="documents-workspace-tabs">
            <button type="button" className={workspaceMode === "browse" ? "active" : ""} onClick={() => setWorkspaceMode("browse")}>Browse</button>
            <button type="button" className={workspaceMode === "aggregate" ? "active" : ""} onClick={() => setWorkspaceMode("aggregate")}>Aggregate</button>
            <button type="button" className={workspaceMode === "chart" ? "active" : ""} onClick={() => setWorkspaceMode("chart")} disabled={aggregationResults.length === 0}>Chart</button>
            <button type="button" className={workspaceMode === "saved" ? "active" : ""} onClick={() => setWorkspaceMode("saved")}>Saved Charts</button>
            <button type="button" className={workspaceMode === "dashboard" ? "active" : ""} onClick={() => setWorkspaceMode("dashboard")}>Dashboard</button>
          </div>

          {workspaceMode === "browse" ? (
            <>
              <div className="documents-querybar">
                <div><strong>{selected ?? "Select a collection"}</strong><span>{selected ? `${selectedCount} documents registered` : ""}</span></div>
                {adminUser && selected && <button type="button" className="documents-admin-action" disabled={running || mutationRunning} onClick={beginCreate}>＋ New Document</button>}
                <button type="button" disabled={!selected || running || mutationRunning} onClick={() => void handleClear()}>Clear</button>
                <button type="button" className="documents-run" disabled={!selected || running || mutationRunning} onClick={() => void handleRunFilter()}>{running ? "Running…" : "▶ Run Filter"}</button>
              </div>
              <textarea className="documents-filter" value={filterText} onChange={(event) => setFilterText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void handleRunFilter(); } }} spellCheck={false} aria-label="MongoDB JSON filter" />
              {error && <div className="documents-error">{error}</div>}
              <div className="documents-results-heading"><strong>Documents</strong><span>{running ? "Loading…" : `${documents.length} returned`}</span></div>
              <div className="documents-results">
                {running && documents.length === 0 ? <div className="documents-empty">Loading documents…</div> : documents.length === 0 ? <div className="documents-empty">No documents returned.</div> : documents.map((document, index) => (
                  <button type="button" className={`document-row ${selectedDocument === document ? "active" : ""}`} key={getDocumentKey(document, index)} onClick={() => handleSelectDocument(document)}>
                    <span className="document-index">{index + 1}</span><pre>{JSON.stringify(document, null, 2)}</pre>
                  </button>
                ))}
              </div>
            </>
          ) : workspaceMode === "aggregate" ? (
            <>
              <div className="documents-querybar documents-aggregate-toolbar">
                <div><strong>{selected ?? "Select a collection"}</strong><span>Read-only MongoDB aggregation pipeline</span></div>
                <button type="button" disabled={!selected || aggregationRunning} onClick={() => { setPipelineText(DEFAULT_PIPELINE); setAggregationResults([]); setAggregationDuration(null); }}>Clear</button>
                <button type="button" className="documents-run" disabled={!selected || aggregationRunning} onClick={() => void handleRunAggregation()}>{aggregationRunning ? "Running…" : "▶ Run Pipeline"}</button>
              </div>
              <textarea className="documents-filter documents-pipeline-editor" value={pipelineText} onChange={(event) => setPipelineText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void handleRunAggregation(); } }} spellCheck={false} aria-label="MongoDB aggregation pipeline" />
              {error && <div className="documents-error">{error}</div>}
              <div className="documents-results-heading"><strong>Aggregation Results</strong><span>{aggregationRunning ? "Running…" : `${aggregationResults.length} returned${aggregationDuration !== null ? ` · ${aggregationDuration} ms` : ""}`}</span></div>
              <div className="documents-results">
                {aggregationResults.length === 0 ? <div className="documents-empty">Run an aggregation pipeline to produce analytical results.</div> : aggregationResults.map((row, index) => (
                  <div className="document-row aggregation-row" key={`aggregation-${index}`}><span className="document-index">{index + 1}</span><pre>{JSON.stringify(row, null, 2)}</pre></div>
                ))}
              </div>
            </>
          ) : workspaceMode === "chart" ? (
            <div className="documents-chart-workspace">
              <div className="documents-chart-toolbar">
                <label>Chart<select value={chartType} onChange={(event) => setChartType(event.target.value as ChartType)}><option value="bar">Bar</option><option value="line">Line</option><option value="scatter">Scatter</option><option value="pie">Pie</option></select></label>
                <label>X field<select value={xKey} onChange={(event) => setXKey(event.target.value)}><option value="">Select field</option>{aggregationKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
                <label>Y field<select value={yKey} onChange={(event) => setYKey(event.target.value)}><option value="">Select numeric field</option>{aggregationKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
                <span>{aggregationResults.length} aggregated rows</span>
              </div>
              {adminUser && (
                <div className="documents-chart-savebar">
                  <label>Chart title<input value={chartTitle} onChange={(event) => setChartTitle(event.target.value)} placeholder={`${selected ?? "MongoDB"} chart`} /></label>
                  <label>EES system key<input value={chartSystemKey} onChange={(event) => setChartSystemKey(event.target.value)} placeholder="ees_power_grid_sun" /></label>
                  <label>Dashboard<input value={dashboardName} onChange={(event) => setDashboardName(event.target.value)} placeholder="EES Operations Overview" /></label>
                  <button type="button" disabled={saveChartRunning || !xKey || !yKey || aggregationResults.length === 0} onClick={() => void handleSaveChart()}>{saveChartRunning ? "Saving…" : "Save Chart"}</button>
                  {saveChartMessage && <span>{saveChartMessage}</span>}
                </div>
              )}
              <div className="documents-chart-card">
                <div className="documents-chart-title"><strong>{chartTitle.trim() || selected || "MongoDB"}</strong><span>{xKey && yKey ? `${yKey} by ${xKey}` : "Choose chart fields"}</span></div>
                <ChartPreview rows={aggregationResults} chartType={chartType} xKey={xKey} yKey={yKey} />
              </div>
              <div className="documents-chart-source"><strong>Aggregation Source</strong><pre>{pipelineText}</pre></div>
            </div>
          ) : workspaceMode === "saved" ? (
            <div className="documents-saved-workspace">
              <div className="documents-saved-header"><div><strong>Saved Charts</strong><span>{savedCharts.length} visualization{savedCharts.length === 1 ? "" : "s"}</span></div><button type="button" onClick={() => void refreshSavedCharts()} disabled={savedChartsLoading}>↻ Refresh</button></div>
              {savedChartsLoading && savedCharts.length === 0 ? <div className="documents-empty">Loading saved charts…</div> : savedCharts.length === 0 ? <div className="documents-empty">No charts have been saved yet. Build a chart from an aggregation and save it to a dashboard.</div> : (
                <div className="documents-saved-list">{savedCharts.map((chart) => <article className="documents-saved-card" key={chart._id}><div><strong>{chart.title}</strong><span>{chart.dashboard_name}</span></div><dl><dt>Collection</dt><dd>{chart.collection}</dd><dt>System</dt><dd>{chart.system_key ? (findSystemByLensValue(chart.system_key)?.system_name || chart.system_key) : "Unassigned"}</dd><dt>Chart</dt><dd>{chart.chart_type}</dd><dt>Fields</dt><dd>{chart.y_key} by {chart.x_key}</dd></dl><div className="documents-saved-actions"><button type="button" onClick={() => openSavedChart(chart)}>Open</button>{adminUser && <button type="button" className="danger" disabled={saveChartRunning} onClick={() => void removeSavedChart(chart._id)}>Delete</button>}</div></article>)}</div>
              )}
            </div>
          ) : (
            <div className="documents-dashboard-workspace">
              <div className="documents-dashboard-header">
                <div><strong>{selectedDashboard}</strong><span>Operational analytics from saved MongoDB visualizations</span></div>
                <div className="documents-dashboard-selectors">
                  <label>Dashboard<select value={selectedDashboard} onChange={(event) => { setSelectedDashboard(event.target.value); setSelectedDashboardSystem("ALL"); }}>{dashboardNames.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
                  <label>System lens<select value={selectedDashboardSystem} onChange={(event) => setSelectedDashboardSystem(event.target.value)}><option value="ALL">All systems</option>{systems.map((system) => { const value = registrySystemKey(system); return <option value={value} key={system.system_id}>{system.system_name}</option>; })}</select></label>
                  <button type="button" onClick={() => void refreshSavedCharts()} disabled={savedChartsLoading}>↻ Refresh</button>
                </div>
              </div>

              <div className="documents-dashboard-kpis">
                <div><span>Visible charts</span><strong>{visibleDashboardCharts.length}</strong></div>
                <div><span>EES systems</span><strong>{dashboardSystems}</strong></div>
                <div><span>Collections</span><strong>{dashboardCollections}</strong></div>
                <div><span>Snapshot rows</span><strong>{dashboardDataPoints}</strong></div>
              </div>

              {dashboardCharts.length === 0 ? (
                <div className="documents-empty">No saved charts are assigned to this dashboard.</div>
              ) : visibleDashboardCharts.length === 0 ? (
                <div className="documents-empty">No saved charts match the selected EES system lens.</div>
              ) : (
                <div className="documents-dashboard-grid">
                  {visibleDashboardCharts.map((chart) => (
                    <article className="documents-dashboard-card" key={chart._id}>
                      <div className="documents-chart-title">
                        <div><strong>{chart.title}</strong><small>{chart.collection}</small></div>
                        <span className="documents-system-badge">{chart.system_key ? (findSystemByLensValue(chart.system_key)?.system_name || chart.system_key) : "Unassigned"}</span>
                      </div>
                      <ChartPreview rows={chart.rows || []} chartType={chart.chart_type as ChartType} xKey={chart.x_key} yKey={chart.y_key} />
                      <div className="documents-dashboard-meta">
                        <div><span>{chart.chart_type}</span><span>{chart.y_key} by {chart.x_key}</span><span>{chart.rows?.length || 0} snapshot rows</span></div>
                        <button type="button" onClick={() => openSavedChart(chart)}>Open source</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="document-details">
          <div className="documents-section-title documents-details-title">
            <span>DOCUMENT DETAILS</span>
            {adminUser && editorMode === "view" && selectedDocument && workspaceMode === "browse" && (
              <div className="documents-details-actions"><button type="button" onClick={beginEdit}>Edit</button><button type="button" className="danger" onClick={() => setDeleteConfirm(true)}>Delete</button></div>
            )}
          </div>
          {mutationError && <div className="documents-error">{mutationError}</div>}
          {workspaceMode !== "browse" ? (
            <div className="documents-analytics-details">
              <strong>{workspaceMode === "aggregate" ? "Aggregation Workspace" : workspaceMode === "chart" ? "Chart Builder" : workspaceMode === "saved" ? "Saved Visualizations" : "Dashboard Workspace"}</strong>
              <p>{workspaceMode === "aggregate" ? "Pipelines execute through the governed read-only MongoDB aggregation endpoint. $out, $merge, and server-side JavaScript operators are blocked." : workspaceMode === "chart" ? "Charts are generated from the most recent aggregation result. Authenticated admins can persist chart snapshots to EES dashboards." : workspaceMode === "saved" ? "Saved charts retain their source collection, aggregation pipeline, chart fields, EES system association, and result snapshot." : "Dashboards assemble saved MongoDB visualizations into an operational view without changing source documents."}</p>
              {workspaceMode === "aggregate" && aggregationResults.length > 0 && <><span>Result rows</span><strong>{aggregationResults.length}</strong><span>Duration</span><strong>{aggregationDuration ?? 0} ms</strong></>}
              {workspaceMode === "saved" && <><span>Saved charts</span><strong>{savedCharts.length}</strong><span>Dashboards</span><strong>{dashboardNames.length}</strong></>}
              {workspaceMode === "dashboard" && <><span>Dashboard</span><strong>{selectedDashboard}</strong><span>Visible charts</span><strong>{visibleDashboardCharts.length}</strong><span>System lens</span><strong>{selectedDashboardSystemName}</strong></>}
            </div>
          ) : editorMode !== "view" ? (
            <div className="documents-editor-wrap">
              <div className="documents-editor-label">{editorMode === "create" ? "NEW DOCUMENT" : "EDIT DOCUMENT"}</div>
              <textarea className="documents-json-editor" value={editorText} onChange={(event) => setEditorText(event.target.value)} spellCheck={false} aria-label="MongoDB document JSON editor" />
              <div className="documents-editor-actions"><button type="button" disabled={mutationRunning} onClick={resetEditor}>Cancel</button><button type="button" className="primary" disabled={mutationRunning} onClick={() => void saveDocument()}>{mutationRunning ? "Saving…" : "Save Document"}</button></div>
            </div>
          ) : deleteConfirm && selectedDocument ? (
            <div className="documents-delete-confirm"><strong>Delete this document?</strong><p>This permanently removes document {documentId(selectedDocument)} from {selected}.</p><div><button type="button" disabled={mutationRunning} onClick={() => setDeleteConfirm(false)}>Cancel</button><button type="button" className="danger" disabled={mutationRunning} onClick={() => void confirmDelete()}>{mutationRunning ? "Deleting…" : "Delete Permanently"}</button></div></div>
          ) : selectedDocument ? (
            <pre>{JSON.stringify(selectedDocument, null, 2)}</pre>
          ) : (
            <div className="documents-empty">{adminUser ? "Select a document to inspect it, or create a new document." : "Select a document to inspect its complete JSON payload."}</div>
          )}
        </aside>
      </div>
    </div>
  );
}
