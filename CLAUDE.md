# Pago de Servicios — Instrucciones del Proyecto

## Descripción general

Aplicación web + Android para administrar el vencimiento y pago de servicios del hogar.
Stack: **React 19 + Vite** (frontend) + **Express + SQLite** (backend local).
Corre 100% en la PC de Sebastian — sin Supabase, sin Vercel, sin ningún servicio
en la nube. El código se sigue subiendo a GitHub como respaldo, pero de ahí
no se publica ni se despliega a ningún lado.
La app puede instalarse como **APK Android** usando Capacitor (pendiente de
resolver cómo llega el celular al backend local — ver `INSTRUCCIONES_DEPLOY.md`).

---

## Estructura de carpetas

```
Pago de Servicios/
├── supabase/
│   ├── schema.sql              ← Schema historico (referencia, ya no se usa)
│   ├── migrate-excel.js        ← Script viejo: Excel → Supabase (ya no se usa)
│   ├── migrate-to-sqlite.js    ← Migra los datos de Supabase → SQLite local (correr UNA VEZ)
│   └── package.json
├── app/                        ← Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx             ← Componente raíz, toda la lógica de estado
│   │   ├── App.css             ← Estilos globales
│   │   ├── lib/
│   │   │   └── db.js               ← Cliente REST al backend local (fetch a /api/*)
│   │   ├── components/
│   │   │   ├── ResumenPage.jsx     ← Tab "Inicio" (tabla de vencimientos/dashboard)
│   │   │   ├── ServiceList.jsx     ← Tab "Mis servicios" (lista + sección Mamá)
│   │   │   ├── ServiceCard.jsx     ← Tarjeta individual de cada servicio
│   │   │   ├── ServiceForm.jsx     ← Modal alta/edición de servicio
│   │   │   ├── VencimientoForm.jsx ← Modal nuevo vencimiento / registrar pago / editar
│   │   │   ├── ConfigModal.jsx     ← Modal configuración Google Calendar
│   │   │   ├── LoginPage.jsx       ← Pantalla de login (client-side, usa VITE_APP_PASSWORD)
│   │   │   └── Modal.jsx           ← Wrapper de modal genérico (arrastrable)
│   │   ├── data/
│   │   │   └── serviciosIniciales.js  ← Catálogo de servicios + CATEGORIAS
│   │   └── utils/
│   │       ├── storage.js          ← Persistencia localStorage
│   │       ├── dateUtils.js        ← Formateo fechas y etiquetas urgencia
│   │       └── googleCalendar.js   ← Integración Google Calendar API (100% client-side)
│   ├── capacitor.config.ts     ← Config Capacitor para APK Android
│   ├── .env.local              ← Variables locales (NO commitear)
│   ├── .env.production.example ← Template para build Android (opcional, ver notas)
│   └── vite.config.js          ← Configuración Vite (proxy /api → localhost:4000)
├── backend/                    ← Backend local: Express + SQLite
│   ├── server.js                   ← API REST + sirve el build del frontend, todo en un puerto
│   ├── data/pago_servicios.db      ← Base de datos SQLite (se crea sola, NO se commitea)
│   └── package.json
├── iniciar-app.bat             ← Doble clic: instala/compila si hace falta y levanta todo
├── deploy.bat                  ← Doble clic: commit + push a GitHub (solo respaldo, no deploya)
├── .env                        ← GITHUB_TOKEN + GITHUB_REPO (NO commitear, en raíz)
├── contexto/
│   └── gastos 2026.xlsx        ← Planilla original (referencia historica)
├── .gitignore
├── INSTRUCCIONES_DEPLOY.md     ← Guía para correr la app local + migrar datos de Supabase
└── CLAUDE.md                   ← Este archivo
```

---

## Cómo corre la app

Un solo proceso Node (`backend/server.js`) sirve la API REST **y** el build
compilado del frontend, todo en `http://localhost:4000`. No hay CORS, no hay
dos servidores, no hay nube.

