# Pago de Servicios — Instrucciones del Proyecto

## Descripción general

Aplicación web + Android para administrar el vencimiento y pago de servicios del hogar.  
Stack: **React 19 + Vite** (frontend) + **Node.js/Express** (backend) + **Supabase PostgreSQL** (base de datos).  
El backend lee/escribe datos en Supabase (reemplazó al Excel original con SheetJS).  
La app puede instalarse como **APK Android** usando Capacitor.  
El deploy se hace en **Railway** (gratis).

---

## Estructura de carpetas

```
Pago de Servicios/
├── supabase/
│   ├── schema.sql              ← Schema PostgreSQL + seed de servicios
│   ├── migrate-excel.js        ← Script de migración Excel → Supabase (ejecutar una sola vez)
│   └── package.json
├── app/                        ← Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx             ← Componente raíz, toda la lógica de estado
│   │   ├── App.css             ← Estilos globales
│   │   ├── components/
│   │   │   ├── ResumenPage.jsx     ← Tab "Inicio" (tabla de vencimientos/dashboard)
│   │   │   ├── ServiceList.jsx     ← Tab "Mis servicios" (lista + sección Mamá)
│   │   │   ├── ServiceCard.jsx     ← Tarjeta individual de cada servicio
│   │   │   ├── ServiceForm.jsx     ← Modal alta/edición de servicio
│   │   │   ├── VencimientoForm.jsx ← Modal nuevo vencimiento / registrar pago / editar
│   │   │   ├── ConfigModal.jsx     ← Modal configuración Google Calendar
│   │   │   ├── LoginPage.jsx       ← Pantalla de login
│   │   │   └── Modal.jsx           ← Wrapper de modal genérico (arrastrble)
│   │   ├── data/
│   │   │   └── serviciosIniciales.js  ← Catálogo de servicios + CATEGORIAS
│   │   └── utils/
│   │       ├── storage.js          ← Persistencia localStorage
│   │       ├── dateUtils.js        ← Formateo fechas y etiquetas urgencia
│   │       └── googleCalendar.js   ← Integración Google Calendar API
│   ├── capacitor.config.ts     ← Config Capacitor para APK Android
│   ├── .env.production.example ← Template para VITE_API_URL (build Android)
│   ├── vite.config.js          ← Proxy /api → localhost:3001
│   └── package.json
├── backend/
│   ├── server.js               ← API Express con Supabase
│   ├── .env                    ← SUPABASE_URL + SUPABASE_SERVICE_KEY (NO commitear)
│   ├── .env.example            ← Template de variables de entorno
│   └── package.json
├── .env                        ← GITHUB_TOKEN + GITHUB_REPO (NO commitear, en raíz)
├── contexto/
│   └── gastos 2026.xlsx        ← Planilla original (referencia, ya migrada a Supabase)
├── .gitignore
└── CLAUDE.md                   ← Este archivo
```

---

## Arranque del proyecto

```bash
# Prerequisito: crear backend/.env con SUPABASE_URL y SUPABASE_SERVICE_KEY

# Terminal 1 — Backend
cd backend
npm install      # primera vez
node server.js   # corre en http://localhost:3001

# Terminal 2 — Frontend
cd app
npm run dev      # corre en http://localhost:5173 con proxy a :3001
```

---

## Backend — `backend/server.js`

### Base de datos Supabase

- Usa `@supabase/supabase-js` con `SUPABASE_SERVICE_KEY` (service_role key — acceso total, sin RLS)
- **IMPORTANTE**: usar la key `service_role` (JWT largo que empieza con `eyJ...`), NO la `anon`/`publishable` (empieza con `sb_publishable_...`)
- Lee tablas `servicios` y `vencimientos` de Supabase PostgreSQL
- En producción (`NODE_ENV=production`) también sirve el frontend estático desde `app/dist/`
- Requiere `backend/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/servicios` | Lista de servicios agrupados con vencimientos |
| GET | `/api/vencimientos` | Todos los vencimientos |
| GET | `/api/vencimientos/pendientes` | Solo pendientes (estado ≠ "S") |
| POST | `/api/vencimientos` | Crear nuevo vencimiento |
| PATCH | `/api/vencimientos/pagar` | Marcar como pagado (body: `{id, fechaPago, monto?}`) |
| PATCH | `/api/vencimientos/actualizar` | Actualiza monto/fecha/comentarios (body: `{id, monto?, fechaVencimiento?, comentarios?}`) |
| PATCH | `/api/vencimientos/calendar-event` | Guardar calendarEventId (body: `{id, calendarEventId}`) |
| DELETE | `/api/vencimientos/:id` | Eliminar vencimiento |
| POST | `/api/servicios` | Crear nuevo servicio |
| PATCH | `/api/servicios/:nombre` | Editar servicio |
| DELETE | `/api/servicios/:nombre` | Soft-delete (activo=false) |
| GET/PATCH | `/api/config` | Leer/guardar config (googleClientId) en Supabase tabla `app_settings` |

### Mapa de categorías (`CATEGORIAS_MAP`)

```js
"OSDE" → "salud"
"EDESUR" / "METROGAS" / "AYSA" / "MUNICIPAL" → "servicios"
"PERSONAL" / "PERSONAL MOVIL" / "PERSONAL HOGAR" → "telefonia"
"CABLEVISION" → "entretenimiento"
"MONOTRIBUTO (ROCIO)" / "CAJA PREVISION ROCIO" / "ARBA" / "PATENTE DEL AUTO" → "impuestos"
"SEGURO AUTO" / "SEGURO CAJERO" / "SEGURO VIDA" → "seguros"
"TARJETA NATIVA VISA" / "TARJETA NATIVA MASTER" → "tarjetas"
"AYSA MAMA" / "EDESUR MAMA" / "METROGAS MAMA" / "MUNICIPAL MAMA" → "servicios_mama"
"IOMA MAMA" → "salud_mama"
"ARBA MAMA" → "impuestos_mama"
```

