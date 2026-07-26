#!/bin/bash
set -e
cd "$(dirname "$0")"
npm install
npm run dist:mac
echo "Fertige Dateien liegen im Ordner dist. / Finished files are in the dist folder."
