import {
  useEffect,
  useRef,
} from "react";

import Editor, {
  type Monaco,
} from "@monaco-editor/react";

import type {
  editor,
  languages,
  Position,
} from "monaco-editor";

import type {
  DatabaseCatalogResponse,
  ObjectMetadataResponse,
} from "../../services/api";

interface SqlEditorProps {
  value: string;

  onChange: (
    value: string,
  ) => void;

  catalog:
    DatabaseCatalogResponse | null;

  objectMetadata:
    ObjectMetadataResponse | null;

  metadataCache: Record<
    string,
    ObjectMetadataResponse
  >;

  onRequestObjectMetadata: (
    schemaName: string,
    objectName: string,
  ) => Promise<
    ObjectMetadataResponse | null
  >;

  autocompleteEnabled:
    boolean;
}

interface TableReference {
  schemaName: string | null;
  tableName: string;
  alias: string | null;
}

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "FULL JOIN",
  "CROSS JOIN",
  "ON",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "CREATE TABLE",
  "ALTER TABLE",
  "DROP TABLE",
  "TRUNCATE TABLE",
  "DISTINCT",
  "AS",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "IS NULL",
  "IS NOT NULL",
  "IN",
  "NOT IN",
  "BETWEEN",
  "LIKE",
  "ILIKE",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "UNION",
  "UNION ALL",
  "EXISTS",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
];

interface SqlSnippet {
  label: string;
  prefix: string;
  body: string;
  detail: string;
}

const SQL_SNIPPETS: SqlSnippet[] = [
  {
    label: "SELECT template",
    prefix: "select",
    body:
      "SELECT ${1:*}\nFROM ${2:schema.table}\nWHERE ${3:condition}\nLIMIT ${4:100};",
    detail:
      "SELECT with FROM, WHERE, and LIMIT",
  },
  {
    label: "SELECT all",
    prefix: "selectall",
    body:
      "SELECT *\nFROM ${1:schema.table}\nLIMIT ${2:100};",
    detail:
      "Preview rows from a table",
  },
  {
    label: "INSERT template",
    prefix: "insert",
    body:
      "INSERT INTO ${1:schema.table} (\n  ${2:column_1},\n  ${3:column_2}\n)\nVALUES (\n  ${4:value_1},\n  ${5:value_2}\n);",
    detail:
      "INSERT INTO template",
  },
  {
    label: "UPDATE template",
    prefix: "update",
    body:
      "UPDATE ${1:schema.table}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};",
    detail:
      "UPDATE template",
  },
  {
    label: "DELETE template",
    prefix: "delete",
    body:
      "DELETE FROM ${1:schema.table}\nWHERE ${2:condition};",
    detail:
      "DELETE template",
  },
  {
    label: "CREATE TABLE template",
    prefix: "createtable",
    body:
      "CREATE TABLE ${1:schema.table} (\n  ${2:id} BIGSERIAL PRIMARY KEY,\n  ${3:name} TEXT NOT NULL,\n  ${4:created_at} TIMESTAMPTZ DEFAULT NOW()\n);",
    detail:
      "CREATE TABLE template",
  },
  {
    label: "INNER JOIN template",
    prefix: "join",
    body:
      "SELECT\n  ${1:a.*},\n  ${2:b.*}\nFROM ${3:schema.table_a} AS a\nINNER JOIN ${4:schema.table_b} AS b\n  ON ${5:a.id = b.foreign_id};",
    detail:
      "INNER JOIN with aliases",
  },
  {
    label: "LEFT JOIN template",
    prefix: "leftjoin",
    body:
      "SELECT\n  ${1:a.*},\n  ${2:b.*}\nFROM ${3:schema.table_a} AS a\nLEFT JOIN ${4:schema.table_b} AS b\n  ON ${5:a.id = b.foreign_id};",
    detail:
      "LEFT JOIN with aliases",
  },
  {
    label: "GROUP BY template",
    prefix: "groupby",
    body:
      "SELECT\n  ${1:group_column},\n  COUNT(*) AS ${2:row_count}\nFROM ${3:schema.table}\nGROUP BY ${1:group_column}\nORDER BY ${2:row_count} DESC;",
    detail:
      "GROUP BY with COUNT",
  },
  {
    label: "CTE template",
    prefix: "cte",
    body:
      "WITH ${1:source_data} AS (\n  SELECT *\n  FROM ${2:schema.table}\n)\nSELECT *\nFROM ${1:source_data};",
    detail:
      "Common table expression",
  },
];

