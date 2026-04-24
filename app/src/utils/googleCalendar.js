// Integración con Google Calendar API
// Requiere CLIENT_ID configurado en la app

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let onReadyCallback = null;

export function initGoogleAPI(clientId, onReady) {
  onReadyCallback = onReady;

  // Inicializar GAPI client
  if (window.gapi) {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeReady();
      } catch (err) {
        console.error('Error inicializando GAPI:', err);
      }
    });
  }

  // Inicializar Google Identity Services
  const waitForGIS = setInterval(() => {
    if (window.google?.accounts?.oauth2) {
      clearInterval(waitForGIS);
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: '',
      });
      gisInited = true;
      maybeReady();
    }
  }, 100);
}

function maybeReady() {
  if (gapiInited && gisInited && onReadyCallback) {
    onReadyCallback();
  }
}

export function isSignedIn() {
  return !!(window.gapi?.client?.getToken());
}

export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API no inicializada'));
      return;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(resp);
        return;
      }
      resolve(true);
    };
    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

export function signOut() {
  const token = window.gapi?.client?.getToken();
  if (token !== null && token !== undefined) {
    window.google.accounts.oauth2.revoke(token.access_token, () => {});
    window.gapi.client.setToken('');
  }
}

export async function createCalendarEvent(servicio, fechaVencimiento, monto, notas) {
  const token = window.gapi?.client?.getToken();
  if (!token) throw new Error('No autenticado con Google');

  const dateStr = fechaVencimiento; // formato YYYY-MM-DD

  // Calcular fecha de fin (mismo día = evento de día completo)
  const fechaFin = new Date(dateStr + 'T12:00:00');
  fechaFin.setDate(fechaFin.getDate() + 1);
  const dateFin = fechaFin.toISOString().split('T')[0];

  const descripcion = [
    `📋 Servicio: ${servicio}`,
    monto ? `💵 Monto: $${Number(monto).toLocaleString('es-AR')}` : '',
    notas ? `📝 Notas: ${notas}` : '',
    '',
    '→ Abrí la app "Pago de Servicios" para marcarlo como pagado.',
  ].filter(Boolean).join('\n');

  const event = {
    summary: `💳 Vencimiento: ${servicio}`,
    description: descripcion,
    start: {
      date: dateStr,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    end: {
      date: dateFin,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    colorId: '11', // rojo tomate
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 2 * 24 * 60 },  // 2 días antes
        { method: 'email', minutes: 2 * 24 * 60 },  // 2 días antes por email
        { method: 'popup', minutes: 60 },            // 1 hora antes del día
      ],
    },
  };

  const response = await window.gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });

  return response.result.id;
}

export async function marcarEventoPagado(calendarEventId, servicio) {
  const token = window.gapi?.client?.getToken();
  if (!token || !calendarEventId) return;

  await window.gapi.client.calendar.events.patch({
    calendarId: 'primary',
    eventId: calendarEventId,
    resource: {
      summary: `✅ Pagado: ${servicio}`,
      colorId: '2', // verde salvia
    },
  });
}

export async function eliminarCalendarEvent(calendarEventId) {
  const token = window.gapi?.client?.getToken();
  if (!token || !calendarEventId) return;

  try {
    await window.gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: calendarEventId,
    });
  } catch (err) {
    // El evento puede ya no existir
    console.warn('No se pudo eliminar evento del calendario:', err);
  }
}
