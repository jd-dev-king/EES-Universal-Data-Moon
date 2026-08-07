# EES Universal Data Moon — Public API Status Hotfix

For the GitHub Pages build only, this patch:

- changes `NO CONNECTION` to a live Data Moon API state
- reports `DATA MOON API ONLINE` when the registry API has loaded
- replaces the direct-database connection area with a public governed-access card
- hides New Connection and saved direct database connections on GitHub Pages
- preserves all direct PostgreSQL connection controls in local/Tauri mode
- updates the footer to show Railway API status
- updates the visible version label to v1.0.0

The public browser continues to use the Railway FastAPI security boundary; PostgreSQL credentials are not exposed to the client.
