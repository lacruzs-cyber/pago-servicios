import { useState, useEffect, useCallback } from 'react';
import LoginPage from './components/LoginPage';
import ResumenPage from './components/ResumenPage';
import ServiceList from './components/ServiceList';
import ServiceForm from './components/ServiceForm';
import VencimientoForm from './components/VencimientoForm';
import ConfigModal from './components/ConfigModal';
import { cargarConfig, guardarConfig, cargarOcultos, guardarOcultos, cargarGcalSync, guardarGcalSync } from './utils/storage';
import { initGoogleAPI, signIn, signOut, isSignedIn, createCalendarEvent, eliminarCalendarEvent, listarEventosVencimientos } from './utils/googleCalendar';
import { fechaHoy } from './utils/dateUtils';
import {
  getServicios, crearVencimiento, pagarVencimiento, actualizarVencimiento,
  actualizarCalendarEvent, eliminarVencimiento as dbEliminarVencimiento,
  crearServicio, actualizarServicio, eliminarServicio,
  getConfig, setConfig as saveConfig,
} from './lib/db';
import './App.css';

// Client ID de Google Calendar — hardcodeado para no requerir configuración manual
const DEFAULT_GCAL_CLIENT_ID = '987611899031-7d8qbnul2e7u5mah6isvlt9mrii1c4al.apps.googleusercontent.com';

