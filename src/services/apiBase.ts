const PRODUCTION_API_BASE_URL =
  "https://ees-universal-data-moon-api-production.up.railway.app";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const IS_GITHUB_PAGES =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("github.io");

export const IS_TAURI =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;

// GitHub Pages must never fall back to localhost. Local Vite/Tauri keeps
// localhost as the development default, while production is pinned to Railway.
export const API_BASE_URL = (
  configuredApiBaseUrl ||
  (IS_GITHUB_PAGES ? PRODUCTION_API_BASE_URL : "http://localhost:8000")
).replace(/\/$/, "");

export const MANAGED_EES_API_BASE_URL = `${API_BASE_URL}/api`;