```bash
# Uso diario: doble clic en iniciar-app.bat (instala/compila la primera vez)

# A mano:
npm run setup   # primera vez: instala backend + frontend, compila
npm start       # levanta backend/server.js en localhost:4000

# Modo desarrollo (hot reload del frontend):
npm run dev     # corre vite (5173) + backend (4000) con proxy /api
```

### Variables de entorno

`app/.env.local` (NO commitear):
```
VITE_APP_PASSWORD=radiohead
```

`backend/.env` (NO commitear):
```
PORT=4000
```

Ya no hacen falta `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` — se eliminaron.

---

## Backend local — Express + SQLite (`backend/server.js`)

Reemplaza por completo a Supabase. Un solo archivo `backend/server.js`:

- Crea (si no existe) `backend/data/pago_servicios.db` con las tablas
  `servicios`, `vencimientos`, `app_settings` (mismo modelo que tenía Supabase,
  adaptado a SQLite: booleans como `0/1`, ids `INTEGER AUTOINCREMENT` en vez
  de UUID).
- En el primer arranque, si la tabla `servicios` está vacía, la llena con el
  catálogo base (ver seed en el propio `server.js`).
- Expone los mismos endpoints REST que antes exponía el backend viejo
  contra Supabase (`GET/POST/PATCH/DELETE /api/servicios`, `/api/vencimientos`,
  `/api/config`), así que `app/src/lib/db.js` los consume vía `fetch`.
- Sirve el frontend compilado (`app/dist`) como archivos estáticos, con
  fallback a `index.html` para el ruteo SPA.
- Usa `better-sqlite3` (síncrono, sin dependencias externas más que el
  binario nativo que se descarga solo con `npm install`).

### `app/src/lib/db.js` — funciones exportadas (sin cambios de firma)

| Función | Descripción |
|--------|-------------|
| `getServicios()` | Lista servicios activos + vencimientos anidados |
| `crearVencimiento({servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado, calendarEventId})` | Crear vencimiento |
| `pagarVencimiento({id, fechaPago, monto})` | Marcar como pagado (estado='S') |
| `actualizarVencimiento({id, monto, fechaVencimiento, comentarios})` | Editar vencimiento |
| `actualizarCalendarEvent({id, calendarEventId})` | Guardar calendarEventId |
| `eliminarVencimiento(id)` | Eliminar vencimiento |
| `crearServicio({nombre, categoria, diaEstimado, notas})` | Crear nuevo servicio |
| `actualizarServicio(nombre, {categoria, diaEstimado, notas})` | Editar servicio |
| `eliminarServicio(nombre)` | Soft-delete (activo=false) |
| `getConfig()` | Leer app_settings (googleClientId) |
| `setConfig({googleClientId})` | Upsert en app_settings |

Estas funciones ahora hacen `fetch('/api/...')` en vez de llamar a
`supabase-js`. Los componentes que las consumen (`App.jsx`, etc.) no
necesitaron cambios — la firma es idéntica a la versión con Supabase.

### Migración de datos desde Supabase (`supabase/migrate-to-sqlite.js`)

Script de una sola vez. Se corre desde la PC de Sebastian (necesita internet
para leer de Supabase), y escribe directo en `backend/data/pago_servicios.db`:

```bash
cd supabase
npm install
node migrate-to-sqlite.js
```

Usa las credenciales de `supabase/.env` (o el fallback hardcodeado en el
script). Después de correrlo, la app ya no necesita Supabase para nada.

---

## Frontend — arquitectura de datos

### Fuente única: el backend local

Todos los datos vienen de `http://localhost:4000/api/*` vía `db.js`. El
frontend llama a estas funciones para toda operación de escritura y recarga
los datos con `cargarDatos()` después de cada cambio. Sin cambios respecto a
como funcionaba con Supabase, solo cambió el transporte.

### Login (client-side)
`LoginPage.jsx` compara la contraseña con `VITE_APP_PASSWORD` (default:
`'radiohead'`). Sigue sin requerir backend — es una validación simple en el
navegador, no cambió con esta migración.

### Normalización en `ServiceCard` (`norm(v)`)
```js
_fecha:  v.fecha || v.fechaVencimiento
_pagado: v.pagado === true || v.estado === 'S'
_monto:  v.monto
_notas:  v.notas || v.comentarios
```