export default function SqlEditor({
  value,
  onChange,
  catalog,
  objectMetadata,
  metadataCache,
  onRequestObjectMetadata,
  autocompleteEnabled,
}: SqlEditorProps) {
  const completionDisposable =
    useRef<{
      dispose: () => void;
    } | null>(null);

  const monacoRef =
    useRef<Monaco | null>(
      null,
    );

  useEffect(() => {
    if (!monacoRef.current) {
      return;
    }

    registerCompletionProvider(
      monacoRef.current,
    );

    return () => {
      completionDisposable.current?.dispose();

      completionDisposable.current =
        null;
    };
  }, [
    catalog,
    objectMetadata,
    metadataCache,
    autocompleteEnabled,
    onRequestObjectMetadata,
  ]);

  function registerCompletionProvider(
    monaco: Monaco,
  ) {
    completionDisposable.current?.dispose();

    if (!autocompleteEnabled) {
      completionDisposable.current =
        null;

      return;
    }

    completionDisposable.current =
      monaco.languages.registerCompletionItemProvider(
        "sql",
        {
          triggerCharacters: [
            ".",
            " ",
          ],

          async provideCompletionItems(
            model: editor.ITextModel,
            position: Position,
          ) {
            const word =
              model.getWordUntilPosition(
                position,
              );

            const range:
              languages.CompletionItem["range"] =
              {
                startLineNumber:
                  position.lineNumber,

                endLineNumber:
                  position.lineNumber,

                startColumn:
                  word.startColumn,

                endColumn:
                  word.endColumn,
              };

            const textBeforeCursor =
              model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,

                endLineNumber:
                  position.lineNumber,

                endColumn:
                  position.column,
              });

            const context =
              getDotContext(
                textBeforeCursor,
              );

            const tableReferences =
              parseTableReferences(
                textBeforeCursor,
              );

            if (
              context &&
              catalog
            ) {
              const aliasTarget =
                findAliasTarget(
                  context,
                  tableReferences,
                );

              if (aliasTarget) {
                const metadata =
                  await resolveMetadataForReference(
                    aliasTarget,
                    catalog,
                    metadataCache,
                    objectMetadata,
                    onRequestObjectMetadata,
                  );

                if (metadata) {
                  return {
                    suggestions:
                      buildMetadataColumnSuggestions(
                        monaco,
                        metadata,
                        range,
                      ),
                  };
                }
              }

              const schema =
                catalog.schemas.find(
                  (candidate) =>
                    candidate.name ===
                    context,
                );

              if (schema) {
                return {
                  suggestions:
                    buildSchemaObjectSuggestions(
                      monaco,
                      schema,
                      range,
                    ),
                };
              }

              const tableReference =
                findTableReference(
                  context,
                  tableReferences,
                );

              if (tableReference) {
                const metadata =
                  await resolveMetadataForReference(
                    tableReference,
                    catalog,
                    metadataCache,
                    objectMetadata,
                    onRequestObjectMetadata,
                  );

                if (metadata) {
                  return {
                    suggestions:
                      buildMetadataColumnSuggestions(
                        monaco,
                        metadata,
                        range,
                      ),
                  };
                }
              }
            }

            const suggestions:
              languages.CompletionItem[] =
              [];

            for (
              const snippet
              of SQL_SNIPPETS
            ) {
              suggestions.push({
                label:
                  snippet.label,

                filterText:
                  snippet.prefix,

                kind:
                  monaco.languages
                    .CompletionItemKind
                    .Snippet,

                insertText:
                  snippet.body,

                insertTextRules:
                  monaco.languages
                    .CompletionItemInsertTextRule
                    .InsertAsSnippet,

                range,

                detail:
                  snippet.detail,

                sortText:
                  `0_snippet_${snippet.prefix}`,
              });
            }

            for (
              const keyword
              of SQL_KEYWORDS
            ) {
              suggestions.push({
                label:
                  keyword,

                kind:
                  monaco.languages
                    .CompletionItemKind
                    .Keyword,

                insertText:
                  keyword,

                range,

                detail:
                  "SQL keyword",

                sortText:
                  `1_keyword_${keyword}`,
              });
            }

            if (catalog) {
              for (
                const schema
                of catalog.schemas
              ) {
                suggestions.push({
                  label:
                    schema.name,

                  kind:
                    monaco.languages
                      .CompletionItemKind
                      .Module,

                  insertText:
                    schema.name,

                  range,

                  detail:
                    "PostgreSQL schema",

                  sortText:
                    `2_schema_${schema.name}`,
                });

                for (
                  const table
                  of schema.tables
                ) {
                  suggestions.push({
                    label:
                      table,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Struct,

                    insertText:
                      table,

                    range,

                    detail:
                      `Table • ${schema.name}`,

                    documentation:
                      `${schema.name}.${table}`,

                    sortText:
                      `3_table_${table}`,
                  });

                  suggestions.push({
                    label:
                      `${schema.name}.${table}`,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Struct,

                    insertText:
                      `"${escapeIdentifier(
                        schema.name,
                      )}"."${escapeIdentifier(
                        table,
                      )}"`,

                    range,

                    detail:
                      "Qualified PostgreSQL table",

                    documentation:
                      `${schema.name}.${table}`,

                    sortText:
                      `3_table_${schema.name}_${table}`,
                  });
                }

                for (
                  const view
                  of schema.views
                ) {
                  suggestions.push({
                    label:
                      view,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Reference,

                    insertText:
                      view,

                    range,

                    detail:
                      `View • ${schema.name}`,

                    documentation:
                      `${schema.name}.${view}`,

                    sortText:
                      `4_view_${view}`,
                  });

                  suggestions.push({
                    label:
                      `${schema.name}.${view}`,

                    kind:
                      monaco.languages
                        .CompletionItemKind
                        .Reference,

                    insertText:
                      `"${escapeIdentifier(
                        schema.name,
                      )}"."${escapeIdentifier(
                        view,
                      )}"`,

                    range,

                    detail:
                      "Qualified PostgreSQL view",

                    sortText:
                      `4_view_${schema.name}_${view}`,
                  });
                }
              }
            }

            for (
              const metadata
              of Object.values(
                metadataCache,
              )
            ) {
              if (
                metadata.success
              ) {
                suggestions.push(
                  ...buildMetadataColumnSuggestions(
                    monaco,
                    metadata,
                    range,
                  ),
                );
              }
            }

            if (
              objectMetadata?.success
            ) {
              suggestions.push(
                ...buildMetadataColumnSuggestions(
                  monaco,
                  objectMetadata,
                  range,
                ),
              );
            }

            return {
              suggestions:
                deduplicateSuggestions(
                  suggestions,
                ),
            };
          },
        },
      );
  }

  return (
    <Editor
      height="100%"
      language="sql"
      value={value}
      theme="vs-dark"

      beforeMount={(
        monaco,
      ) => {
        monacoRef.current =
          monaco;

        registerCompletionProvider(
          monaco,
        );
      }}

      onChange={(
        newValue,
      ) =>
        onChange(
          newValue ?? "",
        )
      }

      options={{
        minimap: {
          enabled: false,
        },

        fontSize: 13,

        lineHeight: 22,

        fontFamily:
          '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',

        scrollBeyondLastLine:
          false,

        automaticLayout:
          true,

        wordWrap: "off",

        tabSize: 2,

        insertSpaces: true,

        lineNumbers: "on",

        renderLineHighlight:
          "line",

        folding: true,

        glyphMargin: false,

        overviewRulerBorder:
          false,

        hideCursorInOverviewRuler:
          true,

        quickSuggestions:
          autocompleteEnabled
            ? {
                other: true,
                comments: false,
                strings: false,
              }
            : false,

        suggestOnTriggerCharacters:
          autocompleteEnabled,

        wordBasedSuggestions:
          autocompleteEnabled
            ? "currentDocument"
            : "off",

        tabCompletion:
          autocompleteEnabled
            ? "on"
            : "off",

        parameterHints: {
          enabled:
            autocompleteEnabled,
        },

        snippetSuggestions:
          "top",

        padding: {
          top: 14,
          bottom: 14,
        },
      }}
    />
  );
}

