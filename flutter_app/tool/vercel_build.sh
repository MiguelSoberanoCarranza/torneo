#!/usr/bin/env bash
# Compila la versión web en Vercel (Vercel no trae Flutter instalado).
#
# Variables de entorno (Vercel → Settings → Environment Variables):
#   SUPABASE_URL        obligatoria
#   SUPABASE_ANON_KEY   obligatoria (la publishable/anon key, es pública)
#   PUBLIC_BASE_URL     opcional; dominio de esta app para los enlaces públicos
#                       desde Android/iOS. Por defecto, el dominio de producción
#                       que asigna Vercel.
set -euo pipefail

FLUTTER_VERSION="3.35.5"

: "${SUPABASE_URL:?Falta la variable SUPABASE_URL en Vercel}"
: "${SUPABASE_ANON_KEY:?Falta la variable SUPABASE_ANON_KEY en Vercel}"

if ! command -v flutter >/dev/null 2>&1; then
  SDK="${HOME}/flutter-${FLUTTER_VERSION}"
  if [ ! -x "${SDK}/bin/flutter" ]; then
    echo "Instalando Flutter ${FLUTTER_VERSION}..."
    git clone --depth 1 --branch "${FLUTTER_VERSION}" \
      https://github.com/flutter/flutter.git "${SDK}"
  fi
  export PATH="${SDK}/bin:${PATH}"
  # El SDK pertenece a otro usuario en algunos runners.
  git config --global --add safe.directory '*'
fi

flutter --disable-analytics >/dev/null 2>&1 || true
flutter config --no-cli-animations >/dev/null 2>&1 || true
flutter --version

BASE_URL="${PUBLIC_BASE_URL:-}"
if [ -z "${BASE_URL}" ] && [ -n "${VERCEL_PROJECT_PRODUCTION_URL:-}" ]; then
  BASE_URL="https://${VERCEL_PROJECT_PRODUCTION_URL}"
fi

flutter pub get
flutter build web --release --no-web-resources-cdn \
  --dart-define=SUPABASE_URL="${SUPABASE_URL}" \
  --dart-define=SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" \
  ${BASE_URL:+--dart-define=PUBLIC_BASE_URL="${BASE_URL}"}

echo "Listo: build/web"