### localStorage — solo metadatos

| Clave | Contenido |
|-------|-----------|
| `pagos_config` | `{ googleClientId }` |
| `pagos_ocultos` | Array de nombres de servicios ocultos |
| `pagos_gcal_sync` | Map de `"nombre|fecha"` → `calendarEventId` |
| `mama_gen_YYYY_MM` | Flag para no regenerar vencimientos Mamá en el mismo mes |
| `aguinaldo_gen_YYYY_MM` | Flag para no regenerar aguinaldos en el mismo mes |

---

## Funcionalidades implementadas

### 1. Dashboard / ResumenPage (tab "Inicio")

Tabla con todos los servicios visibles y su estado de vencimiento.

**Orden de filas** (de arriba a abajo):
1. No-mama, vencido → hoy → urgente → próximo → pendiente CON fecha
2. **NORA, ROSANA, AGUINALDO NORA, AGUINALDO ROSANA** (`esMultiple`, orden 5)
3. No-mama, pendiente SIN fecha
4. Servicios Mamá (siempre después de todos los no-mama)
5. Al día

**Acciones por fila:** 📅 Cargar vencimiento | ✏️ Editar vencimiento (solo si tiene ID) | ✅ Marcar como pagado

**Servicios ocultos del dashboard:**
```js
const SERVICIOS_OCULTOS_RESUMEN = ['MARIEL'];
```

**Servicios con tooltip anual (NORA y ROSANA):**
- No muestran fecha ni monto en la tabla
- Al pasar el mouse sobre el badge de estado, muestra tooltip con todos los pagos del año y sus montos
- `const SERVICIOS_TOOLTIP_ANUAL = ['NORA', 'ROSANA']`

**AGUINALDO NORA y AGUINALDO ROSANA:**
- Solo aparecen en el dashboard en **junio (6)** y **diciembre (12)**
- `const AGUINALDO_MESES_VALIDOS = [6, 12]`

### 2. Auto-generación de vencimientos Mamá

- Se ejecuta en `cargarDatos()` via `autoGenerarMama()`
- Crea vencimiento del día 10 de cada mes para servicios con "MAMA" en el nombre
- Flag `mama_gen_YYYY_MM` en localStorage evita duplicados

### 3. Auto-generación de vencimientos Aguinaldo

- Se ejecuta en `cargarDatos()` via `autoGenerarAguinaldo()`
- Solo corre en **junio** (crea fecha 30/06) y **diciembre** (crea fecha 31/12)
- Flag `aguinaldo_gen_YYYY_MM` en localStorage evita duplicados
- Servicios afectados: los que tienen "AGUINALDO" en el nombre (`permiteMultiplesPagos=true`)

### 4. Servicios con múltiples pagos por mes (`permiteMultiplesPagos`)

Servicios: **NORA, ROSANA, AGUINALDO NORA, AGUINALDO ROSANA, MARIEL**

Comportamiento en `calcEstado`:
- Si hay pagos este mes → clase `estado-multiple`, label "N pagos", `esMultiple: true`
- Si no hay pagos → `null` (no aparecen en el dashboard — son registros de pago, no vencimientos)
- Botón 📅 en dashboard abre "Registrar pago" directamente (no crea pendiente)

En el dashboard: siempre van al orden 5 (entre fechados y sin fecha).

### 5. Servicios sin Google Calendar

```js
const SERVICIOS_SIN_CALENDAR = ['NORA', 'ROSANA', 'AGUINALDO NORA', 'AGUINALDO ROSANA', 'MARIEL'];
```

Estos servicios nunca crean ni sincronizan eventos en Google Calendar.

### 6. Modales arrastrables (Modal.jsx)

Todos los modales (VencimientoForm, ServiceForm, ConfigModal) se pueden arrastrar con mouse o touch.

Implementación con Pointer Events API en `Modal.jsx`:
- `onPointerDown` en el header inicia el drag
- `setPointerCapture` para tracking fuera del elemento
- `hasDragged` ref previene que cerrar el modal al soltar
- Posición via `style={{ position: 'relative', left: offset.x, top: offset.y }}`

