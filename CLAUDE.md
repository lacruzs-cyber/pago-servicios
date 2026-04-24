# Pago de Servicios — Instrucciones del Proyecto

## Descripción general

Aplicación web + Android para administrar el vencimiento y pago de servicios del hogar.  
Stack: **React 19 + Vite** (frontend) + **Node.js/Express** (backend) + **Supabase PostgreSQL** (base de datos).  
El backend lee/escribe datos en Supabase (reemplazó al Excel original con SheetJS).  
La app puede instalarse como **APK Android** usando Capacitor.  
El deploy se hace en **Render.com** (gratis).

---

## Estructura de carpetas

```
Pago de Servicios/
├── supabase/
│   ├── schema.sql              ← Schema PostgreSQL + seed de servicios (ejecutar en Supabase SQL Editor)
│   ├── migrate-excel.js        ← Script de migración Excel → Supabase (ejecutar una sola vez)
│   └── package.json            ← deps: @supabase/supabase-js, xlsx, dotenv
├── app/                        ← Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx             ← Componente raíz, toda la lógica de estado
│   │   ├── App.css             ← Estilos globales
│   │   ├── components/
│   │   │   ├── Dashboard.jsx       ← Tab "Próximos vencimientos"
│   │   │   ├── ServiceList.jsx     ← Tab "Mis servicios" (lista + sección Mamá)
│   │   │   ├── ServiceCard.jsx     ← Tarjeta individual de cada servicio
│   │   │   ├── ServiceForm.jsx     ← Modal alta/edición de servicio
│   │   │   ├── VencimientoForm.jsx ← Modal nuevo vencimiento / registrar pago
│   │   │   ├── ConfigModal.jsx     ← Modal configuración Google Calendar
│   │   │   └── Modal.jsx           ← Wrapper de modal genérico
│   │   ├── data/
│   │   │   └── serviciosIniciales.js  ← Catálogo de servicios + CATEGORIAS
│   │   └── utils/
│   │       ├── storage.js          ← Persistencia localStorage (config, ocultos, gcal)
│   │       ├── dateUtils.js        ← Formateo fechas y etiquetas urgencia
│   │       └── googleCalendar.js   ← Integración Google Calendar API
│   ├── capacitor.config.ts     ← Config Capacitor para APK Android
│   ├── .env.production.example ← Template para VITE_API_URL (build Android)
│   ├── vite.config.js          ← Proxy /api → localhost:3001
│   └── package.json
├── backend/
│   ├── server.js               ← API Express con Supabase
│   ├── .env.example            ← Template de variables de entorno
│   └── package.json
├── contexto/
│   └── gastos 2026.xlsx        ← Planilla original (referencia, ya migrada a Supabase)
├── render.yaml                 ← Configuración de deploy en Render.com
├── .gitignore                  ← Excluye .env, dist/, *.xlsx
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
- **IMPORTANTE**: usar la key `service_role` (empieza con `eyJ...`), NO la `anon`/`publishable`
- Lee tablas `servicios` y `vencimientos` de Supabase PostgreSQL
- En producción (`NODE_ENV=production`) también sirve el frontend estático desde `app/dist/`
- Requiere `backend/.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/servicios` | Lista de servicios agrupados con vencimientos |
| GET | `/api/vencimientos` | Todos los vencimientos |
| GET | `/api/vencimientos/pendientes` | Solo pendientes (estado ≠ "S") |
| POST | `/api/vencimientos` | Crear nuevo vencimiento (body: `{servicioNombre, fecha, monto, notas, pagado?, esAutoGenerado?}`) |
| PATCH | `/api/vencimientos/pagar` | Marcar como pagado (body: `{id, fechaPago, monto?}`) |
| PATCH | `/api/vencimientos/actualizar` | Actualiza monto/fecha/comentarios (body: `{id, monto?, fechaVencimiento?, comentarios?}`) |
| DELETE | `/api/vencimientos/:id` | Eliminar vencimiento |
| POST | `/api/servicios` | Crear nuevo servicio |
| PATCH | `/api/servicios/:nombre` | Editar servicio |
| DELETE | `/api/servicios/:nombre` | Soft-delete (activo=false) |

### Cálculo de mes/año al insertar

El endpoint `POST /api/vencimientos` calcula automáticamente `mes` (ej: `"ABRIL"`) y `anio` (ej: `2026`) desde el campo `fecha` usando el array `MESES_ES`.

### IDs de vencimientos

Todos los vencimientos (migrados del Excel o creados manualmente) usan **UUID** de Supabase.

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

Todos los datos vienen de la API (Supabase). No hay fusión con localStorage para vencimientos. El frontend llama a la API para toda operación de escritura y recarga los datos con `cargarDatos()` después de cada cambio.

### Normalización en `ServiceCard` (`norm(v)`)

Convierte vencimientos de Supabase al formato interno:
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

> `pagos_servicios` ya no se usa. Los vencimientos manuales se guardan en Supabase.

---

## Funcionalidades implementadas

### 1. Dashboard (tab "Próximos vencimientos")
- Muestra todos los servicios visibles con vencimientos pendientes
- Ordena por urgencia: vencidos → hoy → urgentes → próximos
- Permite marcar como pagado directamente

### 2. Lista de servicios (tab "Mis servicios")
- Filtro por nombre y categoría
- Servicios agrupados por categoría
- Cada tarjeta es expandible (muestra historial pagados)

### 3. Servicios Mamá — sección colapsable
- Todos los servicios con `"MAMA"` en el nombre van a la sección especial
- Header con gradiente teal, badge de pendientes, toggle colapsar
- Hint: "Vencen el día 10 de cada mes"
- Detección: `nombre.toUpperCase().includes('MAMA')`

### 4. Auto-generación de vencimientos Mamá
- Se ejecuta en `cargarDatos()` al inicio de cada sesión vía `autoGenerarMama()`
- Hace `POST /api/vencimientos` para crear el vencimiento del día 10 en Supabase
- Flag `mama_gen_YYYY_MM` en localStorage evita llamadas duplicadas
- Para re-testear: borrar `mama_gen_2026_04` de localStorage (DevTools → Application)

### 5. Ocultar/restaurar servicios
- `handleOcultarServicio(nombre)`: agrega nombre al array `ocultos` en localStorage
- `handleMostrarServicio(nombre)`: lo quita
- Servicios ocultos no aparecen en Dashboard ni en lista principal
- En tab "Mis servicios", un link muestra la sección de servicios ocultos

### 6. Registrar pago (con monto) — `handleGuardarRegistroPago`
- Abre `VencimientoForm` en modo `modoRegistroPago={true}`
- Si viene con `_vencimientoId`: hace `PATCH /api/vencimientos/pagar` con monto y fechaPago
- Si no tiene `_vencimientoId`: busca cualquier vencimiento pendiente del mismo mes (`estado !== 'S'`) y lo actualiza; si no hay ninguno, crea uno nuevo con `POST /api/vencimientos`
- Toast muestra el monto: `"✅ Pago registrado — $1.032.963"`

### 7. Marcar pagado — `handleMarcarPagado`
- Siempre usa `PATCH /api/vencimientos/pagar` → actualiza en Supabase
- Luego recarga datos con `cargarDatos()`

### 8. Fechas pasadas permitidas
- `VencimientoForm` no tiene validación de fecha mínima
- Permite registrar vencimientos y pagos con fechas anteriores a hoy

### 9. Integración Google Calendar
- Configurar con Google Client ID via modal ⚙️
- Al guardar vencimiento: crea evento en Calendar si está conectado
- Botón "Sincronizar": crea eventos para todos los pendientes futuros sin evento
- Al marcar pagado: marca evento como completado

---

## Lógica del botón en tarjeta colapsada

```jsx
// Si el vencimiento próximo tiene monto → botón directo (ya sabemos cuánto es)
if (proximo._monto) {
  // → "✅ Marcar como pagado" (sin formulario)
} else {
  // → "✅ Registrar pago (ingresá monto)" → abre VencimientoForm con _vencimientoId
}
```

---

## `VencimientoForm` — props

```jsx
<VencimientoForm
  servicio={servicio}           // objeto servicio (puede incluir _vencimientoId, _fechaVenc)
  modoRegistroPago={true|false} // false = nuevo vencimiento, true = registrar pago
  onGuardar={fn}                // recibe { fecha, monto, notas, pagado?, fechaPago? }
  onCerrar={fn}
