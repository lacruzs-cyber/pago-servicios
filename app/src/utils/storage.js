// Persistencia en localStorage

const KEY_SERVICIOS = 'pagos_servicios';
const KEY_CONFIG = 'pagos_config';
const KEY_OCULTOS = 'pagos_ocultos';
const KEY_GCAL_SYNC = 'pagos_gcal_sync';

export function cargarGcalSync() {
  try {
    const raw = localStorage.getItem(KEY_GCAL_SYNC);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function guardarGcalSync(map) {
  localStorage.setItem(KEY_GCAL_SYNC, JSON.stringify(map));
}

export function cargarServicios() {
  try {
    const raw = localStorage.getItem(KEY_SERVICIOS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function guardarServicios(servicios) {
  localStorage.setItem(KEY_SERVICIOS, JSON.stringify(servicios));
}

export function cargarConfig() {
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function guardarConfig(config) {
  localStorage.setItem(KEY_CONFIG, JSON.stringify(config));
}

export function cargarOcultos() {
  try {
    const raw = localStorage.getItem(KEY_OCULTOS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function guardarOcultos(ocultos) {
  localStorage.setItem(KEY_OCULTOS, JSON.stringify(ocultos));
}