### 7. Input de monto inteligente (VencimientoForm.jsx)

- Formato argentino: punto = separador de miles, coma = decimal (ej: `1.234.567,89`)
- La tecla `.` del teclado numérico se interpreta como coma decimal
- El valor de referencia (último monto) se muestra como hint en el label, NO en el input
- Estado separado `montoRaw` para el valor sin formatear
- Props nuevas: `modoEditar`, `initialValues` (para pre-cargar fecha y monto al editar)

### 8. Editar vencimiento (✏️)

- Botón ✏️ disponible en el dashboard (ResumenPage) y en ServiceCard (vista expandida > Pendientes)
- Solo aparece si el vencimiento tiene `id` (no es de Excel) y `!esMultiple`
- Abre `VencimientoForm` en modo `modoEditar=true`, pre-cargando fecha y monto
- Guarda via `actualizarVencimiento({id, monto, fechaVencimiento, comentarios})` de db.js

### 9. Eliminar vencimientos (historial + pendientes)

- Botón 🗑 en pendientes Y en historial de pagados de ServiceCard
- Muestra TODOS los pagados (sin límite de 5)
- Llama a `eliminarVencimiento(id)` de db.js

### 10. Ocultar/restaurar servicios

- `handleOcultarServicio(nombre)` → agrega a `ocultos` en localStorage
- `handleMostrarServicio(nombre)` → lo quita

### 11. Google Calendar

- Client ID hardcodeado como default: `987611899031-7d8qbnul2e7u5mah6isvlt9mrii1c4al.apps.googleusercontent.com`
- Se persiste en el backend local (tabla `app_settings`) para no perderlo al reinstalar
- 100% client-side (gapi + Google Identity Services) — no depende del backend
  más que para guardar/leer el Client ID configurado
- Botón "Sincronizar" deduplica eventos antes de crear nuevos
- Servicios en `SERVICIOS_SIN_CALENDAR` nunca crean eventos
- El origen JavaScript autorizado en Google Cloud Console debe incluir
  `http://localhost:4000` (ver `INSTRUCCIONES_DEPLOY.md`)

---

## Servicios registrados

### Propios
OSDE, EDESUR, METROGAS, AYSA, MUNICIPAL, CABLEVISION, PERSONAL, PERSONAL MOVIL, PERSONAL HOGAR, MONOTRIBUTO (ROCIO), CAJA PREVISION ROCIO, ARBA, PATENTE DEL AUTO, SEGURO AUTO, SEGURO CAJERO, SEGURO VIDA, TARJETA NATIVA VISA, TARJETA NATIVA MASTER

### Especiales (permiteMultiplesPagos=true, sin Calendar)
NORA, ROSANA, AGUINALDO NORA, AGUINALDO ROSANA, MARIEL

NORA y ROSANA: tooltip anual en badge, sin fecha/monto en la tabla.
MARIEL: oculto del dashboard (`SERVICIOS_OCULTOS_RESUMEN`).
AGUINALDO NORA/ROSANA: solo visibles en junio y diciembre.

### Mamá (vencen el día 10, auto-generados al inicio del mes)
AYSA MAMA, EDESUR MAMA, METROGAS MAMA, IOMA MAMA, MUNICIPAL MAMA, ARBA MAMA

---

## CATEGORIAS

```js
salud           → 🏥 azul
servicios       → 🏠 verde
telefonia       → 📱 violeta
entretenimiento → 📺 amarillo
impuestos       → 📋 rojo
seguros         → 🛡️ índigo
tarjetas        → 💳 rosa
servicios_mama  → 👵 teal
salud_mama      → 💊 cyan
impuestos_mama  → 📄 naranja
otros           → 📌 gris
```

---

## Workflow GitHub — REGLA OBLIGATORIA

**Los archivos locales son siempre la fuente de verdad.** Nunca usar los archivos del clone de GitHub para sobrescribir los locales.