/>
```

En `modoRegistroPago`:
- Fecha inicial = hoy (`fechaHoy()`)
- Título: "Registrar pago — {nombre}"
- `onGuardar` agrega `{ pagado: true, fechaPago: form.fecha }`

---

## CATEGORIAS — `src/data/serviciosIniciales.js`

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

### Render.com
- Build command: `cd app && npm install && npm run build && cd ../backend && npm install`
- Start command: `cd backend && node server.js`
- Variables de entorno: `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- El backend sirve el frontend estático en producción (no hace falta hosting separado)
- Free tier: el servicio duerme a los 15 min sin tráfico, tarda ~30 seg en despertar

### APK Android (Capacitor)
- Proyecto Android en `app/android/` (generado con `npx cap add android`)
- App ID: `com.pagodeservicios.app`
- Para buildear: crear `app/.env.production` con `VITE_API_URL=https://TU-APP.onrender.com`
- Comandos: `npm run build` → `npx cap sync android` → abrir en Android Studio → Build APK
- Ver `INSTRUCCIONES_DEPLOY.md` para pasos completos

### API URL dinámica (frontend)
```js
// Dev: proxy vite (/api → localhost:3001)
// Android: URL completa del backend en Render
const API = (import.meta.env.VITE_API_URL || '') + '/api';
```