async function resolveMetadataForReference(
  reference: TableReference,
  catalog: DatabaseCatalogResponse,
  metadataCache: Record<
    string,
    ObjectMetadataResponse
  >,
  objectMetadata:
    ObjectMetadataResponse | null,
  onRequestObjectMetadata: (
    schemaName: string,
    objectName: string,
  ) => Promise<
    ObjectMetadataResponse | null
  >,
): Promise<
  ObjectMetadataResponse | null
> {
  const schemaName =
    resolveSchemaName(
      reference,
      catalog,
    );

  if (!schemaName) {
    return null;
  }

  const cacheKey =
    buildMetadataKey(
      schemaName,
      reference.tableName,
    );

  const cached =
    metadataCache[
      cacheKey
    ];

  if (
    cached?.success
  ) {
    return cached;
  }

  if (
    objectMetadata?.success &&
    objectMetadata.schema ===
      schemaName &&
    objectMetadata.name ===
      reference.tableName
  ) {
    return objectMetadata;
  }

  return onRequestObjectMetadata(
    schemaName,
    reference.tableName,
  );
}

function resolveSchemaName(
  reference: TableReference,
  catalog: DatabaseCatalogResponse,
): string | null {
  if (
    reference.schemaName
  ) {
    return reference.schemaName;
  }

  const matches =
    catalog.schemas.filter(
      (schema) =>
        schema.tables.includes(
          reference.tableName,
        ) ||
        schema.views.includes(
          reference.tableName,
        ),
    );

  if (
    matches.length === 1
  ) {
    return matches[0].name;
  }

  const publicMatch =
    matches.find(
      (schema) =>
        schema.name ===
        "public",
    );

  if (publicMatch) {
    return publicMatch.name;
  }

  return null;
}

