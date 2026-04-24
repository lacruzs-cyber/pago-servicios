# Pago de Servicios — Guia de Deploy Completa

> Estas instrucciones te llevan desde cero hasta tener la app corriendo en la nube
> y el APK instalado en tu celular.

---

## FASE 1 — Base de datos en Supabase (gratis)

### 1.1 Crear cuenta y proyecto

1. Ir a **https://supabase.com** → Sign Up (con GitHub o email)
2. Click en **New Project**
3. Nombre: `pago-servicios`
4. Password: elegir una (guardala)
5. Region: elegir la mas cercana (ej: `South America (Sao Paulo)`)
6. Click **Create new project** — esperar ~2 minutos

### 1.2 Crear las tablas

1. En el panel izquierdo ir a **SQL Editor**
2. Click en **New query**
3. Copiar y pegar el contenido completo de `supabase/schema.sql`
4. Click **Run** (o Ctrl+Enter)
5. Verificar que diga `Success. No rows returned`

### 1.3 Obtener las credenciales

1. Ir a **Project Settings** (icono de engranaje) → **API**
2. Copiar:
   - **Project URL** → es tu `SUPABASE_URL`
   - **service_role** key (no la anon key) → es tu `SUPABASE_SERVICE_KEY`

> IMPORTANTE: la service_role key tiene acceso total. No la expongas en el frontend.

### 1.4 Crear el archivo .env del backend

En la carpeta `backend/`, crear el archivo `.env` (copiar desde `.env.example`):

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
```

### 1.5 Migrar los datos del Excel a Supabase

Este paso importa todos los vencimientos existentes del Excel a la base de datos.

```bash
cd supabase
npm install
node migrate-excel.js
```

Deberia mostrar algo como:
```
Iniciando migracion Excel -> Supabase...
Anio 2025: 0 vencimientos insertados (archivo no existe)
Anio 2026: 142 vencimientos insertados de 142
Migracion completa: 142 vencimientos en total.
```

Para verificar: ir a Supabase → **Table Editor** → tabla `vencimientos`

---

## FASE 2 — Instalar las dependencias del backend actualizado

El backend ahora usa Supabase en lugar de Excel. Instalar las nuevas dependencias:

```bash
cd backend
npm install
```

### Probar localmente antes del deploy

```bash
# Terminal 1
cd backend
node server.js

# Terminal 2
cd app
npm run dev
```

Abrir http://localhost:5173 y verificar que la app carga los datos desde Supabase.

---

## FASE 3 — Deploy en Render.com (gratis)

### 3.1 Crear cuenta

1. Ir a **https://render.com** → Sign Up (con GitHub recomendado)

### 3.2 Subir el codigo a GitHub

El proyecto necesita estar en un repositorio de GitHub para hacer deploy desde Render.

```bash
# En la carpeta raiz del proyecto (Pago de Servicios/)
git init
git add .
git commit -m "Initial commit"
```

Crear un repositorio en https://github.com/new (nombre: `pago-servicios`, privado OK)

```bash
git remote add origin https://github.com/TU-USUARIO/pago-servicios.git
git push -u origin main
```

> El .gitignore ya excluye los archivos .env y el Excel (datos sensibles).

### 3.3 Crear el Web Service en Render

1. En Render → **New** → **Web Service**
2. Conectar con GitHub → seleccionar el repositorio `pago-servicios`
3. Configurar:
   - **Name**: `pago-servicios`
   - **Branch**: `main`
   - **Root Directory**: dejar vacio
   - **Runtime**: `Node`
   - **Build Command**: `cd app && npm install && npm run build && cd ../backend && npm install`
   - **Start Command**: `cd backend && node server.js`
4. En **Environment Variables**, agregar:
   - `NODE_ENV` = `production`
   - `SUPABASE_URL` = (tu URL de Supabase)
   - `SUPABASE_SERVICE_KEY` = (tu service_role key)
5. Click **Create Web Service**

El deploy tarda ~3-5 minutos. Al finalizar te da una URL tipo:
`https://pago-servicios.onrender.com`

### 3.4 Verificar el deploy

Abrir en el navegador: `https://pago-servicios.onrender.com`

La app deberia cargar completamente. Si ves "Service unavailable", esperar 30 segundos
(el free tier duerme despues de 15 min de inactividad).

---

## FASE 4 — APK Android con Android Studio

### 4.1 Instalar Android Studio

Descargar desde: https://developer.android.com/studio
Instalar con la configuracion por defecto (incluye Android SDK).

### 4.2 Configurar la URL de produccion para el APK

Crear el archivo `app/.env.production` (copiar desde `.env.production.example`):

```
VITE_API_URL=https://pago-servicios.onrender.com
```

Reemplazar la URL con la real de tu deploy en Render.

### 4.3 Buildear y sincronizar

```bash
cd app
# Build con la URL de produccion
npm run build

# Sincronizar con el proyecto Android
npx cap sync android
```

### 4.4 Abrir en Android Studio

```bash
npx cap open android
```

Esto abre Android Studio con el proyecto.

### 4.5 Generar el APK

En Android Studio:
1. Menu **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Esperar el build (~2-3 minutos)
3. Click en la notificacion **"APK(s) generated"** → **locate**
4. El APK esta en: `app/android/app/build/outputs/apk/debug/app-debug.apk`

### 4.6 Instalar en el celular

**Opcion A — Cable USB:**
1. Conectar el celular con cable USB
2. Habilitar **Depuracion USB** en el celular (Ajustes → Info del dispositivo → tocar 7 veces numero de compilacion → Developer options → USB debugging)
3. En Android Studio: click en el boton **Run** (triangulo verde) → seleccionar tu dispositivo

**Opcion B — Copiar el APK:**
1. Copiar el archivo `app-debug.apk` al celular (por cable, Google Drive, WhatsApp, etc.)
2. En el celular, abrir el archivo APK
3. Aceptar instalar de fuentes desconocidas si se pide
4. La app aparece en el launcher del celular

---

## RESUMEN DE COMANDOS

```bash
# Arrancar en modo desarrollo (PC con Excel/Supabase)
cd backend && node server.js         # terminal 1
cd app && npm run dev                # terminal 2

# Build para produccion / Android
cd app && npm run build && npx cap sync android

# Migrar datos Excel a Supabase (una sola vez)
cd supabase && node migrate-excel.js
```

---

## NOTAS IMPORTANTES

- **Free tier de Render**: el backend duerme despues de 15 min sin trafico.
  El primer request despues de dormir tarda ~30 segundos. Es normal.

- **Supabase free tier**: 500 MB de base de datos, 2 GB de transferencia por mes.
  Mas que suficiente para uso personal.

- **Actualizaciones**: cuando hagas cambios al codigo, hacer `git push` y Render
  redeploya automaticamente.

- **APK nueva version**: cada vez que quieras actualizar la app en el celular,
  repetir los pasos 4.3 a 4.6.