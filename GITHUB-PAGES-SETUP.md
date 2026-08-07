# EES Universal Data Moon — GitHub Pages

This patch publishes the real React/Vite Data Moon frontend rather than a separate static mock.

## Architecture

GitHub Pages (React/Vite UI)
→ Railway FastAPI
→ Railway PostgreSQL / ees_data_platform

## GitHub repository configuration

1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Secrets and variables → Actions → Variables
3. Add repository variable:
   - `DATA_MOON_API_URL`
   - value: the public Railway FastAPI URL, with no trailing slash.

Until that variable is populated, the built client falls back to the local API default and live public data calls will not work.

## Railway CORS

Add the exact Pages origin to `ALLOWED_ORIGINS`:

`https://jd-dev-king.github.io`

The API remains the security boundary; database credentials never enter the GitHub Pages build.

## Browser compatibility

The desktop app uses Tauri Store. The Pages build automatically falls back to browser `localStorage` for saved settings/history/connections, allowing the same React UI to run in a normal browser.

The public Pages build starts on **EES Systems** rather than the direct database connection screen.
