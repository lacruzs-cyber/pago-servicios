import { useState } from 'react';
import { CATEGORIAS } from '../data/serviciosIniciales';
import { formatFecha, etiquetaUrgencia, estimarProximoVencimiento } from '../utils/dateUtils';

function norm(v) {
  return {
    ...v,
    _fecha:  v.fecha || v.fechaVencimiento || null,
    _pagado: v.pagado === true || v.estado === 'S',
    _monto:  v.monto || null,
    _notas:  v.notas || v.comentarios || null,
  };
}

function fmt(n) {
  if (!n && n !== 0) return null;
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
}

export default function ServiceCard({
  servicio,
  onAgregarVencimiento,
  onMarcarPagado,
  onEliminarVencimiento,
  onEditarServicio,
  onRegistrarPago,
  onOcultarServicio,
  esOculto = false,
}) {
  const [expandido, setExpandido] = useState(false);
  const cat = CATEGORIAS[servicio.categoria] || CATEGORIAS.otros;

  const todosNorm = (servicio.vencimientos || []).map(norm);

  const pendientes = todosNorm
    .filter(v => !v._pagado && v._fecha)
    .sort((a, b) => a._fecha.localeCompare(b._fecha));

  const pagados = todosNorm
    .filter(v => v._pagado && v._fecha)
    .sort((a, b) => b._fecha.localeCompare(a._fecha));

  const proximo  = pendientes[0] || null;
  const urgencia = proximo ? etiquetaUrgencia(proximo._fecha) : null;
  const estimado = estimarProximoVencimiento(servicio.diaEstimado);

  const ultimoMontoPagado = pagados.find(v => v._monto)?._monto;
  const ultimoMonto = ultimoMontoPagado || servicio.ultimoMonto;
  const montoPendiente = servicio.montoPendiente || (proximo?.esExcel ? proximo._monto : null);

  const uCls = n => ({ vencido:'badge-vencido', hoy:'badge-hoy', urgente:'badge-urgente',
    proximo:'badge-proximo', normal:'badge-normal' })[n] || 'badge-lejano';

  const sid = servicio.id || servicio.nombre;

  return (
    <div className={[
      'service-card',
      esOculto ? 'card-oculto' : '',
      proximo && urgencia?.nivel === 'vencido' ? 'card-vencido' : '',
      proximo && (urgencia?.nivel === 'hoy' || urgencia?.nivel === 'urgente') ? 'card-urgente' : '',
    ].filter(Boolean).join(' ')}>

      {/* Header */}
      <div className="card-header" onClick={() => setExpandido(e => !e)}>
        <div className="card-header-left">
          <span className="card-emoji">{cat.emoji}</span>
          <div>
            <div className="card-nombre">{servicio.nombre}</div>
            <div className="card-cat" style={{ color: cat.color }}>{cat.label}</div>
          </div>
        </div>
        <div className="card-header-right">
          {esOculto && <span className="badge badge-oculto">👁️ Oculto</span>}
          {!esOculto && urgencia && <span className={`badge ${uCls(urgencia.nivel)}`}>{urgencia.texto}</span>}
          {proximo
            ? <div className="card-fecha-proximo">{formatFecha(proximo._fecha)}</div>
            : <span className="badge badge-sin-vencimiento">Sin vencimiento</span>
          }
          <span className="card-toggle">{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Preview colapsado con pendiente */}
      {proximo && !expandido && (
        <div className="card-preview">
          <div className="card-preview-montos">
            {proximo._monto
              ? <span className="card-monto">${fmt(proximo._monto)}</span>
              : montoPendiente
                ? <span className="card-monto-pendiente">Planilla: ${fmt(montoPendiente)}</span>
                : ultimoMonto
                  ? <span className="card-monto-ref">Ref: ${fmt(ultimoMonto)}</span>
                  : null
            }
          </div>
          <div className="card-actions-inline">
            {proximo.esExcel || proximo._monto ? (
              <button className="btn btn-success btn-sm"
                onClick={e => { e.stopPropagation(); onMarcarPagado(sid, proximo.id); }}>
                ✅ Marcar como pagado
              </button>
            ) : (
              <button className="btn btn-success btn-sm"
                onClick={e => { e.stopPropagation(); onRegistrarPago({ ...servicio, _vencimientoId: proximo.id, _fechaVenc: proximo._fecha }); }}>
                ✅ Registrar pago (ingresá monto)
              </button>
            )}
            <button className="btn btn-outline btn-sm"
              onClick={e => { e.stopPropagation(); onAgregarVencimiento(servicio); }}>
              + Nuevo vencimiento
            </button>
          </div>
        </div>
      )}

      {/* Sin proximo: referencia de monto */}
      {!proximo && !expandido && (
        <div className="card-preview">
          <div className="card-preview-montos">
            {montoPendiente
              ? <span className="card-monto-pendiente">⚠️ Planilla sin pagar: ${fmt(montoPendiente)}</span>
              : ultimoMonto
                ? <span className="card-monto-ref">Último pagado: ${fmt(ultimoMonto)}</span>
                : <span className="card-monto-ref">Sin historial de pagos</span>
            }
          </div>
          <div className="card-actions-inline">
            <button className="btn btn-success btn-sm"
              onClick={e => { e.stopPropagation(); onRegistrarPago(servicio); }}>
              ✅ Registrar pago
            </button>
            <button className="btn btn-outline btn-sm"
              onClick={e => { e.stopPropagation(); onAgregarVencimiento(servicio); }}>
              + Cargar vencimiento
            </button>
          </div>
        </div>
      )}

      {/* Expandido */}
      {expandido && (
        <div className="card-body">

          {montoPendiente && (
            <div className="estimacion-banner estimacion-pendiente">
              ⚠️ Monto en planilla sin pagar: <strong>${fmt(montoPendiente)}</strong>
            </div>
          )}

          {ultimoMonto && (
            <div className="estimacion-banner estimacion-monto">
              💰 Último valor pagado: <strong>${fmt(ultimoMonto)}</strong>
              {ultimoMontoPagado ? ' (en la app)' : ' (planilla)'}
            </div>
          )}

          {servicio.diaEstimado && estimado && (
            <div className="estimacion-banner">
              📊 Vence aprox. el día <strong>{servicio.diaEstimado}</strong> de cada mes
              — próxima: <strong>{formatFecha(estimado)}</strong>
            </div>
          )}

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <div className="venc-section">
              <h4 className="venc-section-title">Pendientes</h4>
              {pendientes.map(v => {
                const urg = etiquetaUrgencia(v._fecha);
                return (
                  <div key={v.id} className="venc-item">
                    <div className="venc-item-info">
                      <span className="venc-fecha">{formatFecha(v._fecha)}</span>
                      {urg && <span className={`badge badge-sm ${uCls(urg.nivel)}`}>{urg.texto}</span>}
                      {v._monto
                        ? <span className="venc-monto">${fmt(v._monto)}</span>
                        : montoPendiente
                          ? <span className="venc-monto-pendiente">Planilla: ${fmt(montoPendiente)}</span>
                          : ultimoMonto
                            ? <span className="venc-monto-ref">Ref: ${fmt(ultimoMonto)}</span>
                            : null
                      }
                      {v._notas && <span className="venc-notas">{v._notas}</span>}
                      {v.esExcel && <span className="venc-excel-badge">📄</span>}
                      {v.calendarEventId && <span className="venc-calendar" title="Google Calendar">📅</span>}
                    </div>
                    <div className="venc-item-actions">
                      <button className="btn btn-success btn-xs"
                        onClick={() => onMarcarPagado(sid, v.id)}>
                        ✅ Pagado
                      </button>
                      {!v.esExcel && (
                        <button className="btn btn-danger btn-xs"
                          onClick={() => onEliminarVencimiento(sid, v.id)}
                          title="Eliminar">
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Historial pagados */}
          {pagados.length > 0 && (
            <div className="venc-section venc-pagados">
              <h4 className="venc-section-title">Historial pagados</h4>
              {pagados.slice(0, 5).map(v => (
                <div key={v.id} className="venc-item venc-item-pagado">
                  <div className="venc-item-info">
                    <span className="venc-fecha">{formatFecha(v._fecha)}</span>
                    <span className="badge badge-pagado">✓ Pagado</span>
                    {v._monto && <span className="venc-monto">${fmt(v._monto)}</span>}
                    {v.mes && <span className="venc-notas">{v.mes} {v.anio}</span>}
                    {v.fechaPago && <span className="venc-notas">el {formatFecha(v.fechaPago)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card-footer-actions">
            <button className="btn btn-success btn-sm" onClick={() => onRegistrarPago(servicio)}>
              ✅ Registrar pago
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onAgregarVencimiento(servicio)}>
              + Agregar vencimiento
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => onEditarServicio(servicio)}>
              ✏️ Editar
            </button>
            <button
              className={esOculto ? 'btn btn-primary btn-sm' : 'btn btn-warning btn-sm'}
              onClick={() => onOcultarServicio(sid)}
            >
              {esOculto ? '👁️ Restaurar servicio' : '👁️ Ocultar servicio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
