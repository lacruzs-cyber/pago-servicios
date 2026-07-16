# Pago de Servicios — Instrucciones del Proyecto

## Descripción general

Aplicación web + Android para administrar el vencimiento y pago de servicios del hogar.  
Stack: **React 19 + Vite** (frontend) + **Supabase PostgreSQL** (base de datos).  
El frontend llama a Supabase directamente (sin backend Express).  
La app puede instalarse como **APK Android** usando Capacitor.  
El deploy se hace en **Vercel** (gratuito, sin sleep).

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
│   │   ├── lib/
│   │   │   ├── supabase.js         ← Cliente Supabase (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
│   │   │   └── db.js               ← Todas las funciones de BD (reemplaza Express)
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
│   │       └── googleCalendar.js   ← Integración Google Calendar API
│   ├── capacitor.config.ts     ← Config Capacitor para APK Android
│   ├── .env.local              ← Variables locales (NO commitear)
│   ├── .env.production.example ← Template para build Android
│   ├── vercel.json             ← Config Vercel (SPA routing)
│   └── vite.config.js          ← Configuración Vite
├── backend/                    ← (OBSOLETO - ya no se usa, conservado por referencia)
├── .env                        ← GITHUB_TOKEN + GITHUB_REPO (NO commitear, en raíz)
├── contexto/
│   └── gastos 2026.xlsx        ← Planilla original (referencia, ya migrada a Supabase)
├── .gitignore
└── CLAUDE.md                   ← Este archivo
```

---

## Variables de entorno

### Desarrollo local (`app/.env.local` — NO commitear)
```
VITE_SUPABASE_URL=https://himchcizeowsfihxtimj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_jZTQ9QUf5OYdloa_orP4oA_w90ughE8
VITE_APP_PASSWORD=radiohead
```

### Producción Vercel (configurar en el dashboard de Vercel)
```
VITE_SUPABASE_URL=https://himchcizeowsfihxtimj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_jZTQ9QUf5OYdloa_orP4oA_w90ughE8
VITE_APP_PASSWORD=radiohead
```

### Android APK (`app/.env.production`)
```
VITE_SUPABASE_URL=https://himchcizeowsfihxtimj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_jZTQ9QUf5OYdloa_orP4oA_w90ughE8
VITE_APP_PASSWORD=radiohead
```

---

## Arranque del proyecto

```bash
# Solo frontend (ya no hay backend)
cd app
npm install      # primera vez
npm run dev      # corre en http://localhost:5173
```

---

## Supabase — Acceso directo desde el frontend

### Base de datos
- Tablas: `servicios`, `vencimientos`, `app_settings`
- Key usada: `VITE_SUPABASE_ANON_KEY` (publishable key — sáfe para exponer en frontend)
- Si alguna operación falla por permisos, verificar que RLS esté deshabilitado en Supabase o configurar policies para anon role

### `app/src/lib/supabase.js`
```js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### `app/src/lib/db.js` — Funciones exportadas

| Función | Descripción |
|--------|-------------|
| `getServicios()` | Lista servicios activos + vencimientos anidados (fmtVenc) |
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

### Mapeo DB → frontend (`fmtVenc`)
```js
id, anio, mes,
descripcion      ← servicio_nombre
fechaVencimiento ← fecha_vencimiento
fechaPago        ← fecha_pago
monto            ← parseFloat(monto)
estado           ← estado || 'N'
comentarios      ← comentarios
calendarEventId  ← calendar_event_id || null
esManual         ← es_manual
esAutoGenerado   ← es_auto_generado
```

---

## Frontend — arquitectura de datos

### Fuente única: Supabase directo
Todos los datos vienen de Supabase vía `db.js`. El frontend llama a estas funciones para toda operación de escritura y recarga los datos con `cargarDatos()` después de cada cambio.

### Naming en App.jsx
- `config` = estado React (`useState({})`) — setter es `setConfigState` (para evitar conflicto con `setConfig` importada de db.js)
- `saveConfig` = alias de `setConfig` de db.js (guarda en Supabase)
- `dbEliminarVencimiento` = alias de `eliminarVencimiento` de db.js (para no conflicto con la función del handler)

### Login (client-side)
`LoginPage.jsx` compara la contraseña con `VITE_APP_PASSWORD` (default: `'radiohead'`). No requiere backend.

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

## Deploy — Vercel (producción actual)

### Setup inicial en Vercel
1. Ir a [vercel.com](https://vercel.com) → New Project
2. Importar repositorio: `lacruzs-cyber/pago-servicios`
3. **Root Directory**: `app` (importante!)
4. Framework: Vite (auto-detectado)
5. Variables de entorno:
   - `VITE_SUPABASE_URL` = `https://himchcizeowsfihxtimj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_jZTQ9QUf5OYdloa_orP4oA_w90ughE8`
   - `VITE_APP_PASSWORD` = `radiohead`
6. Deploy → Vercel genera una URL tipo `pago-servicios.vercel.app`

### Redeploy automático
Cada `git push origin main` triggeriza un nuevo deploy en Vercel.

### Android APK (Capacitor)
- Proyecto Android en `app/android/`
- App ID: `com.pagodeservicios.app`
- Para buildear: crear `app/.env.production` con las variables de Supabase
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

Vercel redeploya automáticamente con cada push.

---

## Consideraciones técnicas CRÍTICAS

### Truncación de archivos JSX en Windows mount

**PROBLEMA**: La herramienta `Write` trunca archivos >~3600 bytes en el mount de Windows (`D:\Desarrollo\...`). Los archivos quedan cortados sin error visible, causando fallos de build silenciosos en Vercel.

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

### Supabase — key publishable
- La key `sb_publishable_...` es la anon/publishable key (nueva nomenclatura de Supabase)
- Es la misma que la antigua `anon key` — segura para exponer en frontend
- La `service_role` key empieza con `eyJ...` y NO debe estar en el frontend
- Si se necesita la service_role (para operaciones administrativas), usar solo en backend o scripts locales
