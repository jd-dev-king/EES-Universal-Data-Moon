#!/usr/bin/env bash
set -euo pipefail

echo "== EES Universal Data Moon preflight =="

echo
echo "[1/5] Checking for local secret files..."

if git ls-files \
  | grep -E '(^|/)\.env($|\.)' \
  | grep -v '\.env\.example$'
then
  echo "ERROR: a real .env-like file is tracked."
  exit 1
fi


echo
echo "[2/5] Scanning tracked text for obvious secret assignments..."

if git grep -nE \
  '(EES_INGEST_API_KEY|OPENAI_API_KEY|DATABASE_URL|MONGODB_URL)=.{8,}' \
  -- \
  ':!*.example' \
  ':!*.md' \
  2>/dev/null
then
  echo "ERROR: review the values above before pushing."
  exit 1
fi


echo
echo "[3/5] Frontend build..."

npm run build


echo
echo "[4/5] Backend syntax compile..."

if [ -x ".venv/bin/python" ]; then
  .venv/bin/python -m compileall -q backend/app

elif [ -x "backend/.venv/bin/python" ]; then
  backend/.venv/bin/python -m compileall -q backend/app

elif command -v python3 >/dev/null 2>&1; then
  python3 -m compileall -q backend/app

else
  echo "ERROR: No Python interpreter found."
  exit 1
fi


echo
echo "[5/5] Git status..."

git status --short


echo
echo "Preflight passed. Review git status before committing."