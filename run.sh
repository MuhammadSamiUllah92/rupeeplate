#!/bin/sh
# RupeePlate on Mac/Linux: sets up Python once, then runs the whole app at http://127.0.0.1:8000
cd "$(dirname "$0")/backend" || exit 1
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate
pip install -q -r requirements.txt
python -m uvicorn main:app --port 8000
