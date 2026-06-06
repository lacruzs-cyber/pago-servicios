// Integración con Google Calendar API
// Requiere CLIENT_ID configurado en la app

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

const KEY_GCAL_AUTH = 'gcal_autorizado';

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
  if (!gapiInited || !gisInited || !onReadyCallback) return;

  // Si el usuario ya autorizó antes, intentar reconectar silenciosamente
  if (localStorage.getItem(KEY_GCAL_AUTH) === '1') {
    tokenClient.callback = (resp) => {
      if (!resp.error) {
        onReadyCallback();
      } else {
        // No se pudo reconectar en silencio (sesión de Google expirada)
        localStorage.removeItem(KEY_GCAL_AUTH);
        onReadyCallback();
      }
    };
    // prompt: '' = sin popup si el usuario ya tiene sesión activa en Google
    tokenClient.requestAccessToken({ prompt: '' });
  } else {
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
      localStorage.setItem(KEY_GCAL_AUTH, '1');
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
  localStorage.removeItem(KEY_GCAL_AUTH);
}

export async function createCalendarEvent(servicio, fechaVencimiento, monto, notas) {
  const token = window.gapi?.client?.getToken();
  if (!token) throw new Error('No autenticado con Google');

  const dateStr = fechaVencimiento; // formato YYYY-MM-DD

  const descripcion = [
    `📋 Servicio: ${servicio}`,
    monto ? `💵 Monto: $${Number(monto).toLocaleString('es-AR')}` : '',
    notas ? `📝 Notas: ${notas}` : '',
    '',
    '→ Abrí la app "Pago de Servicios" para marcarlo como pagado.',
  ].filter(Boolean).join('\n');

  // Evento con hora para poder definir alertas precisas:
  // inicio 10:00 del día de vencimiento, fin 10:30
  const event = {
    summary: `💳 Vencimiento: ${servicio}`,
    description: descripcion,
    start: {
      dateTime: `${dateStr}T10:00:00`,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    end: {
      dateTime: `${dateStr}T10:30:00`,
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    colorId: '11', // rojo tomate
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 0 },    // día del vencimiento a las 10:00
        { method: 'popup', minutes: 840 },  // día anterior a las 20:00 (14hs antes)
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

// Lista eventos de vencimientos en un rango de fechas
export async function listarEventosVencimientos(fechaInicio, fechaFin) {
  const token = window.gapi?.client?.getToken();
  if (!token) throw new Error('No autenticado con Google');

  const response = await window.gapi.client.calendar.events.list({
    calendarId: 'primary',
    timeMin: fechaInicio + 'T00:00:00-03:00',
    timeMax: fechaFin + 'T23:59:59-03:00',
    q: 'Vencimiento:',
    singleEvents: true,
    maxResults: 250,
    orderBy: 'startTime',
  });

  return response.result.items || [];
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