function buildMetadataKey(
  schemaName: string,
  objectName: string,
) {
  return (
    `${schemaName}.${objectName}`
  );
}

function getDotContext(
  textBeforeCursor: string,
): string | null {
  const match =
    textBeforeCursor.match(
      /(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\.\s*$/,
    );

  if (!match) {
    return null;
  }

  return (
    match[1] ??
    match[2] ??
    null
  );
}

function parseTableReferences(
  sqlText: string,
): TableReference[] {
  const references:
    TableReference[] =
    [];

  const pattern =
    /\b(?:FROM|JOIN)\s+(?:(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\.\s*)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))(?:\s+(?:AS\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)))?/gi;

  let match:
    RegExpExecArray | null;

  while (
    (
      match =
        pattern.exec(
          sqlText,
        )
    ) !== null
  ) {
    const schemaName =
      match[1] ??
      match[2] ??
      null;

    const tableName =
      match[3] ??
      match[4];

    const alias =
      match[5] ??
      match[6] ??
      null;

    if (!tableName) {
      continue;
    }

    if (
      alias &&
      isSqlClauseKeyword(
        alias,
      )
    ) {
      references.push({
        schemaName,
        tableName,
        alias: null,
      });

      continue;
    }

    references.push({
      schemaName,
      tableName,
      alias,
    });
  }

  return references;
}

function findAliasTarget(
  context: string,
  references: TableReference[],
): TableReference | null {
  return (
    references.find(
      (reference) =>
        reference.alias ===
        context,
    ) ?? null
  );
}

function findTableReference(
  context: string,
  references: TableReference[],
): TableReference | null {
  return (
    references.find(
      (reference) =>
        reference.tableName ===
        context,
    ) ?? null
  );
}

function buildMetadataColumnSuggestions(
  monaco: Monaco,
  metadata:
    ObjectMetadataResponse,
  range:
    languages.CompletionItem["range"],
): languages.CompletionItem[] {
  if (!metadata.success) {
    return [];
  }

  return metadata.columns.map(
    (column) => ({
      label:
        column.name,

      kind:
        monaco.languages
          .CompletionItemKind
          .Field,

      insertText:
        `"${escapeIdentifier(
          column.name,
        )}"`,

      range,

      detail:
        `${column.data_type}${
          column.primary_key
            ? " • PK"
            : ""
        }`,

      documentation:
        column.nullable
          ? "Nullable column"
          : "NOT NULL column",

      sortText:
        `0_column_${column.name}`,
    }),
  );
}

function buildSchemaObjectSuggestions(
  monaco: Monaco,
  schema:
    DatabaseCatalogResponse["schemas"][number],
  range:
    languages.CompletionItem["range"],
): languages.CompletionItem[] {
  const suggestions:
    languages.CompletionItem[] =
    [];

  for (
    const table
    of schema.tables
  ) {
    suggestions.push({
      label:
        table,

      kind:
        monaco.languages
          .CompletionItemKind
          .Struct,

      insertText:
        `"${escapeIdentifier(
          table,
        )}"`,

      range,

      detail:
        `Table • ${schema.name}`,

      sortText:
        `0_${table}`,
    });
  }

  for (
    const view
    of schema.views
  ) {
    suggestions.push({
      label:
        view,

      kind:
        monaco.languages
          .CompletionItemKind
          .Reference,

      insertText:
        `"${escapeIdentifier(
          view,
        )}"`,

      range,

      detail:
        `View • ${schema.name}`,

      sortText:
        `1_${view}`,
    });
  }

  return suggestions;
}

function deduplicateSuggestions(
  suggestions:
    languages.CompletionItem[],
): languages.CompletionItem[] {
  const seen =
    new Set<string>();

  return suggestions.filter(
    (suggestion) => {
      const label =
        typeof suggestion.label ===
        "string"
          ? suggestion.label
          : suggestion.label.label;

      const key =
        `${label}|${suggestion.insertText}`;

      if (
        seen.has(
          key,
        )
      ) {
        return false;
      }

      seen.add(
        key,
      );

      return true;
    },
  );
}

function isSqlClauseKeyword(
  value: string,
): boolean {
  const normalized =
    value.toUpperCase();

  return [
    "WHERE",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "FULL",
    "CROSS",
    "ON",
    "GROUP",
    "ORDER",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "UNION",
    "RETURNING",
    "SET",
    "VALUES",
  ].includes(
    normalized,
  );
}

function escapeIdentifier(
  value: string,
) {
  return value.replace(
    /"/g,
    '""',
  );
}