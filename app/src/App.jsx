import { useState, useEffect, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import ServiceList from './components/ServiceList';
import ServiceForm from './components/ServiceForm';
import VencimientoForm from './components/VencimientoForm';
import ConfigModal from './components/ConfigModal';
import { cargarConfig, guardarConfig, cargarOcultos, guardarOcultos, cargarGcalSync, guardarGcalSync } from './utils/storage';
import { initGoogleAPI, signIn, signOut, isSignedIn, createCalendarEvent, marcarEventoPagado, eliminarCalendarEvent } from './utils/googleCalendar';
import { fechaHoy } from './utils/dateUtils';
import './App.css';

// Dev: proxy a localhost:3001  |  Android APK: URL completa del backend en Render
const API = (import.meta.env.VITE_API_URL || '') + '/api';

async function apiPost(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPatch(url, body) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiDelete(url) {
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Auto-genera vencimientos del dia 10 para servicios Mama en Supabase
async function autoGenerarMama(serviciosAPI) {
  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = String(hoy.getMonth() + 1).padStart(2, '0');
  const clave = 'mama_gen_' + anio + '_' + mes;
  if (localStorage.getItem(clave)) return;

  const mama = serviciosAPI.filter(s => s.nombre.toUpperCase().includes('MAMA'));
  if (!mama.length) { localStorage.setItem(clave, '1'); return; }

  const prefix = anio + '-' + mes;
  for (const serv of mama) {
    const yaExiste = (serv.vencimientos || []).some(v =>
      (v.fechaVencimiento || '').startsWith(prefix)
    );
    if (yaExiste) continue;
    try {
      await apiPost(API + '/vencimientos', {
        servicioNombre: serv.nombre,
        fecha:          anio + '-' + mes + '-10',
        monto:          null,
        notas:          'Vence el 10 (auto-generado)',
        esAutoGenerado: true,
      });
    } catch (e) {
      console.warn('No se pudo auto-generar vencimiento para', serv.nombre, e.message);
    }
  }
  localStorage.setItem(clave, '1');
}

export default function App() {
  const [servicios, setServicios]                 = useState([]);
  const [ocultos,   setOcultos]                   = useState([]);
  const [cargando,  setCargando]                  = useState(true);
  const [errorAPI,  setErrorAPI]                  = useState(null);
  const [tab,       setTab]                       = useState('dashboard');
  const [googleReady,      setGoogleReady]        = useState(false);
  const [googleConectado,  setGoogleConectado]    = useState(false);
  const [modalServicio,    setModalServicio]      = useState(null);
  const [modalVencimiento, setModalVencimiento]   = useState(null);
  const [modalRegistroPago, setModalRegistroPago] = useState(null);
  const [modalConfig, setModalConfig]             = useState(false);
  const [config, setConfig]                       = useState({});
  const [toast,  setToast]                        = useState(null);

  function mostrarToast(msg, tipo = 'success') {
    setToast({ mensaje: msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorAPI(null);
    try {
      const resp = await fetch(API + '/servicios');
      if (!resp.ok) throw new Error('Error ' + resp.status);
      const serviciosAPI = await resp.json();
      await autoGenerarMama(serviciosAPI);
      const resp2 = await fetch(API + '/servicios');
      const data = resp2.ok ? await resp2.json() : serviciosAPI;
      setServicios(data.map(s => ({ ...s, id: s.nombre })));
    } catch (err) {
      setErrorAPI('No se pudo conectar al backend. Verificar que el servidor este corriendo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const cfg = cargarConfig();
    setConfig(cfg);
    setOcultos(cargarOcultos());
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (config.googleClientId) {
      initGoogleAPI(config.googleClientId, () => {
        setGoogleReady(true);
        setGoogleConectado(isSignedIn());
      });
    }
  }, [config.googleClientId]);

  // -- Vencimientos --

  async function handleMarcarPagado(servicioId, vencimientoId) {
    try {
      await apiPatch(API + '/vencimientos/pagar', { id: vencimientoId, fechaPago: fechaHoy() });
      mostrarToast('✅ Marcado como pagado');
      const serv = servicios.find(s => s.id === servicioId || s.nombre === servicioId);
      const venc = serv?.vencimientos?.find(v => v.id === vencimientoId);
      if (googleConectado && venc?.calendarEventId) {
        try { await marcarEventoPagado(venc.calendarEventId, serv.nombre); } catch (e) {}
      }
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error: ' + err.message, 'error');
    }
  }

  async function handleGuardarVencimiento(datos) {
    const servicio = modalVencimiento;
    let calendarEventId = null;
    if (googleConectado) {
      try {
        calendarEventId = await createCalendarEvent(servicio.nombre, datos.fecha, datos.monto, datos.notas);
        mostrarToast('Guardado y evento creado en Google Calendar');
      } catch (err) {
        mostrarToast('Guardado (revisar Google Calendar)', 'warning');
      }
    } else {
      mostrarToast('Vencimiento guardado');
    }
    try {
      await apiPost(API + '/vencimientos', {
        servicioNombre: servicio.nombre,
        fecha:  datos.fecha,
        monto:  datos.monto || null,
        notas:  datos.notas || null,
        calendarEventId,
      });
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error al guardar: ' + err.message, 'error');
    }
    setModalVencimiento(null);
  }

  async function handleGuardarRegistroPago(datos) {
    const servicio = modalRegistroPago;
    const vencId   = modalRegistroPago._vencimientoId;
    try {
      if (vencId) {
        await apiPatch(API + '/vencimientos/pagar', {
          id: vencId, fechaPago: datos.fecha, monto: datos.monto ?? null,
        });
      } else {
        const mesPrefix = datos.fecha.slice(0, 7);
        // Buscar cualquier vencimiento pendiente del mes (auto-generado o del Excel)
        const pendienteMes = (servicio.vencimientos || []).find(v =>
          v.estado !== 'S' && (v.fechaVencimiento || '').startsWith(mesPrefix)
        );
        if (pendienteMes) {
          await apiPatch(API + '/vencimientos/pagar', {
            id: pendienteMes.id, fechaPago: datos.fecha, monto: datos.monto ?? null,
          });
        } else {
          await apiPost(API + '/vencimientos', {
            servicioNombre: servicio.nombre,
            fecha: datos.fecha, monto: datos.monto || null,
            notas: datos.notas || null, pagado: true, fechaPago: datos.fecha,
          });
        }
      }
      mostrarToast('✅ Pago registrado' + (datos.monto ? ' — $' + datos.monto.toLocaleString('es-AR', { maximumFractionDigits: 0 }) : ''));
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error al registrar: ' + err.message, 'error');
    }
    setModalRegistroPago(null);
  }

  async function handleEliminarVencimiento(servicioId, vencimientoId) {
    if (!window.confirm('Eliminar este vencimiento?')) return;
    const serv = servicios.find(s => s.id === servicioId || s.nombre === servicioId);
    const venc = serv?.vencimientos?.find(v => v.id === vencimientoId);
    if (googleConectado && venc?.calendarEventId) {
      try { await eliminarCalendarEvent(venc.calendarEventId); } catch (e) {}
    }
    try {
      await apiDelete(API + '/vencimientos/' + vencimientoId);
      mostrarToast('Vencimiento eliminado');
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error al eliminar: ' + err.message, 'error');
    }
  }

  // -- Servicios --

  async function handleGuardarServicio(datos) {
    try {
      if (modalServicio && modalServicio !== 'nuevo') {
        await apiPatch(API + '/servicios/' + encodeURIComponent(modalServicio.nombre), datos);
        mostrarToast('Servicio actualizado');
      } else {
        await apiPost(API + '/servicios', datos);
        mostrarToast('Servicio creado');
      }
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error: ' + err.message, 'error');
    }
    setModalServicio(null);
  }

  async function handleEliminarServicio(nombre) {
    if (window.confirm('Eliminar este servicio?')) {
      try {
        await apiDelete(API + '/servicios/' + encodeURIComponent(nombre));
        mostrarToast('Servicio eliminado');
        await cargarDatos();
      } catch (err) {
        mostrarToast('Error: ' + err.message, 'error');
      }
    }
  }

  function handleOcultarServicio(nombre) {
    const nuevos = [...ocultos, nombre];
    setOcultos(nuevos);
    guardarOcultos(nuevos);
    mostrarToast('👁️ Servicio ocultado. Podes restaurarlo desde "Servicios ocultos".');
  }

  function handleMostrarServicio(nombre) {
    const nuevos = ocultos.filter(o => o !== nombre);
    setOcultos(nuevos);
    guardarOcultos(nuevos);
    mostrarToast('Servicio restaurado');
  }

  // -- Google Calendar --

  async function handleSincronizarCalendar() {
    if (!googleConectado) { mostrarToast('Conectate a Google primero', 'error'); return; }
    const syncMap = cargarGcalSync();
    const hoyStr  = fechaHoy();
    let creados = 0, errores = 0;
    mostrarToast('Sincronizando...');
    for (const s of servicios) {
      for (const v of (s.vencimientos || [])) {
        if (v.estado === 'S') continue;
        const fecha = v.fechaVencimiento;
        if (!fecha || fecha < hoyStr) continue;
        const key = s.nombre + '|' + fecha;
        if (v.calendarEventId || syncMap[key]) continue;
        try {
          syncMap[key] = await createCalendarEvent(s.nombre, fecha, v.monto, v.comentarios);
          creados++;
        } catch (e) { errores++; }
      }
    }
    guardarGcalSync(syncMap);
    mostrarToast('Sincronizados: ' + creados + (errores ? ' — errores: ' + errores : ''));
  }

  async function handleSignIn() {
    try { await signIn(); setGoogleConectado(true); mostrarToast('Conectado a Google Calendar'); }
    catch (e) { mostrarToast('Error al conectar con Google', 'error'); }
  }
  function handleSignOut() {
    signOut(); setGoogleConectado(false); mostrarToast('Desconectado de Google Calendar');
  }
  function handleGuardarConfig(clientId) {
    const cfg = { ...config, googleClientId: clientId };
    setConfig(cfg); guardarConfig(cfg); setModalConfig(false);
    initGoogleAPI(clientId, () => { setGoogleReady(true); setGoogleConectado(isSignedIn()); });
    mostrarToast('Configuracion guardada');
  }

  const serviciosVisibles    = servicios.filter(s => !ocultos.includes(s.nombre || s.id));
  const serviciosOcultosList = servicios.filter(s =>  ocultos.includes(s.nombre || s.id));

  const urgentesCount = serviciosVisibles.reduce((acc, s) => acc + (s.vencimientos || []).filter(v => {
    if (v.estado === 'S') return false;
    const fecha = v.fechaVencimiento;
    if (!fecha) return false;
    return Math.round((new Date(fecha + 'T12:00:00') - new Date()) / 86400000) <= 2;
  }).length, 0);

  return (
    <div className='app'>
      <header className='app-header'>
        <div className='header-left'>
          <span className='app-logo'>💳</span>
          <div>
            <h1 className='app-title'>Pago de Servicios</h1>
            <p className='app-subtitle'>Recordatorios de vencimientos mensuales</p>
          </div>
        </div>
        <div className='header-right'>
          <button className='btn btn-icon btn-sm' onClick={cargarDatos} title='Recargar'>
            🔄
          </button>
          {config.googleClientId ? (
            googleConectado ? (
              <>
                <button className='btn btn-sm btn-outline' onClick={handleSincronizarCalendar}>
                  📅 Sincronizar
                </button>
                <button className='btn btn-google-connected btn-sm' onClick={handleSignOut}>
                  <span className='google-dot' /> Google Calendar conectado
                </button>
              </>
            ) : (
              <button className='btn btn-google btn-sm' onClick={handleSignIn} disabled={!googleReady}>
                {googleReady ? 'Conectar Calendar' : 'Cargando...'}
              </button>
            )
          ) : (
            <button className='btn btn-google btn-sm' onClick={() => setModalConfig(true)}>
              Configurar Google Calendar
            </button>
          )}
          <button className='btn btn-icon btn-sm' onClick={() => setModalConfig(true)}>⚙️</button>
        </div>
      </header>

      <nav className='app-tabs'>
        <button
          className={tab === 'dashboard' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setTab('dashboard')}
        >
          Proximos vencimientos
          {urgentesCount > 0 && <span className='tab-badge'>{urgentesCount}</span>}
        </button>
        <button
          className={tab === 'servicios' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setTab('servicios')}
        >
          Mis servicios <span className='tab-count'>{serviciosVisibles.length}</span>
        </button>
      </nav>

      <main className='app-main'>
        {cargando && (
          <div className='loading-state'>
            <div className='loading-spinner' />
            <p>Cargando datos desde Supabase...</p>
          </div>
        )}
        {errorAPI && (
          <div className='error-banner'>
            ⚠️ {errorAPI}
            <button className='btn btn-sm btn-outline' onClick={cargarDatos}>Reintentar</button>
          </div>
        )}
        {!cargando && tab === 'dashboard' && (
          <Dashboard
            servicios={serviciosVisibles}
            onMarcarPagado={handleMarcarPagado}
            onAgregarVencimiento={s => setModalVencimiento(s)}
          />
        )}
        {!cargando && tab === 'servicios' && (
          <ServiceList
            servicios={serviciosVisibles}
            serviciosOcultos={serviciosOcultosList}
            onAgregarServicio={() => setModalServicio('nuevo')}
            onAgregarVencimiento={s => setModalVencimiento(s)}
            onMarcarPagado={handleMarcarPagado}
            onEliminarVencimiento={handleEliminarVencimiento}
            onEditarServicio={s => setModalServicio(s)}
            onOcultarServicio={handleOcultarServicio}
            onMostrarServicio={handleMostrarServicio}
            onRegistrarPago={s => setModalRegistroPago(s)}
          />
        )}
      </main>

      {modalServicio && (
        <ServiceForm
          servicio={modalServicio === 'nuevo' ? null : modalServicio}
          onGuardar={handleGuardarServicio}
          onCerrar={() => setModalServicio(null)}
        />
      )}
      {modalVencimiento && (
        <VencimientoForm
          servicio={modalVencimiento}
          onGuardar={handleGuardarVencimiento}
          onCerrar={() => setModalVencimiento(null)}
        />
      )}
      {modalRegistroPago && (
        <VencimientoForm
          servicio={modalRegistroPago}
          modoRegistroPago={true}
          onGuardar={handleGuardarRegistroPago}
          onCerrar={() => setModalRegistroPago(null)}
        />
      )}
      {modalConfig && (
        <ConfigModal
          clientId={config.googleClientId}
          onGuardar={handleGuardarConfig}
          onCerrar={() => setModalConfig(false)}
        />
      )}
      {toast && <div className={'toast toast-' + toast.tipo}>{toast.mensaje}</div>}
    </div>
  );
}
