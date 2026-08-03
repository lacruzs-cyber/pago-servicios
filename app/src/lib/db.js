// Cliente REST para el backend local (Express + SQLite).
// Reemplaza las llamadas directas a Supabase — la app ahora habla
// solo con http://localhost:PUERTO/api/* servido por backend/server.js.

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch { /* respuesta sin json */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getServicios() {
  return api('/servicios');
}

export async function crearVencimiento({ servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado, calendarEventId }) {
  return api('/vencimientos', {
    method: 'POST',
    body: JSON.stringify({ servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado, calendarEventId }),
  });
}

export async function pagarVencimiento({ id, fechaPago, monto }) {
  return api('/vencimientos/pagar', {
    method: 'PATCH',
    body: JSON.stringify({ id, fechaPago, monto }),
  });
}

export async function actualizarVencimiento({ id, monto, fechaVencimiento, comentarios }) {
  return api('/vencimientos/actualizar', {
    method: 'PATCH',
    body: JSON.stringify({ id, monto, fechaVencimiento, comentarios }),
  });
}

export async function actualizarCalendarEvent({ id, calendarEventId }) {
  return api('/vencimientos/calendar-event', {
    method: 'PATCH',
    body: JSON.stringify({ id, calendarEventId }),
  });
}

export async function eliminarVencimiento(id) {
  return api('/vencimientos/' + id, { method: 'DELETE' });
}

export async function crearServicio({ nombre, categoria, diaEstimado, notas }) {
  return api('/servicios', {
    method: 'POST',
    body: JSON.stringify({ nombre, categoria, diaEstimado, notas }),
  });
}

export async function actualizarServicio(nombre, { categoria, diaEstimado, notas }) {
  return api('/servicios/' + encodeURIComponent(nombre), {
    method: 'PATCH',
    body: JSON.stringify({ categoria, diaEstimado, notas }),
  });
}

export async function eliminarServicio(nombre) {
  return api('/servicios/' + encodeURIComponent(nombre), { method: 'DELETE' });
}

export async function getConfig() {
  return api('/config');
}

export async function setConfig({ googleClientId }) {
  return api('/config', {
    method: 'PATCH',
    body: JSON.stringify({ googleClientId }),
  });
}
