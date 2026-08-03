# Pago de Servicios — Cómo correr la app en tu PC

La app corre 100% local: React + Express + SQLite, todo en tu máquina. No usa
Supabase ni Vercel ni ningún servicio en la nube. El código se sigue subiendo a
GitHub como respaldo, pero de ahí no se publica ni se despliega a ningún lado.

---

## Primera vez

### 1. Cargar los datos existentes (una sola vez)

El proyecto de Supabase de Sebastian quedó inaccesible (se pausó o se borró)
antes de poder migrar desde ahí, así que la carga inicial se hace desde
`contexto/gastos 2026.xlsx` (la planilla original). Le va a faltar lo que se
cargó a mano en la app entre abril y agosto de 2026 — eso no se pudo
recuperar.

```bash
cd supabase
npm install
node migrate-excel-to-sqlite.js
```

Si en algún momento se recupera el acceso a Supabase (por ejemplo si el
proyecto solo estaba pausado, no borrado), usar en cambio
`node migrate-to-sqlite.js` — trae todo lo que había ahí, que es más completo
que el Excel.

### 2. Instalar y compilar

Doble clic en **`iniciar-app.bat`** (carpeta raíz del proyecto). La primera vez
instala las dependencias y compila el frontend — puede tardar unos minutos.
Después abre solo el navegador en `http://localhost:4000`.

También podés hacerlo a mano:

```bash
npm run setup   # instala backend + frontend, y compila
npm start       # levanta el servidor en localhost:4000
```

---

## Uso diario

Doble clic en **`iniciar-app.bat`**. Se abre el navegador solo. Para apagar la
app, cerrá la ventana negra (la consola del servidor).

---

## Google Calendar

La integración con Google Calendar es del lado del navegador (no pasa por el
servidor), así que sigue funcionando igual que antes. Si el Client ID de
Google que tenías configurado tiene restringido el origen autorizado a tu URL
vieja (Vercel), agregale también `http://localhost:4000`:

1. https://console.cloud.google.com → tu proyecto → **APIs y Servicios → Credenciales**
2. Editar el ID de cliente OAuth 2.0 que usás
3. En **Orígenes de JavaScript autorizados**, agregar `http://localhost:4000`
4. Guardar

---

## Cuando hacés cambios al código

Si querés que Claude (u otra persona) siga modificando la app, cada cambio se
sigue subiendo a GitHub como respaldo con `git push`, pero **no dispara ningún
deploy** — no hay ningún servicio escuchando ese push. Podés usar
`deploy.bat` para subir cambios a mano (commit + push), o pedirle a Claude
que lo haga.

---

## Android (opcional, sin cambios)

Si en algún momento querés volver a generar el APK, tené en cuenta que el
teléfono necesitaría llegar a la IP local de tu PC en la red de tu casa
(ej: `http://192.168.0.10:4000`), no a `localhost`. Ver
`app/.env.production.example` para más detalle. Esto no está resuelto todavía,
es un paso a futuro si lo necesitás.
