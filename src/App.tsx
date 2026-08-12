import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  format as formatSql,
} from "sql-formatter";

import "./App.css";

import ConnectionDialog from "./features/connections/ConnectionDialog";
import ConnectionExplorer from "./features/connections/ConnectionExplorer";
import ObjectDetails from "./features/connections/ObjectDetails";

import SqlEditor from "./features/editor/SqlEditor";

import HistoryPanel from "./features/history/HistoryPanel";

import SavedQueriesPanel from "./features/savedQueries/SavedQueriesPanel";
import SaveQueryDialog from "./features/savedQueries/SaveQueryDialog";

import SettingsPanel from "./features/settings/SettingsPanel";

import CsvImportDialog from "./features/imports/CsvImportDialog";

import AiAssistant from "./features/ai/AiAssistant";

import EesSystemsPanel from "./features/systems/EesSystemsPanel";
import DocumentsPanel from "./features/documents/DocumentsPanel";
import AdminLoginDialog from "./features/admin/AdminLoginDialog";
import { adminLogout, getAdminSession, runManagedAdminQuery } from "./services/adminApi";

import {
  loadObjectMetadata,
  loadManagedObjectMetadata,
  loadPostgresCatalog,
  loadManagedCatalog,
  runPostgresQuery,
  runManagedQuery,
  type DatabaseCatalogResponse,
  type ObjectMetadataResponse,
  type QueryRunResponse,
} from "./services/api";

import {
  loadSavedConnections,
  saveConnection,
  savedConnectionToForm,
  type SavedConnection,
} from "./services/connectionStore";

import {
  addQueryHistory,
  clearQueryHistory,
  loadQueryHistory,
  type QueryHistoryEntry,
} from "./services/queryHistoryStore";

import {
  deleteSavedQuery,
  loadSavedQueries,
  saveQuery,
  type SavedQuery,
} from "./services/savedQueryStore";

import {
  defaultSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  type AppSettings,
} from "./services/settingsStore";

import {
  loadEesDatasets,
  loadEesSystems,
  loadRegistryOverview,
  type EesDataset,
  type EesSystem,
  type RegistryOverview,
} from "./services/registryApi";

import type {
  DatabaseConnectionForm,
} from "./features/connections/types";


type ResultView = "results" | "messages" | "explain";

type ActiveView =
  | "query"
  | "history"
  | "savedQueries"
  | "systems"
  | "documents"
  | "settings";


const MANAGED_EES_CONNECTION: DatabaseConnectionForm = {
  type: "postgresql",
  method: "host",
  name: "EES Data Platform",
  host: "",
  port: "5432",
  database: "ees_data_platform",
  username: "",
  password: "",
  connectionUrl: "",
  sslMode: "require",
};


