# Validation

Passed locally in the packaging environment:
- Python syntax/bytecode compilation for modified Data Moon backend files.
- `node --check` for all modified Pharma Data Nexus and Serverless SQL Studio JavaScript files.

A full `npm install` / Vite build was not run because the isolated package registry available in this environment returned 404 for transitive npm packages. Run the normal project build locally after merging.
