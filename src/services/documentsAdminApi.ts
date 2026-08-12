import { MANAGED_EES_API_BASE_URL } from "./apiBase";

export type DocumentRow = Record<string, unknown>;

export interface AdminDocumentMutationResponse {
  success: boolean;
  action: "insert" | "update" | "delete";
  collection: string;
  document_id: string;
  document?: DocumentRow;
  matched_count?: number;
  modified_count?: number;
  deleted_count?: number;
  admin?: boolean;
  username?: string;
}

async function adminDocumentError(response: Response, fallback: string) {
  try {
    const error = await response.json();
    const detail = error?.detail ?? error?.message;
    return typeof detail === "string"
      ? detail
      : detail
        ? JSON.stringify(detail)
        : fallback;
  } catch {
    return fallback;
  }
}

export async function createAdminDocument(
  collection: string,
  document: DocumentRow,
): Promise<AdminDocumentMutationResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/admin/collections/${encodeURIComponent(collection)}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await adminDocumentError(
        response,
        `Document insert returned HTTP ${response.status}.`,
      ),
    );
  }

  return response.json();
}

export async function updateAdminDocument(
  collection: string,
  documentId: string,
  document: DocumentRow,
): Promise<AdminDocumentMutationResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/admin/collections/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await adminDocumentError(
        response,
        `Document update returned HTTP ${response.status}.`,
      ),
    );
  }

  return response.json();
}

export async function deleteAdminDocument(
  collection: string,
  documentId: string,
): Promise<AdminDocumentMutationResponse> {
  const response = await fetch(
    `${MANAGED_EES_API_BASE_URL}/documents/admin/collections/${encodeURIComponent(collection)}/${encodeURIComponent(documentId)}`,
    {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await adminDocumentError(
        response,
        `Document delete returned HTTP ${response.status}.`,
      ),
    );
  }

  return response.json();
}
