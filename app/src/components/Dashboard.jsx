import { useMemo } from 'react';
import { etiquetaUrgencia, formatFecha, diasHasta } from '../utils/dateUtils';
import { CATEGORIAS } from '../data/serviciosIniciales';

function norm(v) {
  return {
    ...v,
    _fecha:  v.fecha || v.fechaVencimiento || null,
    _pagado: v.pagado === true || v.estado === 'S',
    _monto:  v.monto || null,
    _coment: v.notas || v.comentarios || null,
  };
}

export default function Dashboard({ servicios, onMarcarPagado, onAgregarVencimiento }) {

  const items = useMemo(() => {
    const out = [];
    servicios.forEach(serv => {
      (serv.vencimientos || []).map(norm)
        .filter(v => !v._pagado && v._fecha)
        .forEach(v => {
          const dias = diasHasta(v._fecha);
          if (dias !== null && dias <= 30) out.push({ serv, v, dias });
        });
    });
    return out.sort((a, b) => a.dias - b.dias);
  }, [servicios]);

  const vencidos = items.filter(i => i.dias < 0);
  const hoy      = items.filter(i => i.dias === 0);
  const urgentes = items.filter(i => i.dias > 0 && i.dias <= 2);
  const proximos = items.filter(i => i.dias > 2 && i.dias <= 7);
  const normales = items.filter(i => i.dias > 7);
  const total    = items.reduce((s, i) => s + (i.v._monto || 0), 0);

  const uCls = n => ({ vencido:'badge-vencido', hoy:'badge-hoy', urgente:'badge-urgente',
    proximo:'badge-proximo', normal:'badge-normal' })[n] || 'badge-lejano';

  function DashCard({ serv, v }) {
    const cat = CATEGORIAS[serv.categoria] || CATEGORIAS.otros;
    const urg = etiquetaUrgencia(v._fecha);
    return (
      <div className={`dash-card${urg?.nivel==='vencido'?' dash-card-vencido':''}${urg?.nivel==='hoy'||urg?.nivel==='urgente'?' dash-card-urgente':''}`}>
        <div className="dash-card-top">
          <span className="dash-emoji">{cat.emoji}</span>
          <div className="dash-info">
            <div className="dash-nombre">{serv.nombre}</div>
            <div className="dash-fecha">{formatFecha(v._fecha)}</div>
            {v.esExcel && <span className="dash-badge-excel">📄 Planilla</span>}
          </div>
          <div className="dash-right">
            {v._monto && (
              <div className="dash-monto">
                ${v._monto.toLocaleString('es-AR', {minimumFractionDigits:2})}
              </div>
            )}
            {urg && <span className={`badge ${uCls(urg.nivel)}`}>{urg.texto}</span>}
          </div>
        </div>
        {v._coment && <div className="dash-notas">{v._coment}</div>}
        <div className="dash-actions">
          <button
            className="btn btn-success btn-sm"
            onClick={() => onMarcarPagado(serv.id || serv.nombre, v.id)}
          >
            ✅ Marcar como pagado
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onAgregarVencimiento(serv)}
          >
            + Nuevo vencimiento
          </button>
        </div>
      </div>
    );
  }

  function Seccion({ titulo, list, color }) {
    if (!list.length) return null;
    return (
      <div className="dash-section">
        <h3 className="dash-section-title" style={{color}}>{titulo}</h3>
        <div className="dash-grid">
          {list.map(i => (
            <DashCard key={i.serv.nombre + '-' + i.v.id} serv={i.serv} v={i.v} />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return (
    <div className="empty-state">
      <div className="empty-icon">🎉</div>
      <h3>No hay vencimientos próximos</h3>
      <p>No tenés pagos pendientes en los próximos 30 días.</p>
    </div>
  );

  return (
    <div className="dashboard">
      <div className="dashboard-summary">
        <div className="summary-stat">
          <span className="summary-num">{items.length}</span>
          <span className="summary-label">vencimientos próximos (30 días)</span>
        </div>
        {total > 0 && (
          <div className="summary-stat">
            <span className="summary-num">
              ${total.toLocaleString('es-AR', {maximumFractionDigits:0})}
            </span>
            <span className="summary-label">total estimado</span>
          </div>
        )}
        {vencidos.length > 0 && (
          <div className="summary-stat summary-alerta">
            <span className="summary-num">{vencidos.length}</span>
            <span className="summary-label">vencidos sin pagar</span>
          </div>
        )}
      </div>
      <Seccion titulo="🚨 Vencidos"             list={vencidos}  color="#DC2626" />
      <Seccion titulo="⚠️ Hoy"                list={hoy}       color="#D97706" />
      <Seccion titulo="🔔 Próximos 1-2 días" list={urgentes} color="#F59E0B" />
      <Seccion titulo="📅 Esta semana"          list={proximos}  color="#3B82F6" />
      <Seccion titulo="📆 Próximos 30 días"  list={normales}  color="#6B7280" />
    </div>
  );
}