// Servicios que NO deben crear eventos en Google Calendar
const SERVICIOS_SIN_CALENDAR = ['NORA', 'ROSANA', 'AGUINALDO NORA', 'AGUINALDO ROSANA', 'MARIEL'];

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
      await crearVencimiento({
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

// Auto-genera vencimientos de Aguinaldo en junio (dia 30) y diciembre (dia 31)
async function autoGenerarAguinaldo(serviciosAPI) {
  const hoy  = new Date();
  const anio = hoy.getFullYear();
  const mes  = hoy.getMonth() + 1; // 1-12

  // Solo generar en junio (6) y diciembre (12)
  if (mes !== 6 && mes !== 12) return;

  const mesStr    = String(mes).padStart(2, '0');
  const fechaVenc = mes === 6 ? anio + '-06-30' : anio + '-12-31';
  const clave = 'aguinaldo_gen_' + anio + '_' + mesStr;
  if (localStorage.getItem(clave)) return;

  const aguinaldo = serviciosAPI.filter(s => s.nombre.toUpperCase().includes('AGUINALDO'));
  if (!aguinaldo.length) { localStorage.setItem(clave, '1'); return; }

  const prefix = anio + '-' + mesStr;
  for (const serv of aguinaldo) {
    const yaExiste = (serv.vencimientos || []).some(v =>
      (v.fechaVencimiento || '').startsWith(prefix)
    );
    if (yaExiste) continue;
    try {
      await crearVencimiento({
        servicioNombre: serv.nombre,
        fecha:          fechaVenc,
        monto:          null,
        notas:          'Aguinaldo ' + (mes === 6 ? '1º semestre' : '2º semestre') + ' (auto-generado)',
        esAutoGenerado: true,
      });
    } catch (e) {
      console.warn('No se pudo auto-generar aguinaldo para', serv.nombre, e.message);
    }
  }
  localStorage.setItem(clave, '1');
}

export default function App() {
  const [autenticado, setAutenticado]              = useState(() => sessionStorage.getItem('pagos_auth') === '1');
  const [servicios, setServicios]                  = useState([]);
  const [ocultos,   setOcultos]                    = useState([]);
  const [cargando,  setCargando]                   = useState(true);
  const [errorAPI,  setErrorAPI]                   = useState(null);
  const [tab,       setTab]                        = useState('resumen');
  const [googleReady,       setGoogleReady]        = useState(false);
  const [googleConectado,   setGoogleConectado]    = useState(false);
  const [modalServicio,     setModalServicio]      = useState(null);
  const [modalVencimiento,  setModalVencimiento]   = useState(null);
  const [modalRegistroPago, setModalRegistroPago]  = useState(null);
  const [modalConfig,       setModalConfig]        = useState(false);
  const [modalEditar,       setModalEditar]        = useState(null);
  const [config,            setConfigState]        = useState({});
  const [toast,             setToast]              = useState(null);

  function mostrarToast(msg, tipo = 'success') {
    setToast({ mensaje: msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorAPI(null);
    try {
      const serviciosAPI = await getServicios();
      await autoGenerarMama(serviciosAPI);
      await autoGenerarAguinaldo(serviciosAPI);
      const data = await getServicios();
      setServicios(data.map(s => ({ ...s, id: s.nombre })));
    } catch (err) {
      setErrorAPI('No se pudo conectar a Supabase. Verificar la conexión a internet.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    async function inicializar() {
      let cfg = cargarConfig();
      // Intentar cargar config desde Supabase (sincroniza entre dispositivos)
      try {
        const remoteConfig = await getConfig();
        if (remoteConfig.googleClientId) {
          cfg = { ...cfg, googleClientId: remoteConfig.googleClientId };
          guardarConfig(cfg);
        }
      } catch {}
      // Usar Client ID hardcodeado como fallback — siempre disponible sin configuración
      if (!cfg.googleClientId) {
        cfg = { ...cfg, googleClientId: DEFAULT_GCAL_CLIENT_ID };
        guardarConfig(cfg);
        try { await saveConfig({ googleClientId: DEFAULT_GCAL_CLIENT_ID }); } catch {}
      }
      setConfigState(cfg);
      setOcultos(cargarOcultos());
      cargarDatos();
    }
    inicializar();
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

  async function handleMarcarPagado(servicio, vencimientoId) {
    const hoy = fechaHoy();
    const nombreServ = typeof servicio === 'string' ? servicio : servicio.nombre;
    try {
      if (vencimientoId) {
        await pagarVencimiento({ id: vencimientoId, fechaPago: hoy });
        const serv = servicios.find(s => s.nombre === nombreServ);
        const venc = serv?.vencimientos?.find(v => v.id === vencimientoId);
        if (googleConectado && venc?.calendarEventId) {
          try { await eliminarCalendarEvent(venc.calendarEventId); } catch (e) {}
        }
      } else {
        await crearVencimiento({
          servicioNombre: nombreServ,
          fecha: hoy, monto: null, notas: null,
          pagado: true, fechaPago: hoy,
        });
      }
      mostrarToast('✅ Marcado como pagado');
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error: ' + err.message, 'error');
    }
  }

  async function handleGuardarVencimiento(datos) {
    const servicio = modalVencimiento;
    let calendarEventId = null;
    const usaCalendar = googleConectado && !SERVICIOS_SIN_CALENDAR.includes(servicio.nombre);
    if (usaCalendar) {
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
      await crearVencimiento({
        servicioNombre: servicio.nombre,
        fecha:  datos.fecha,
        monto:  datos.monto ?? null,
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
      if (servicio.permiteMultiplesPagos || modalRegistroPago._multipago) {
        await crearVencimiento({
          servicioNombre: servicio.nombre,
          fecha: datos.fecha, monto: datos.monto ?? null,
          notas: datos.notas || null, pagado: true, fechaPago: datos.fecha,
        });
      } else if (vencId) {
        await pagarVencimiento({
          id: vencId, fechaPago: datos.fecha, monto: datos.monto ?? null,
        });
      } else {
        const mesPrefix = datos.fecha.slice(0, 7);
        const pendienteMes = (servicio.vencimientos || []).find(v =>
          v.estado !== 'S' && (v.fechaVencimiento || '').startsWith(mesPrefix)
        );
        if (pendienteMes) {
          await pagarVencimiento({
            id: pendienteMes.id, fechaPago: datos.fecha, monto: datos.monto ?? null,
          });
        } else {
          await crearVencimiento({
            servicioNombre: servicio.nombre,
            fecha: datos.fecha, monto: datos.monto ?? null,
            notas: datos.notas || null, pagado: true, fechaPago: datos.fecha,
          });
        }
      }
      mostrarToast('✅ Pago registrado' + (datos.monto ? ' — $' + Number(datos.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''));
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
      await dbEliminarVencimiento(vencimientoId);
      mostrarToast('Vencimiento eliminado');
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error al eliminar: ' + err.message, 'error');
    }
  }

  function handleEditarVencimiento(servicio, vencimiento) {
    setModalEditar({
      servicio,
      vencimiento,
      initialValues: {
        fecha: vencimiento.fechaVencimiento || vencimiento._fecha,
        monto: vencimiento.monto ?? vencimiento._monto,
        notas: vencimiento.notas || vencimiento.comentarios || vencimiento._notas || '',
      },
    });
  }

  async function handleGuardarEdicion(datos) {
    try {
      await actualizarVencimiento({
        id:               modalEditar.vencimiento.id,
        monto:            datos.monto ?? null,
        fechaVencimiento: datos.fecha,
        comentarios:      datos.notas || null,
      });
      mostrarToast('✅ Vencimiento actualizado');
      await cargarDatos();
    } catch (err) {
      mostrarToast('Error al actualizar: ' + err.message, 'error');
    }
    setModalEditar(null);
  }

  // -- Servicios --

  async function handleGuardarServicio(datos) {
    try {
      if (modalServicio && modalServicio !== 'nuevo') {
        await actualizarServicio(modalServicio.nombre, datos);
        mostrarToast('Servicio actualizado');
      } else {
        await crearServicio(datos);
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
        await eliminarServicio(nombre);
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
    mostrarToast('Revisando Google Calendar...');

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const hoyStr = fechaHoy();
    const finProxMes = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0);
    const finProxMesStr = finProxMes.toISOString().split('T')[0];

    let eliminados = 0, creados = 0, errores = 0;

    try {
      const eventosCalendar = await listarEventosVencimientos(hoyStr, finProxMesStr);

      const gruposPorKey = {};
      for (const ev of eventosCalendar) {
        const summary = ev.summary || '';
        const match = summary.match(/Vencimiento:\s*(.+)$/);
        if (!match) continue;
        const nombreServ = match[1].trim();
        const fechaEv = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
        const key = nombreServ + '|' + fechaEv;
        if (!gruposPorKey[key]) gruposPorKey[key] = [];
        gruposPorKey[key].push(ev);
      }

      for (const key of Object.keys(gruposPorKey)) {
        const evs = gruposPorKey[key];
        if (evs.length <= 1) continue;
        for (let i = 1; i < evs.length; i++) {
          try {
            await eliminarCalendarEvent(evs[i].id);
            console.log('[Sync] Duplicado eliminado:', evs[i].summary, evs[i].id);
            eliminados++;
          } catch (e) {
            console.error('[Sync] Error eliminando duplicado:', e);
          }
        }
        gruposPorKey[key] = [evs[0]];
      }

      const existentes = {};
      for (const [key, evs] of Object.entries(gruposPorKey)) {
        existentes[key] = evs[0].id;
      }

      const syncMap = cargarGcalSync();
      for (const s of servicios) {
        for (const v of (s.vencimientos || [])) {
          if (v.estado === 'S') continue;
          const fecha = v.fechaVencimiento;
          if (!fecha || fecha < hoyStr || fecha > finProxMesStr) continue;
          const key = s.nombre + '|' + fecha;
          if (existentes[key]) {
            if (!v.calendarEventId && v.id) {
              actualizarCalendarEvent({ id: v.id, calendarEventId: existentes[key] }).catch(() => {});
            }
            continue;
          }
          if (v.calendarEventId) continue;
          try {
            const eventId = await createCalendarEvent(s.nombre, fecha, v.monto, v.comentarios);
            syncMap[key] = eventId;
            if (v.id) {
              actualizarCalendarEvent({ id: v.id, calendarEventId: eventId }).catch(() => {});
            }
            creados++;
          } catch (e) { errores++; }
        }
      }
      guardarGcalSync(syncMap);

      const msg = [
        eventosCalendar.length + ' eventos en Calendar',
        creados    ? creados + ' creados'                    : '',
        eliminados ? eliminados + ' duplicados eliminados'   : '',
        errores    ? errores + ' errores'                    : '',
      ].filter(Boolean).join(' — ');
      mostrarToast('✅ Sync: ' + msg);
    } catch (e) {
      mostrarToast('Error en sincronización: ' + e.message, 'error');
    }
  }

  async function handleSignIn() {
    try { await signIn(); setGoogleConectado(true); mostrarToast('Conectado a Google Calendar'); }
    catch (e) { mostrarToast('Error al conectar con Google', 'error'); }
  }
  function handleSignOut() {
    signOut(); setGoogleConectado(false); mostrarToast('Desconectado de Google Calendar');
  }
  async function handleGuardarConfig(clientId) {
    const cfg = { ...config, googleClientId: clientId };
    setConfigState(cfg); guardarConfig(cfg); setModalConfig(false);
    try { await saveConfig({ googleClientId: clientId }); } catch {}
    initGoogleAPI(clientId, () => { setGoogleReady(true); setGoogleConectado(isSignedIn()); });
    mostrarToast('Configuracion guardada');
  }

  if (!autenticado) {
    return <LoginPage onLogin={() => setAutenticado(true)} />;
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
          className={tab === 'resumen' ? 'tab-btn tab-active' : 'tab-btn'}
          onClick={() => setTab('resumen')}
        >
          Inicio
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
        {!cargando && tab === 'resumen' && (
          <ResumenPage
            servicios={serviciosVisibles}
            onMarcarPagado={handleMarcarPagado}
            onRegistrarPago={s => setModalRegistroPago(s)}
            onAgregarVencimiento={s => setModalVencimiento(s)}
            onEditarVencimiento={handleEditarVencimiento}
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
            onEliminarServicio={handleEliminarServicio}
            onOcultarServicio={handleOcultarServicio}
            onMostrarServicio={handleMostrarServicio}
            onRegistrarPago={s => setModalRegistroPago(s)}
            onEditarVencimiento={handleEditarVencimiento}
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
      {modalEditar && (
        <VencimientoForm
          servicio={modalEditar.servicio}
          modoEditar={true}
          initialValues={modalEditar.initialValues}
          onGuardar={handleGuardarEdicion}
          onCerrar={() => setModalEditar(null)}
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