function App() {
  const isPublicWebBuild =
    window.location.hostname.endsWith("github.io");

  const isLocalDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Managed web mode also supports custom production domains.
  const managedEesMode =
    typeof window !== "undefined" &&
    !("__TAURI_INTERNALS__" in window);

  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<string | null>(null);

  useEffect(() => {
    if (!managedEesMode) return;
    void getAdminSession().then((session) => {
      setAdminUser(session.authenticated ? (session.username ?? "admin") : null);
    }).catch(() => setAdminUser(null));
  }, [managedEesMode]);

  async function handleAdminLogout() {
    await adminLogout();
    setAdminUser(null);
    setQueryMessage("Admin session ended. Managed access is read-only.");
  }

  /*
   * ------------------------------------------------------------
   * CONNECTIONS
   * ------------------------------------------------------------
   */

  const [
    connectionDialogOpen,
    setConnectionDialogOpen,
  ] = useState(false);

  const [
    activeConnection,
    setActiveConnection,
  ] =
    useState<DatabaseConnectionForm | null>(
      null,
    );

  const [
    catalog,
    setCatalog,
  ] =
    useState<DatabaseCatalogResponse | null>(
      null,
    );

  const [
    connecting,
    setConnecting,
  ] = useState(false);

  const [
    connectionError,
    setConnectionError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    savedConnections,
    setSavedConnections,
  ] =
    useState<SavedConnection[]>(
      [],
    );

  const [
    connectionDraft,
    setConnectionDraft,
  ] =
    useState<DatabaseConnectionForm | null>(
      null,
    );


  /*
   * ------------------------------------------------------------
   * QUERY
   * ------------------------------------------------------------
   */

  type QueryTab = {
    id: number;
    name: string;
    sql: string;
  };

  const initialQuerySql = `SELECT *
FROM your_table;`;

  const [
    queryTabs,
    setQueryTabs,
  ] = useState<QueryTab[]>([
    {
      id: 1,
      name: "query-1.sql",
      sql: initialQuerySql,
    },
  ]);

  const [
    activeQueryTabId,
    setActiveQueryTabId,
  ] = useState(1);

  const nextQueryTabIdRef = useRef(2);

  const activeQueryTab =
    queryTabs.find(
      (tab) => tab.id === activeQueryTabId,
    ) ?? queryTabs[0];

  const sql = activeQueryTab?.sql ?? "";

  function setSql(value: string) {
    setQueryTabs((current) =>
      current.map((tab) =>
        tab.id === activeQueryTabId
          ? { ...tab, sql: value }
          : tab,
      ),
    );
  }

  function handleAddQueryTab() {
    const id = nextQueryTabIdRef.current++;

    setQueryTabs((current) => [
      ...current,
      {
        id,
        name: `query-${id}.sql`,
        sql: "",
      },
    ]);

    setActiveQueryTabId(id);
    setQueryResult(null);
    setQueryMessage(null);
    closeObjectDetails();
    setActiveView("query");
  }

  function handleSelectQueryTab(id: number) {
    setActiveQueryTabId(id);
    setQueryResult(null);
    setQueryMessage(null);
    closeObjectDetails();
    setActiveView("query");
  }

  function handleCloseQueryTab(id: number) {
    if (queryTabs.length === 1) {
      setSql("");
      setQueryResult(null);
      setQueryMessage(null);
      closeObjectDetails();
      return;
    }

    const closingIndex = queryTabs.findIndex(
      (tab) => tab.id === id,
    );

    const remaining = queryTabs.filter(
      (tab) => tab.id !== id,
    );

    setQueryTabs(remaining);

    if (id === activeQueryTabId) {
      const fallbackIndex = Math.max(
        0,
        Math.min(closingIndex - 1, remaining.length - 1),
      );

      setActiveQueryTabId(remaining[fallbackIndex].id);
      setQueryResult(null);
      setQueryMessage(null);
      closeObjectDetails();
    }
  }

  const [
    queryResult,
    setQueryResult,
  ] =
    useState<QueryRunResponse | null>(
      null,
    );

  const [
    resultView,
    setResultView,
  ] = useState<ResultView>("results");

  const [
    queryRunning,
    setQueryRunning,
  ] = useState(false);

  const [
    queryMessage,
    setQueryMessage,
  ] =
    useState<string | null>(
      null,
    );


  /*
   * ------------------------------------------------------------
   * OBJECT METADATA
   * ------------------------------------------------------------
   */

  const [
    selectedObject,
    setSelectedObject,
  ] = useState<{
    schemaName: string;
    objectName: string;
  } | null>(null);

  const [
    objectMetadata,
    setObjectMetadata,
  ] =
    useState<ObjectMetadataResponse | null>(
      null,
    );

  const [
    metadataLoading,
    setMetadataLoading,
  ] = useState(false);

  const [
    metadataError,
    setMetadataError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    metadataCache,
    setMetadataCache,
  ] = useState<
    Record<
      string,
      ObjectMetadataResponse
    >
  >({});

  const metadataCacheRef =
    useRef<
      Record<
        string,
        ObjectMetadataResponse
      >
    >({});

  const metadataRequestsRef =
    useRef<
      Map<
        string,
        Promise<
          ObjectMetadataResponse | null
        >
      >
    >(
      new Map(),
    );


  /*
   * ------------------------------------------------------------
   * NAVIGATION
   * ------------------------------------------------------------
   */

  const [
    activeView,
    setActiveView,
  ] =
    useState<ActiveView>(
      window.location.hostname.endsWith("github.io")
        ? "systems"
        : "query",
    );

  const [
    documentsNavigation,
    setDocumentsNavigation,
  ] = useState<{
    mode: "dashboard";
    systemKey: string;
    requestId: number;
  } | null>(null);


  /*
   * ------------------------------------------------------------
   * HISTORY
   * ------------------------------------------------------------
   */

  const [
    queryHistory,
    setQueryHistory,
  ] =
    useState<QueryHistoryEntry[]>(
      [],
    );


  /*
   * ------------------------------------------------------------
   * SAVED QUERIES
   * ------------------------------------------------------------
   */

  const [
    savedQueries,
    setSavedQueries,
  ] =
    useState<SavedQuery[]>(
      [],
    );

  const [
    saveQueryDialogOpen,
    setSaveQueryDialogOpen,
  ] = useState(false);


  /*
   * ------------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------------
   */

  const [
    settings,
    setSettings,
  ] =
    useState<AppSettings>(
      defaultSettings,
    );


  /*
   * ------------------------------------------------------------
   * CSV IMPORT
   * ------------------------------------------------------------
   */

  const [
    csvImportDialogOpen,
    setCsvImportDialogOpen,
  ] = useState(false);


  /*
   * ------------------------------------------------------------
   * AI
   * ------------------------------------------------------------
   */

  const [
    aiAssistantOpen,
    setAiAssistantOpen,
  ] = useState(false);


  /*
   * ------------------------------------------------------------
   * EES REGISTRY
   * ------------------------------------------------------------
   */

  const [
    eesSystems,
    setEesSystems,
  ] =
    useState<EesSystem[]>(
      [],
    );

  const [
    eesDatasets,
    setEesDatasets,
  ] =
    useState<EesDataset[]>(
      [],
    );

  const [
    registryOverview,
    setRegistryOverview,
  ] =
    useState<RegistryOverview | null>(
      null,
    );

  const [
    registryLoading,
    setRegistryLoading,
  ] = useState(false);

  const [
    registryError,
    setRegistryError,
  ] =
    useState<string | null>(
      null,
    );


  /*
   * ------------------------------------------------------------
   * STARTUP
   * ------------------------------------------------------------
   */

  useEffect(() => {
    async function loadConnections() {
      try {
        const stored =
          await loadSavedConnections();

        setSavedConnections(
          stored,
        );
      } catch (error) {
        console.error(
          "Unable to load saved connections:",
          error,
        );
      }
    }

    void loadConnections();
  }, []);


  useEffect(() => {
    async function loadHistory() {
      try {
        const stored =
          await loadQueryHistory();

        setQueryHistory(
          stored,
        );
      } catch (error) {
        console.error(
          "Unable to load query history:",
          error,
        );
      }
    }

    void loadHistory();
  }, []);


  useEffect(() => {
    async function loadQueries() {
      try {
        const stored =
          await loadSavedQueries();

        setSavedQueries(
          stored,
        );
      } catch (error) {
        console.error(
          "Unable to load saved queries:",
          error,
        );
      }
    }

    void loadQueries();
  }, []);


  useEffect(() => {
    async function loadAppSettings() {
      try {
        const stored =
          await loadSettings();

        setSettings(
          stored,
        );
      } catch (error) {
        console.error(
          "Unable to load settings:",
          error,
        );
      }
    }

    void loadAppSettings();
  }, []);


  useEffect(() => {
    metadataCacheRef.current =
      metadataCache;
  }, [
    metadataCache,
  ]);


  /*
   * Load the EES registry once at startup.
   */

  useEffect(() => {
    void refreshRegistry();
  }, []);


  /*
   * Automatically open the server-managed EES Data Platform
   * whenever the public build or local development build is
   * using managed EES mode. PostgreSQL credentials remain on
   * the Data Moon API server and are never sent to the browser.
   */

  useEffect(() => {
    if (!managedEesMode) {
      return;
    }

    let cancelled = false;

    async function connectManagedDatabase() {
      setConnecting(true);
      setConnectionError(null);

      try {
        const managedCatalog =
          await loadManagedCatalog();

        if (cancelled) {
          return;
        }

        setActiveConnection(
          MANAGED_EES_CONNECTION,
        );

        setCatalog(
          managedCatalog,
        );

        setMetadataCache(
          {},
        );

        metadataCacheRef.current =
          {};

        metadataRequestsRef.current.clear();

        setConnectionError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Managed EES database connection failed:",
          error,
        );

        setActiveConnection(null);
        setCatalog(null);

        setConnectionError(
          error instanceof Error
            ? error.message
            : "Unable to open EES Data Platform.",
        );
      } finally {
        if (!cancelled) {
          setConnecting(false);
        }
      }
    }

    void connectManagedDatabase();

    return () => {
      cancelled = true;
    };
  }, [managedEesMode]);


  /*
   * ------------------------------------------------------------
   * REGISTRY
   * ------------------------------------------------------------
   */

  async function refreshRegistry() {
    try {
      setRegistryLoading(
        true,
      );

      setRegistryError(
        null,
      );

      const [
        overview,
        systems,
        datasets,
      ] =
        await Promise.all([
          loadRegistryOverview(),
          loadEesSystems(),
          loadEesDatasets(),
        ]);

      setRegistryOverview(
        overview,
      );

      setEesSystems(
        systems,
      );

      setEesDatasets(
        datasets,
      );
    } catch (error) {
      setRegistryError(
        error instanceof Error
          ? error.message
          : "Unable to load EES registry.",
      );
    } finally {
      setRegistryLoading(
        false,
      );
    }
  }


  function handleOpenSystemDatabase(
    system: EesSystem,
  ) {
    if (
      !system.primary_database
    ) {
      return;
    }

    /*
     * If we already have a saved connection
     * for this database, open that connection
     * form so credentials/host settings remain
     * user-controlled.
     */

    const saved =
      savedConnections.find(
        (connection) =>
          connection.method ===
          "host" &&
          connection.database ===
          system.primary_database,
      );

    if (saved) {
      setConnectionDraft(
        savedConnectionToForm(
          saved,
        ),
      );

      setConnectionDialogOpen(
        true,
      );

      return;
    }

    /*
     * We intentionally do NOT invent credentials
     * or host information from the registry.
     *
     * The registry describes the system;
     * connection credentials remain separate.
     */

    setConnectionDraft(
      null,
    );

    setConnectionDialogOpen(
      true,
    );

    setConnectionError(
      `Create or select a connection for ${system.system_name} (${system.primary_database}).`,
    );
  }


  /*
   * ------------------------------------------------------------
   * EES SYSTEM -> DOCUMENT DASHBOARD
   * ------------------------------------------------------------
   */

  function handleOpenSystemDashboard(
    system: EesSystem,
  ) {
    setDocumentsNavigation({
      mode: "dashboard",
      systemKey: system.system_id,
      requestId: Date.now(),
    });

    setActiveView(
      "documents",
    );
  }


  /*
   * ------------------------------------------------------------
   * CONNECTION HANDLERS
   * ------------------------------------------------------------
   */

  async function handleConnect(
    connection:
      DatabaseConnectionForm,
  ) {
    try {
      setConnecting(
        true,
      );

      setConnectionError(
        null,
      );

      const catalogResult =
        await loadPostgresCatalog(
          connection,
        );

      if (
        !catalogResult.success
      ) {
        setConnectionError(
          catalogResult.message ??
          "Unable to load database catalog.",
        );

        return;
      }

      setActiveConnection(
        connection,
      );

      setCatalog(
        catalogResult,
      );

      setMetadataCache(
        {},
      );

      metadataCacheRef.current =
        {};

      metadataRequestsRef.current.clear();

      const saved =
        await saveConnection(
          connection,
        );

      setSavedConnections(
        (current) => {
          const exists =
            current.some(
              (item) =>
                item.id ===
                saved.id,
            );

          return exists
            ? current.map(
              (item) =>
                item.id ===
                  saved.id
                  ? saved
                  : item,
            )
            : [
              ...current,
              saved,
            ];
        },
      );

      setConnectionDraft(
        null,
      );

      setConnectionDialogOpen(
        false,
      );

      setSelectedObject(
        null,
      );

      setObjectMetadata(
        null,
      );

      setMetadataError(
        null,
      );

      setActiveView(
        "query",
      );
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Unable to connect to PostgreSQL.",
      );
    } finally {
      setConnecting(
        false,
      );
    }
  }


  function openNewConnection() {
    setConnectionDraft(
      null,
    );

    setConnectionDialogOpen(
      true,
    );
  }


  function openSavedConnection(
    connection:
      SavedConnection,
  ) {
    setConnectionDraft(
      savedConnectionToForm(
        connection,
      ),
    );

    setConnectionDialogOpen(
      true,
    );
  }

  async function openManagedEesPlatform() {
    setConnecting(true);
    setConnectionError(null);

    try {
      const managedCatalog =
        await loadManagedCatalog();

      setActiveConnection(
        MANAGED_EES_CONNECTION,
      );

      setCatalog(
        managedCatalog,
      );

      setConnectionError(null);
    } catch (error) {
      console.error(
        "Unable to open managed EES Data Platform:",
        error,
      );

      setActiveConnection(null);
      setCatalog(null);

      setConnectionError(
        error instanceof Error
          ? error.message
          : "Unable to connect to EES Data Platform.",
      );
    } finally {
      setConnecting(false);
    }
  }


  /*
   * ------------------------------------------------------------
   * METADATA CACHE
   * ------------------------------------------------------------
   */

  const handleRequestObjectMetadata =
    useCallback(
      async (
        schemaName: string,
        objectName: string,
      ): Promise<
        ObjectMetadataResponse | null
      > => {
        if (
          !activeConnection
        ) {
          return null;
        }

        const cacheKey =
          buildMetadataKey(
            schemaName,
            objectName,
          );

        const cached =
          metadataCacheRef.current[
          cacheKey
          ];

        if (
          cached?.success
        ) {
          return cached;
        }

        const existingRequest =
          metadataRequestsRef.current.get(
            cacheKey,
          );

        if (
          existingRequest
        ) {
          return existingRequest;
        }

        const request =
          (async () => {
            try {
              const isManagedConnection =
                activeConnection.name ===
                MANAGED_EES_CONNECTION.name;

              const result =
                isManagedConnection
                  ? await loadManagedObjectMetadata(
                    schemaName,
                    objectName,
                  )
                  : await loadObjectMetadata(
                    activeConnection,
                    schemaName,
                    objectName,
                  );

              if (
                !result.success
              ) {
                return null;
              }

              metadataCacheRef.current =
              {
                ...metadataCacheRef.current,

                [cacheKey]:
                  result,
              };

              setMetadataCache(
                (current) => ({
                  ...current,

                  [cacheKey]:
                    result,
                }),
              );

              return result;
            } catch (error) {
              console.error(
                `Unable to load metadata for ${cacheKey}:`,
                error,
              );

              return null;
            } finally {
              metadataRequestsRef.current.delete(
                cacheKey,
              );
            }
          })();

        metadataRequestsRef.current.set(
          cacheKey,
          request,
        );

        return request;
      },
      [
        activeConnection,
      ],
    );


  async function handleSelectObject(
    schemaName: string,
    objectName: string,
  ) {
    if (
      !activeConnection
    ) {
      return;
    }

    setSelectedObject({
      schemaName,
      objectName,
    });

    setMetadataLoading(
      true,
    );

    setMetadataError(
      null,
    );

    setObjectMetadata(
      null,
    );

    try {
      const result =
        await handleRequestObjectMetadata(
          schemaName,
          objectName,
        );

      if (!result) {
        setMetadataError(
          "Unable to load object metadata.",
        );

        return;
      }

      setObjectMetadata(
        result,
      );
    } catch (error) {
      setMetadataError(
        error instanceof Error
          ? error.message
          : "Unable to load object metadata.",
      );
    } finally {
      setMetadataLoading(
        false,
      );
    }
  }


  function closeObjectDetails() {
    setSelectedObject(
      null,
    );

    setObjectMetadata(
      null,
    );

    setMetadataError(
      null,
    );
  }


  /*
   * ------------------------------------------------------------
   * QUERY EXECUTION
   * ------------------------------------------------------------
   */

  async function handleRunQuery() {
    if (
      !activeConnection
    ) {
      setQueryMessage(
        "Connect to a PostgreSQL database first.",
      );

      return;
    }

    if (
      !sql.trim()
    ) {
      setQueryMessage(
        "Enter a SQL query before running.",
      );

      return;
    }

    try {
      setQueryRunning(
        true,
      );

      setQueryMessage(
        null,
      );

      const isManagedConnection =
        activeConnection.name === MANAGED_EES_CONNECTION.name;

      const result =
        isManagedConnection
          ? adminUser
            ? await runManagedAdminQuery(
              sql,
              settings.resultRowLimit,
            )
            : await runManagedQuery(
              sql,
              settings.resultRowLimit,
            )
          : await runPostgresQuery(
            activeConnection,
            sql,
          );

      setQueryResult(
        result,
      );
      setResultView("results");

      const historyEntry =
        await addQueryHistory({
          connectionName:
            activeConnection.name,

          databaseName:
            catalog?.database ??
            activeConnection.database,

          sql,

          success:
            result.success,

          message:
            result.message ??
            null,

          rowCount:
            result.row_count,

          durationMs:
            result.duration_ms,
        });

      setQueryHistory(
        (current) =>
          [
            historyEntry,
            ...current,
          ].slice(
            0,
            settings.maxHistoryEntries,
          ),
      );

      if (
        !result.success
      ) {
        setQueryMessage(
          result.message ??
          "Query execution failed.",
        );
      } else {
        setQueryMessage(
          `Query completed in ${result.duration_ms} ms.`,
        );
      }
    } catch (error) {
      setQueryResult(
        null,
      );

      setQueryMessage(
        error instanceof Error
          ? error.message
          : "Unable to execute query.",
      );
    } finally {
      setQueryRunning(
        false,
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * FORMAT
   * ------------------------------------------------------------
   */

  function handleFormatSql() {
    if (
      !sql.trim()
    ) {
      setQueryMessage(
        "Enter SQL before formatting.",
      );

      return;
    }

    try {
      const formatted =
        formatSql(
          sql,
          {
            language:
              "postgresql",

            keywordCase:
              "upper",

            tabWidth: 2,

            useTabs:
              false,

            linesBetweenQueries:
              2,
          },
        );

      setSql(
        formatted,
      );

      setQueryMessage(
        "SQL formatted.",
      );

      setQueryResult(
        null,
      );
    } catch (error) {
      setQueryMessage(
        error instanceof Error
          ? `Unable to format SQL: ${error.message}`
          : "Unable to format SQL.",
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * OBJECT PREVIEW
   * ------------------------------------------------------------
   */

  function handlePreviewObject(
    schemaName: string,
    objectName: string,
  ) {
    const safeSchemaName =
      schemaName.replace(
        /"/g,
        '""',
      );

    const safeObjectName =
      objectName.replace(
        /"/g,
        '""',
      );

    const qualifiedName =
      `"${safeSchemaName}".` +
      `"${safeObjectName}"`;

    setSql(
      `SELECT *
FROM ${qualifiedName}
LIMIT ${settings.resultRowLimit};`,
    );

    setQueryResult(
      null,
    );

    setQueryMessage(
      null,
    );

    setActiveView(
      "query",
    );
  }


  /*
   * ------------------------------------------------------------
   * HISTORY
   * ------------------------------------------------------------
   */

  function handleHistorySelect(
    entry:
      QueryHistoryEntry,
  ) {
    setSql(
      entry.sql,
    );

    setQueryResult(
      null,
    );

    setQueryMessage(
      null,
    );

    setActiveView(
      "query",
    );
  }


  async function handleClearHistory() {
    try {
      await clearQueryHistory();

      setQueryHistory(
        [],
      );
    } catch (error) {
      console.error(
        "Unable to clear query history:",
        error,
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * SAVED QUERIES
   * ------------------------------------------------------------
   */

  function handleSaveQuery() {
    if (
      !sql.trim()
    ) {
      setQueryMessage(
        "Enter SQL before saving.",
      );

      return;
    }

    setSaveQueryDialogOpen(
      true,
    );
  }


  async function handleSaveQueryConfirmed(
    name: string,
  ) {
    try {
      const saved =
        await saveQuery(
          name,
          sql,

          activeConnection?.name ??
          null,

          catalog?.database ??
          activeConnection?.database ??
          null,
        );

      setSavedQueries(
        (current) => {
          const exists =
            current.some(
              (query) =>
                query.id ===
                saved.id,
            );

          return exists
            ? current.map(
              (query) =>
                query.id ===
                  saved.id
                  ? saved
                  : query,
            )
            : [
              saved,
              ...current,
            ];
        },
      );

      setSaveQueryDialogOpen(
        false,
      );

      setQueryMessage(
        `Saved query "${saved.name}".`,
      );
    } catch (error) {
      setQueryMessage(
        error instanceof Error
          ? error.message
          : "Unable to save query.",
      );
    }
  }


  function handleSavedQuerySelect(
    query:
      SavedQuery,
  ) {
    setSql(
      query.sql,
    );

    setQueryResult(
      null,
    );

    setQueryMessage(
      null,
    );

    setActiveView(
      "query",
    );
  }


  async function handleDeleteSavedQuery(
    query:
      SavedQuery,
  ) {
    const confirmed =
      window.confirm(
        `Delete saved query "${query.name}"?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteSavedQuery(
        query.id,
      );

      setSavedQueries(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              query.id,
          ),
      );
    } catch (error) {
      console.error(
        "Unable to delete saved query:",
        error,
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------------
   */

  async function handleSettingsChange(
    nextSettings:
      AppSettings,
  ) {
    setSettings(
      nextSettings,
    );

    try {
      await saveSettings(
        nextSettings,
      );
    } catch (error) {
      console.error(
        "Unable to save settings:",
        error,
      );
    }
  }


  async function handleResetSettings() {
    try {
      const defaults =
        await resetSettings();

      setSettings(
        defaults,
      );
    } catch (error) {
      console.error(
        "Unable to reset settings:",
        error,
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * CSV IMPORT
   * ------------------------------------------------------------
   */

  async function handleCsvImported(
    schemaName: string,
    tableName: string,
  ) {
    if (
      !activeConnection
    ) {
      return;
    }

    try {
      const refreshed =
        await loadPostgresCatalog(
          activeConnection,
        );

      if (
        !refreshed.success
      ) {
        setQueryMessage(
          refreshed.message ??
          "CSV imported, but the database catalog could not be refreshed.",
        );

        return;
      }

      setCatalog(
        refreshed,
      );

      const cacheKey =
        buildMetadataKey(
          schemaName,
          tableName,
        );

      const nextCache = {
        ...metadataCacheRef.current,
      };

      delete nextCache[
        cacheKey
      ];

      metadataCacheRef.current =
        nextCache;

      setMetadataCache(
        nextCache,
      );

      handlePreviewObject(
        schemaName,
        tableName,
      );

      setCsvImportDialogOpen(
        false,
      );

      setQueryMessage(
        `Imported ${schemaName}.${tableName}.`,
      );

      setActiveView(
        "query",
      );

      /*
       * Registry may have changed if this table
       * is later synchronized, so refresh the
       * platform view as well.
       */

      void refreshRegistry();
    } catch (error) {
      console.error(
        "Unable to refresh catalog after CSV import:",
        error,
      );

      setQueryMessage(
        error instanceof Error
          ? error.message
          : "CSV imported, but catalog refresh failed.",
      );
    }
  }


  /*
   * ------------------------------------------------------------
   * AI
   * ------------------------------------------------------------
   */

  function handleApplyAiSql(
    generatedSql: string,
  ) {
    if (
      !generatedSql.trim()
    ) {
      return;
    }

    setSql(
      generatedSql,
    );

    setQueryResult(
      null,
    );

    setQueryMessage(
      "AI-generated SQL applied to the editor. Review before running.",
    );

    setActiveView(
      "query",
    );
  }


  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (

    <div className="app-shell">
      <header className="titlebar">


        <div className="brand">
          <span className="moon-mark">
            ◐
          </span>

          <div>
            <strong>
              UNIVERSAL DATA MOON
            </strong>

            <span className="brand-subtitle">
              EES DATA SYSTEM
            </span>
          </div>
        </div>

        <span>{managedEesMode && (
          adminUser ? (
            <button
              type="button"
              className="titlebar-admin-button authenticated"
              onClick={handleAdminLogout}
              title="Sign out of Data Moon Admin Mode"
            >
              <span className="titlebar-admin-dot" />
              Admin: {adminUser}
              <span className="titlebar-admin-action">
                Sign Out
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="titlebar-admin-button"
              onClick={() => setAdminLoginOpen(true)}
              title="Sign in to Data Moon Admin Mode"
            >
              Admin Login
            </button>
          )
        )}</span>

        <div className="system-status">
          <span
            className={`status-dot ${managedEesMode
              ? registryOverview && !registryError
                ? "online"
                : registryLoading
                  ? "connecting"
                  : "offline"
              : activeConnection
                ? "online"
                : "offline"
              }`}
          />

          {managedEesMode
            ? registryLoading
              ? "DATA MOON API CONNECTING..."
              : registryOverview && !registryError
                ? "DATA MOON API ONLINE"
                : "DATA MOON API OFFLINE"
            : connecting
              ? "CONNECTING..."
              : activeConnection
                ? activeConnection.name
                : "NO CONNECTION"}
        </div>
      </header>


      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>
              {isPublicWebBuild
                ? "PUBLIC DATA ACCESS"
                : "CONNECTIONS"}
            </span>

            {!isPublicWebBuild && (
              <button
                type="button"
                className="icon-button"
                title="New Private Database Connection"
                onClick={
                  openNewConnection
                }
              >
                +
              </button>
            )}
          </div>


          {managedEesMode && (
            <button
              type="button"
              className="public-api-access-card"
              onClick={openManagedEesPlatform}
              disabled={connecting}
              title="Explore the managed EES Data Platform"
            >
              <span className="public-api-access-dot" />

              <div>
                <strong>EES Data Platform</strong>

                <span>
                  PostgreSQL · Managed Connection
                </span>

                <small>
                  {connecting
                    ? "Connecting…"
                    : activeConnection && catalog
                      ? "ees_data_platform · Read-only · Connected"
                      : registryOverview && !registryError
                        ? "API online · Open managed database"
                        : "API connection unavailable"}
                </small>
              </div>
            </button>
          )}

          {isLocalDev && (
            <button
              type="button"
              className="new-connection"
              onClick={openNewConnection}
            >
              <span>＋</span>
              Private Database Connection
            </button>
          )}



          {isLocalDev &&
            savedConnections.length > 0 && (
              <div className="saved-connections-list">
                <div className="saved-connections-title">
                  SAVED
                </div>

                {savedConnections.map(
                  (
                    connection,
                  ) => (
                    <button
                      key={
                        connection.id
                      }

                      type="button"

                      className="saved-connection-item"

                      onClick={() =>
                        openSavedConnection(
                          connection,
                        )
                      }
                    >
                      <span className="saved-connection-dot" />

                      <div className="saved-connection-info">
                        <strong>
                          {
                            connection.name
                          }
                        </strong>

                        <span>
                          {connection.method ===
                            "host"
                            ? `${connection.host}:${connection.port}`
                            : "PostgreSQL URL"}
                        </span>

                        {connection.method ===
                          "host" &&
                          connection.database && (
                            <span>
                              {
                                connection.database
                              }
                            </span>
                          )}
                      </div>
                    </button>
                  ),
                )}
              </div>
            )}

          {managedEesMode && !activeConnection ? (
            <div className="empty-connections public-api-summary">
              <div className="empty-orbit">
                ◉
              </div>

              <strong>

                {registryOverview && !registryError
                  ? "Data Moon API Online"
                  : registryLoading
                    ? "Connecting to Data Moon"
                    : "Data Moon API Offline"}
              </strong>


              <span>
                Railway PostgreSQL is exposed through the
                governed EES API. Direct database credentials
                are never sent to the public browser.
              </span>

              {registryOverview && (
                <div className="public-api-mini-metrics">
                  <span><b>{registryOverview.systems}</b> systems</span>
                  <span><b>{registryOverview.datasets}</b> datasets</span>
                </div>
              )}

              {registryError && (
                <span className="connection-error">
                  {registryError}
                </span>
              )}
            </div>
          ) : activeConnection &&
            catalog ? (
            <ConnectionExplorer
              connectionName={
                activeConnection.name
              }

              databaseName={
                catalog.database ??
                activeConnection.database
              }

              catalog={
                catalog
              }

              onPreviewObject={
                handlePreviewObject
              }

              onSelectObject={
                handleSelectObject
              }
            />
          ) : (
            <div className="empty-connections">
              <div className="empty-orbit">
                ◌
              </div>

              <strong>
                No databases connected
              </strong>

              <span>
                Connect a database to
                begin exploring your
                EES data.
              </span>

              {connectionError && (
                <span className="connection-error">
                  {
                    connectionError
                  }
                </span>
              )}
            </div>
          )}


          <nav className="sidebar-nav">
            <button
              type="button"

              className={`nav-item ${activeView ===
                "query"
                ? "active"
                : ""
                }`}

              onClick={() =>
                setActiveView(
                  "query",
                )
              }
            >
              <span>
                ⌘
              </span>

              Query
            </button>


            <button
              type="button"

              className={`nav-item ${activeView ===
                "history"
                ? "active"
                : ""
                }`}

              onClick={() =>
                setActiveView(
                  "history",
                )
              }
            >
              <span>
                ◷
              </span>

              History
            </button>


            <button
              type="button"

              className={`nav-item ${activeView ===
                "savedQueries"
                ? "active"
                : ""
                }`}

              onClick={() =>
                setActiveView(
                  "savedQueries",
                )
              }
            >
              <span>
                ☆
              </span>

              Saved Queries
            </button>


            <button
              type="button"

              className={`nav-item ${activeView ===
                "systems"
                ? "active"
                : ""
                }`}

              onClick={() => {
                setActiveView(
                  "systems",
                );

                void refreshRegistry();
              }}
            >
              <span>
                ◈
              </span>

              EES Systems
            </button>


            <button
              type="button"
              className={`nav-item ${activeView ===
                "documents"
                ? "active"
                : ""
                }`}
              onClick={() =>
                setActiveView(
                  "documents",
                )
              }
            >
              <span>
                ◫
              </span>

              Documents
            </button>


            <button
              type="button"

              className={`nav-item ${activeView ===
                "settings"
                ? "active"
                : ""
                }`}

              onClick={() =>
                setActiveView(
                  "settings",
                )
              }
            >
              <span>
                ⚙
              </span>

              Settings
            </button>
          </nav>
        </aside>


        <main className={`main-workspace${isPublicWebBuild ? " public-web-workspace" : ""}`}>
          {isPublicWebBuild && (
            <div className="public-web-banner">
              <strong>PUBLIC DATA MOON</strong>
              <span>Governed read-only EES catalog · live API when Railway is available</span>
            </div>
          )}
          {activeView ===
            "history" ? (
            <HistoryPanel
              entries={
                queryHistory
              }

              onSelect={
                handleHistorySelect
              }

              onClear={
                handleClearHistory
              }
            />
          ) : activeView ===
            "savedQueries" ? (
            <SavedQueriesPanel
              queries={
                savedQueries
              }

              onSelect={
                handleSavedQuerySelect
              }

              onDelete={
                handleDeleteSavedQuery
              }
            />
          ) : activeView ===
            "systems" ? (
            <EesSystemsPanel
              systems={
                eesSystems
              }

              datasets={
                eesDatasets
              }

              overview={
                registryOverview
              }

              loading={
                registryLoading
              }

              error={
                registryError
              }

              onRefresh={
                refreshRegistry
              }

              onOpenDatabase={
                handleOpenSystemDatabase
              }

              onOpenDashboard={
                handleOpenSystemDashboard
              }
            />
          ) : activeView ===
            "documents" ? (
            <DocumentsPanel
              adminUser={adminUser}
              navigationRequest={documentsNavigation}
              systems={eesSystems}
            />
          ) : activeView ===
            "settings" ? (
            <SettingsPanel
              settings={
                settings
              }

              onChange={
                handleSettingsChange
              }

              onReset={
                handleResetSettings
              }
            />
          ) : (
            <>
              <div className="query-tabs">
                {queryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={
                      tab.id === activeQueryTabId
                        ? "query-tab active"
                        : "query-tab"
                    }
                    onClick={() =>
                      handleSelectQueryTab(tab.id)
                    }
                  >
                    <span className="tab-status" />

                    {tab.name}

                    <span
                      className="tab-close"
                      aria-label={`Close ${tab.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCloseQueryTab(tab.id);
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  className="add-tab"
                  title="New query"
                  aria-label="New query"
                  onClick={handleAddQueryTab}
                >
                  +
                </button>
              </div>


              <div className="query-toolbar">
                <button
                  type="button"

                  className="run-button"

                  onClick={
                    handleRunQuery
                  }

                  disabled={
                    !activeConnection ||
                    queryRunning
                  }
                >
                  {queryRunning
                    ? "Running..."
                    : "▶ Run"}
                </button>


                <button
                  type="button"

                  disabled={
                    !queryRunning
                  }
                >
                  ■ Stop
                </button>


                <div className="toolbar-divider" />


                <button
                  type="button"

                  onClick={
                    handleFormatSql
                  }
                >
                  Format
                </button>


                <button
                  type="button"

                  onClick={
                    handleSaveQuery
                  }
                >
                  Save
                </button>


                <button
                  type="button"

                  disabled={
                    !activeConnection
                  }

                  onClick={() =>
                    setCsvImportDialogOpen(
                      true,
                    )
                  }
                >
                  Import Data
                </button>


                <button
                  type="button"

                  disabled={
                    !activeConnection
                  }

                  onClick={() =>
                    setAiAssistantOpen(
                      (current) =>
                        !current,
                    )
                  }
                >
                  AI Assistant
                </button>


                <div className="query-context">
                  PostgreSQL

                  {adminUser && activeConnection?.name === MANAGED_EES_CONNECTION.name && (
                    <strong title="Authenticated managed administration"> · ADMIN MODE</strong>
                  )}

                  <span>
                    •
                  </span>

                  {activeConnection
                    ? (
                      catalog?.database ??
                      activeConnection.database
                    )
                    : "No database selected"}
                </div>
              </div>


              <section className="editor-panel">
                <SqlEditor
                  value={
                    sql
                  }

                  onChange={
                    setSql
                  }

                  catalog={
                    catalog
                  }

                  objectMetadata={
                    objectMetadata
                  }

                  metadataCache={
                    metadataCache
                  }

                  onRequestObjectMetadata={
                    handleRequestObjectMetadata
                  }

                  autocompleteEnabled={
                    settings.autocompleteEnabled
                  }
                />
              </section>


              <section className="results-panel">
                <div className="result-tabs">
                  <button
                    type="button"
                    className={resultView === "results" ? "active" : ""}
                    onClick={() => setResultView("results")}
                  >
                    Results
                  </button>

                  <button
                    type="button"
                    className={resultView === "messages" ? "active" : ""}
                    onClick={() => setResultView("messages")}
                  >
                    Messages
                  </button>

                  <button
                    type="button"
                    className={resultView === "explain" ? "active" : ""}
                    onClick={() => setResultView("explain")}
                  >
                    Explain
                  </button>

                  <span className="result-summary">
                    {queryResult?.success
                      ? `${queryResult.row_count} rows • ${queryResult.duration_ms} ms`
                      : "0 rows"}
                  </span>
                </div>

                {resultView === "results" ? (
                  queryResult?.success && queryResult.columns.length > 0 ? (
                    <div className="results-table-wrap">
                      <table className="results-table">
                        <thead>
                          <tr>
                            {queryResult.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {row.map((value, columnIndex) => (
                                <td key={`${rowIndex}-${columnIndex}`}>
                                  {value === null ? "NULL" : String(value)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : queryMessage ? (
                    <div className={queryResult?.success === false ? "query-message error" : "query-message"}>
                      {queryMessage}
                    </div>
                  ) : (
                    <div className="results-empty">
                      <div className="results-icon">⌁</div>
                      <strong>No query results</strong>
                      <span>Run a SQL query to view data here.</span>
                    </div>
                  )
                ) : resultView === "messages" ? (
                  <div className={queryResult?.success === false ? "query-message error" : "query-message"}>
                    {queryResult ? (
                      <>
                        <strong>{queryResult.success ? "Query completed successfully." : "Query failed."}</strong>
                        <br />
                        {queryResult.message ? <><span>{queryResult.message}</span><br /></> : null}
                        <span>Rows affected / returned: {queryResult.row_count}</span>
                        <br />
                        <span>Duration: {queryResult.duration_ms} ms</span>
                        {Array.isArray((queryResult as any).results) ? (
                          <>
                            <br /><br />
                            <strong>{(queryResult as any).statements_executed ?? (queryResult as any).results.length} statements executed</strong>
                            {(queryResult as any).total_affected != null ? <><br /><span>Total affected rows: {(queryResult as any).total_affected}</span></> : null}
                            {(queryResult as any).results.map((item: any, index: number) => (
                              <div key={index} style={{ marginTop: "10px" }}>
                                <strong>{index + 1}. {item.command ?? item.statement_type ?? "SQL statement"}</strong>
                                <br />
                                <span>{item.row_count ?? item.affected ?? 0} rows affected / returned</span>
                                {item.message ? <><br /><span>{String(item.message)}</span></> : null}
                              </div>
                            ))}
                          </>
                        ) : null}
                      </>
                    ) : queryMessage ? queryMessage : "Run a query to view execution messages."
                    }
                  </div>
                ) : (
                  <div className="results-empty">
                    <div className="results-icon">⌁</div>
                    <strong>Explain query plan</strong>
                    <span>Run an EXPLAIN or EXPLAIN ANALYZE statement to inspect the PostgreSQL execution plan.</span>
                  </div>
                )}
              </section>

              {selectedObject &&
                (
                  objectMetadata ||
                  metadataLoading ||
                  metadataError
                ) && (
                  <ObjectDetails
                    metadata={
                      objectMetadata ?? {
                        success:
                          true,

                        schema:
                          selectedObject.schemaName,

                        name:
                          selectedObject.objectName,

                        object_type:
                          null,

                        columns:
                          [],

                        indexes:
                          [],
                      }
                    }

                    loading={
                      metadataLoading
                    }

                    error={
                      metadataError
                    }

                    onClose={
                      closeObjectDetails
                    }
                  />
                )}


              <AiAssistant
                open={
                  aiAssistantOpen
                }

                catalog={
                  catalog
                }

                databaseName={
                  activeConnection
                    ? (
                      catalog?.database ??
                      activeConnection.database
                    )
                    : null
                }

                currentSql={
                  sql
                }

                onClose={() =>
                  setAiAssistantOpen(
                    false,
                  )
                }

                onApplySql={
                  handleApplyAiSql
                }
              />
            </>
          )}
        </main>
      </div>


      <footer className="statusbar">
        <span>
          <span
            className={`status-dot ${managedEesMode
              ? activeConnection && catalog
                ? "online"
                : registryOverview && !registryError
                  ? "connecting"
                  : "offline"
              : activeConnection
                ? "online"
                : "offline"
              }`}
          />

          {managedEesMode
            ? activeConnection && catalog
              ? "PostgreSQL: EES Data Platform · Connected"
              : registryOverview && !registryError
                ? "Railway API: Online · Database Connecting"
                : "Railway API: Offline"
            : activeConnection
              ? `PostgreSQL: ${activeConnection.name}`
              : "PostgreSQL: Disconnected"}
        </span>

        <span>
          EES Registry:{" "}
          {registryOverview
            ? `${registryOverview.systems} systems • ${registryOverview.datasets} datasets`
            : registryLoading
              ? "Loading"
              : "Unavailable"}
        </span>

        <span>
          Universal Data Moon v1.0.0
        </span>
      </footer>


      <AdminLoginDialog
        open={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        onAuthenticated={(username) => {
          setAdminUser(username);
          setQueryMessage("Authenticated admin mode enabled for EES Data Platform.");
        }}
      />

      <ConnectionDialog
        open={
          connectionDialogOpen
        }

        initialConnection={
          connectionDraft
        }

        onClose={() => {
          setConnectionDraft(
            null,
          );

          setConnectionDialogOpen(
            false,
          );
        }}

        onConnect={
          handleConnect
        }
      />


      <SaveQueryDialog
        open={
          saveQueryDialogOpen
        }

        defaultName={
          `Query ${savedQueries.length + 1}`
        }

        onClose={() =>
          setSaveQueryDialogOpen(
            false,
          )
        }

        onSave={
          handleSaveQueryConfirmed
        }
      />


      <CsvImportDialog
        openDialog={
          csvImportDialogOpen
        }

        connection={
          activeConnection
        }

        catalog={
          catalog
        }

        onClose={() =>
          setCsvImportDialogOpen(
            false,
          )
        }

        onImported={
          handleCsvImported
        }
      />
    </div>
  );
}


function buildMetadataKey(
  schemaName: string,
  objectName: string,
) {
  return (
    `${schemaName}.${objectName}`
  );
}


export default App;