El repositorio en GitHub es **solo respaldo del código** — no hay ningún
servicio (Vercel, Render, Supabase) escuchando los pushes. Nada se publica ni
se redeploya. Commitear y pushear no requiere autorización previa del usuario
salvo que se detecten archivos sensibles en el diff (ver más abajo).

```bash
# Token en .env de la RAÍZ del proyecto (no en backend/.env)
TOKEN=$(grep GITHUB_TOKEN /ruta/local/.env | cut -d= -f2 | tr -d ' \r\n')

rm -rf /tmp/repo-sync
git clone "https://${TOKEN}@github.com/lacruzs-cyber/pago-servicios.git" /tmp/repo-sync
git config user.email "lacruzs@gmail.com"
git config user.name "Sebastian"

# Copiar SOLO archivos modificados (local → clone, NUNCA al revés)
cp /local/archivo /tmp/repo-sync/archivo

# Verificar que no estén truncados
wc -l /tmp/repo-sync/archivo
tail -3 /tmp/repo-sync/archivo

# Build test SIEMPRE antes de pushear
cd /tmp/repo-sync/app && npm install && npm run build

# Push
cd /tmp/repo-sync
git add archivo
git commit -m "descripción"
git push origin main
```

No hay redeploy automático de ningún tipo — es solo control de versiones.

---

## Consideraciones técnicas CRÍTICAS

### Truncación de archivos JSX en Windows mount

**PROBLEMA**: La herramienta `Write` trunca archivos >~3600 bytes en el mount de Windows (`D:\Desarrollo\...`). Los archivos quedan cortados sin error visible, causando fallos de build silenciosos.

**SÍNTOMA**: `wc -l archivo.jsx` muestra menos líneas de las esperadas; el archivo termina a mitad de un bloque JSX.

**SOLUCIÓN OBLIGATORIA** para archivos JSX/JS grandes:
1. Nunca usar `Write` directo para archivos >3600 bytes en el mount Windows
2. Usar scripts Python para generar/modificar archivos:
   ```python
   with open('/sessions/.../mnt/Pago de Servicios/app/src/...jsx', 'w', encoding='utf-8') as f:
       f.write(content)
   ```
3. Para ediciones pequeñas: usar la herramienta `Edit` (solo envía el diff, no trunca)
4. Siempre verificar con `wc -l` y `tail -5` después de escribir
5. Hacer `npm run build` en el clone antes de pushear

### El mount de Windows es lento para muchos archivos chicos

Operaciones que tocan `node_modules` completo (copiar, instalar) via el mount
`D:\...` pueden ser mucho más lentas que en un disco nativo — tenerlo en
cuenta si un `npm install` o similar parece colgado; probablemente solo está
lento, no roto.

### Emojis en Python
- Usar `\U0001FXXX` (8 dígitos, mayúscula): `'\U0001F4B3'` = 💳
- NO usar surrogate pairs `\ud83d\uXXXX`
- NO usar notación JS `\u{1F4B3}`

### Git: formato del token
```bash
# CORRECTO:
git clone "https://${TOKEN}@github.com/lacruzs-cyber/pago-servicios.git"
git remote set-url origin "https://${TOKEN}@github.com/lacruzs-cyber/pago-servicios.git"

# INCORRECTO (falla):
"https://x-token:${TOKEN}@github.com/..."
```

### better-sqlite3 — instalación

`better-sqlite3` necesita un binario nativo. Al hacer `npm install` en
`backend/` descarga un binario precompilado para Windows automáticamente (no
requiere Visual Studio Build Tools en el caso normal). Si algún día falla la
descarga del binario, la alternativa es compilar desde fuente (necesita
Python + build tools de Windows) — pero no debería hacer falta.

### Supabase — ya no se usa, solo referencia histórica

`supabase/schema.sql` y `supabase/migrate-excel.js` quedan como referencia de
cómo era el modelo de datos original. `supabase/migrate-to-sqlite.js` es el
único script de esa carpeta que todavía tiene un propósito activo (migración
única de datos viejos). Una vez migrados los datos, el proyecto de Supabase
en la nube puede borrarse — ver `INSTRUCCIONES_DEPLOY.md`.
