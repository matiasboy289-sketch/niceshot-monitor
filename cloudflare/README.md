# NICE SV — Migración a Cloudflare (rama de preparación)

Esta rama **no sustituye** el backend Flask de Render. El archivo original \`app.py\`, los HTML y todos los medios permanecen en \`main\`.

## API Cloudflare

El archivo \`cloudflare/worker.js\` implementa las rutas usadas por la página original:

- \`GET /health\`
- \`GET /api/status\`: último reporte del servidor desde KV
- \`POST /api/status/ingest\`: reporte firmado mediante token del servidor (se configurará el plugin SourceMod)
- \`GET /api/bans\`: Supabase + archivo de baneos históricos CrystalVamp
- \`POST /api/bans/ingest\`: registra eventos en Supabase
- \`GET /api/steam-profile?user=ice\` y rutas de avatares Steam

## Variables y secretos

En **Cloudflare Workers > niceshot-api > Settings > Bindings**:

1. KV namespace, nombre de variable **exacto**: \`NICESV_DATA\` (sin tabulaciones).
2. Secret: \`NICESV_INGEST_TOKEN\`. Genera un secreto largo, aleatorio y distinto para el servidor. No lo incluyas en GitHub.
3. Secret: \`SUPABASE_URL\`, la URL HTTPS del mismo proyecto Supabase que usa Render.
4. Secret: \`SUPABASE_SECRET_KEY\`, la clave de servicio del proyecto. No debe quedar en HTML ni en el repositorio.

**No publiques ni pruebes \`POST /api/status/ingest\` sin token**. Los perfiles de Steam son públicos, pero las rutas de escritura requieren token.

## Despliegue separado

1. Pega \`cloudflare/worker.js\` en el editor de \`niceshot-api\`.
2. Comprueba que el KV y los tres secretos estén configurados antes de activar el servicio.
3. Verifica \`/health\`; \`/api/status\` informará sin datos hasta que un plugin reporte estado.
4. Verifica \`/api/bans\` y perfiles Steam. Los baneos no deben modificarse ni migrarse manualmente.
5. Tras probar el backend, publica el frontend como Cloudflare Pages con **directorio de salida \`static\`** (no la raíz del repositorio). El HTML es estático.
6. Para preservar las llamadas relativas \`/api/*\` sin tocar los HTML, configura en Pages un proxy de rutas hacia el Worker, p. ej. mediante una función \`functions/api/[[path]].js\` de Pages (incluida en esta rama). No uses un dominio público sin CORS/seguridad.

## Limitación fundamental

Cloudflare Workers no puede consultar UDP A2S directamente. Hace falta un plugin SourceMod que envíe HTTPS a \`POST /api/status/ingest\`. Hasta tenerlo, el monitor indicará que no hay datos recientes. La API no inventa información. El endpoint \`/api/status\` trata como atrasados los reportes con más de 90 s.

## Seguridad y continuidad

- Mantén Render funcionando hasta validar KV, ban list, perfiles y servidor.
- La lista histórica CrystalVamp se lee desde el archivo actual de \`main\`; evita diferencias durante la prueba.
- El almacenamiento KV es eventualmente consistente: la actualización no es instantánea globalmente.
- No atribuyas el estado "offline" al servidor únicamente porque el monitor no recibió un reporte reciente.