---

## Frontend — arquitectura de datos

### Fuente única: API → Supabase

Todos los datos vienen de la API. No hay fusión con localStorage para vencimientos. El frontend llama a la API para toda operación de escritura y recarga los datos con `cargarDatos()` después de cada cambio.

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
| `pagos_gcal_sync` | Map de `"nombre\|fecha"` → `calendarEventId` |
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
- Si no hay pagos → clase `estado-normal`, `esMultiple: true`
- Siempre tienen `esMultiple: true` en el objeto de estado

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

```jsx
<VencimientoForm
  servicio={servicio}
  modoRegistroPago={bool}   // false=nuevo, true=registrar pago
  modoEditar={bool}         // true=editar vencimiento existente
  initialValues={{ fecha, monto, notas }}
  onGuardar={fn}
  onCerrar={fn}
/>
```

### 8. Editar vencimiento (✏️)

- Botón ✏️ disponible en el dashboard (ResumenPage) y en ServiceCard (vista expandida > Pendientes)
- Solo aparece si el vencimiento tiene `id` (no es de Excel)
- Abre `VencimientoForm` en modo `modoEditar=true`, pre-cargando fecha y monto
- Guarda via `PATCH /api/vencimientos/actualizar`

En App.jsx:
```js
const [modalEditar, setModalEditar] = useState(null); // { servicio, vencimiento, initialValues }

function handleEditarVencimiento(servicio, vencimiento) { ... }
async function handleGuardarEdicion(datos) { 
  await apiPatch(API + '/vencimientos/actualizar', { id, monto, fechaVencimiento, comentarios });
}
```

### 9. Ocultar/restaurar servicios

- `handleOcultarServicio(nombre)` → agrega a `ocultos` en localStorage
- `handleMostrarServicio(nombre)` → lo quita
- Servicios ocultos no aparecen en Dashboard ni en lista principal

### 10. Google Calendar

- Client ID hardcodeado como default: `987611899031-7d8qbnul2e7u5mah6isvlt9mrii1c4al.apps.googleusercontent.com`
- Se persiste en Supabase tabla `app_settings` para sincronizar entre dispositivos
- Botón "Sincronizar" deduplica eventos antes de crear nuevos
- Servicios en `SERVICIOS_SIN_CALENDAR` nunca crean eventos

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

## Deploy y Android

### Railway
- URL: `https://pago-servicios-production.up.railway.app`
- Build command: `cd app && npm install && npm run build && cd ../backend && npm install`
- Start command: `cd backend && node server.js`
- Variables de entorno: `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- El backend sirve el frontend estático en producción
- Free tier: $5 crédito/mes, el servicio NO duerme

### APK Android (Capacitor)
- Proyecto Android en `app/android/`
- App ID: `com.pagodeservicios.app`
- Para buildear: crear `app/.env.production` con `VITE_API_URL=https://pago-servicios-production.up.railway.app`
- Comandos: `npm run build` → `npx cap sync android` → Android Studio → Build APK

---

## Workflow GitHub — REGLA OBLIGATORIA

**Los archivos locales son siempre la fuente de verdad.** Nunca usar los archivos del clone de GitHub para sobrescribir los locales.

```bash
# Token en .env de la RAÍZ del proyecto (no en backend/.env)
TOKEN=$(grep GITHUB_TOKEN /ruta/local/.env | cut -d= -f2 | tr -d ' \r\n')

rm -rf /tmp/repo-sync
git clone "https://${TOKEN}@github.com/lacruzs-cyber/pago-servicios.git" /tmp/repo-sync
git config user.email "lacruzs@gmail.com"
git config user.name "Sebastian"

# Comparar ANTES de copiar
diff /local/archivo /tmp/repo-sync/archivo

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

Railway redeploya automáticamente con cada push.

---

## Consideraciones técnicas CRÍTICAS

### Truncación de archivos JSX en Windows mount

**PROBLEMA**: La herramienta `Write` trunca archivos >~3600 bytes en el mount de Windows (`D:\Desarrollo\...`). Los archivos quedan cortados sin error visible, causando fallos de build silenciosos en Railway.

**SÍNTOMA**: `wc -l archivo.jsx` muestra menos líneas de las esperadas; el archivo termina a mitad de un bloque JSX.

**SOLUCIÓN OBLIGATORIA** para archivos JSX grandes:
1. Nunca usar `Write` directo para archivos >3600 bytes en el mount Windows
2. Usar scripts Python para generar/modificar archivos:
   ```python
   with open('/sessions/.../mnt/Pago de Servicios/app/src/...jsx', 'w', encoding='utf-8') as f:
       f.write(content)
   ```
3. Para ediciones pequeñas: usar la herramienta `Edit` (solo envía el diff, no trunca)
4. Siempre verificar con `wc -l` y `tail -5` después de escribir
5. Hacer `npm run build` en el clone antes de pushear

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

### Supabase service_role key
- La key en `backend/.env` debe ser la `service_role` (JWT largo que empieza con `eyJ...`)
- NO usar la key `anon`/`publishable` (empieza con `sb_publishable_...`)
- Se obtiene en: Supabase → Project Settings → API → Project API keys → service_role

### Proxy Vite
- `vite.config.js` tiene `proxy: { '/api': 'http://localhost:3001' }`
- El frontend usa: `const API = (import.meta.env.VITE_API_URL || '') + '/api'`
