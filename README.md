# Pago de Servicios

App React para administrar vencimientos de servicios mensuales con recordatorios via Google Calendar.

---

## Arrancar la app

Abrir una terminal en la carpeta `app` y ejecutar:

```
npm install
npm run dev
```

Luego abrir el navegador en: http://localhost:5173

---

## Configurar Google Calendar (para recibir notificaciones en el celular)

### Paso 1 - Crear credenciales

1. Ir a https://console.cloud.google.com
2. Crear un proyecto nuevo (ej: "Pago Servicios")
3. **APIs y Servicios > Biblioteca** -> buscar "Google Calendar API" -> Habilitar
4. **APIs y Servicios > Credenciales** -> + Crear credenciales -> ID de cliente OAuth 2.0
5. Tipo: **Aplicacion web**
6. Origenes JavaScript autorizados: agregar `http://localhost:5173`
7. Copiar el **Client ID** generado

### Paso 2 - Conectar en la app

1. Abrir http://localhost:5173
2. Clic en **"Configurar Google Calendar"** (arriba a la derecha)
3. Pegar el Client ID
4. Clic en Guardar -> se abre popup de Google -> autorizar con tu cuenta

### Como funciona el recordatorio en el celular

Cada vez que cargas un vencimiento, la app crea automaticamente un evento en Google Calendar con:
- Recordatorio popup **2 dias antes** del vencimiento
- Recordatorio email **2 dias antes**
- Recordatorio popup **1 hora antes** del dia
- Descripcion: "Abrir app Pago de Servicios para marcar como pagado"

Para recibir la notificacion push en el celular, Google Calendar debe estar instalado y con notificaciones activadas.

---

## Servicios pre-cargados desde tus planillas

Detectados en gastos 2025/2026 con dia estimado basado en historial de pagos:

| Servicio             | Categoria       | Dia estimado |
|----------------------|-----------------|--------------|
| OSDE                 | Salud           | dia 2        |
| EDESUR               | Servicios       | dia 2        |
| METROGAS             | Servicios       | dia 2        |
| AYSA                 | Servicios       | dia 8        |
| MUNICIPAL            | Servicios       | dia 8        |
| MONOTRIBUTO (ROCIO)  | Impuestos       | dia 8        |
| CAJA PREVISION ROCIO | Impuestos       | dia 8        |
| ARBA                 | Impuestos       | dia 7        |
| PERSONAL             | Telefonia       | dia 6        |
| PERSONAL HOGAR       | Telefonia       | dia 13       |
| CABLEVISION          | Entretenimiento | dia 13       |
| PATENTE DEL AUTO     | Impuestos       | dia 14       |
| SEGURO AUTO          | Seguros         | -            |
| SEGURO CAJERO        | Seguros         | -            |
| SEGURO VIDA          | Seguros         | -            |
| TARJETA NATIVA VISA  | Tarjetas        | -            |
| TARJETA NATIVA MASTER| Tarjetas        | -            |
| AYSA MAMA            | Servicios mama  | -            |
| EDESUR MAMA          | Servicios mama  | -            |
| METROGAS MAMA        | Servicios mama  | -            |
| IOMA MAMA            | Salud mama      | -            |
| MUNICIPAL MAMA       | Servicios mama  | -            |
| ARBA MAMA            | Impuestos mama  | -            |

El dia estimado es solo una leyenda de referencia. La fecha real de vencimiento siempre se carga a mano.

---

## Estructura del proyecto

```
app/
  src/
    App.jsx                      # Componente raiz, logica principal
    App.css                      # Todos los estilos
    components/
      Dashboard.jsx              # Vista proximos vencimientos (30 dias)
      ServiceList.jsx            # Lista completa con busqueda y filtros
      ServiceCard.jsx            # Tarjeta de servicio expandible
      ServiceForm.jsx            # Modal agregar/editar servicio
      VencimientoForm.jsx        # Modal agregar vencimiento con fecha estimada
      ConfigModal.jsx            # Configuracion Google Calendar (con guia paso a paso)
      Modal.jsx                  # Wrapper modal reutilizable
    data/
      serviciosIniciales.js      # 23 servicios pre-cargados desde planillas
    utils/
      dateUtils.js               # Helpers de fecha y calculo de urgencia
      googleCalendar.js          # Integracion Google Calendar API (OAuth2)
      storage.js                 # Persistencia localStorage
```
