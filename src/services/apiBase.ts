export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:8000"
).replace(/\/$/, "");

export const MANAGED_EES_API_BASE_URL =
  `${API_BASE_URL}/api`;

export const IS_GITHUB_PAGES =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith("github.io");

export const IS_TAURI =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;