### Migración Excel → Supabase
- Script único: `cd supabase && npm install && node migrate-excel.js`
- Lee `contexto/gastos 2026.xlsx` e inserta todos los vencimientos en Supabase
- Auto-inserta servicios del Excel que no existen en la tabla `servicios`
- Solo se ejecuta una vez (no hace deduplicación)

---

## Consideraciones técnicas importantes

### Escritura de archivos JSX en este entorno
- El carácter `!` en bash causa problemas de expansión → **nunca usar heredoc bash para JSX**
- Los archivos JSX con `!` se generan con scripts Python en `/outputs/`, luego se ejecutan con `python3 gen_script.py`
- Los emojis en Python deben usar `\U0001FXXX` (8 dígitos, mayúscula), NO surrogate pairs `\ud83d\uXXXX`, NO notación JS `\u{1F4B3}`
- La herramienta Write trunca archivos >~3600 bytes en el mount de Windows → usar gen scripts Python para archivos grandes

### Supabase service_role key
- La key en `backend/.env` debe ser la `service_role` (JWT largo que empieza con `eyJ...`)
- Se obtiene en Supabase → Project Settings → API → Project API keys → service_role
- NO usar la key `anon`/`publishable` (empieza con `sb_publishable_...`)

### Proxy Vite
- `vite.config.js` tiene `proxy: { '/api': 'http://localhost:3001' }`
- El frontend usa simplemente `(import.meta.env.VITE_API_URL || '') + '/api'`

---

## Servicios registrados

### Propios
OSDE, EDESUR, METROGAS, AYSA, MUNICIPAL, CABLEVISION, PERSONAL, PERSONAL HOGAR, MONOTRIBUTO (ROCIO), CAJA PREVISION ROCIO, ARBA, PATENTE DEL AUTO, SEGURO AUTO, SEGURO CAJERO, SEGURO VIDA, TARJETA NATIVA VISA, TARJETA NATIVA MASTER

### Mamá (vencen el día 10, se auto-generan en Supabase al inicio del mes)
AYSA MAMA, EDESUR MAMA, METROGAS MAMA, IOMA MAMA, MUNICIPAL MAMA, ARBA MAMA
