import { useMemo } from 'react';

const EMO = {
  salud:'🏥', servicios:'🏠', telefonia:'📱', entretenimiento:'📺',
  impuestos:'📋', seguros:'🛡️', tarjetas:'💳', servicios_mama:'👵',
  salud_mama:'💊', impuestos_mama:'📄', otros:'📌',
};
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function getProximo(s) {
  const pend = (s.vencimientos || []).filter(v => v.estado !== 'S' && v.fechaVencimiento);
  if (!pend.length) return null;
  return pend.reduce((m, v) => v.fechaVencimiento < m.fechaVencimiento ? v : m, pend[0]);
}

function getEstado(s) {
  const proximo = getProximo(s);
  if (!proximo) {
    const pagados = (s.vencimientos || []).filter(v => v.estado === 'S');
    return pagados.length
      ? { clase: 'estado-pagado', label: 'Al dia', emoji: '✅' }
      : { clase: 'estado-sin-venc', label: 'Sin vencimiento', emoji: '⚪' };
  }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const d = Math.round((new Date(proximo.fechaVencimiento + 'T12:00:00') - hoy) / 86400000);
  if (d < 0)  return { clase: 'estado-vencido',  label: 'Vencido',  emoji: '🔴' };
  if (d === 0) return { clase: 'estado-hoy',     label: 'Hoy',      emoji: '⚠️' };
  if (d <= 2)  return { clase: 'estado-urgente', label: 'Urgente',  emoji: '🟡' };
  if (d <= 7)  return { clase: 'estado-proximo', label: 'Proximo',  emoji: '🔵' };
  return { clase: 'estado-normal', label: 'Pendiente', emoji: '🟢' };
}

const ORDEN = { 'estado-vencido':0,'estado-hoy':1,'estado-urgente':2,'estado-proximo':3,'estado-normal':4,'estado-pagado':5,'estado-sin-venc':6 };

function fmtFecha(f) {
  if (!f) return '-';
  const [a, m, d] = f.split('-');
  return d + ' ' + MESES[parseInt(m,10)-1] + ' ' + a;
}

function fmtMonto(m) {
  if (!m) return '-';
  return '$' + Number(m).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

export default function ResumenPage({ servicios, onMarcarPagado, onRegistrarPago, onAgregarVencimiento }) {
  const filas = useMemo(() => servicios.map(s => {
    const proximo = getProximo(s);
    const estado  = getEstado(s);
    return { s, proximo, estado };
  }).sort((a, b) => {
    const oa = ORDEN[a.estado.clase] ?? 7;
    const ob = ORDEN[b.estado.clase] ?? 7;
    if (oa !== ob) return oa - ob;
    const fa = a.proximo?.fechaVencimiento || 'z';
    const fb = b.proximo?.fechaVencimiento || 'z';
    return fa.localeCompare(fb);
  }), [servicios]);

  const pendCount   = filas.filter(f => ['estado-vencido','estado-hoy','estado-urgente','estado-proximo','estado-normal'].includes(f.estado.clase)).length;
  const vencidoCount = filas.filter(f => f.estado.clase === 'estado-vencido').length;

  return (
    <div className="resumen-page">
      <div className="resumen-stats">
        <div className={'resumen-stat' + (vencidoCount ? ' resumen-stat-alert' : '')}>
          <span className="resumen-stat-num">{vencidoCount}</span>
          <span className="resumen-stat-label">Vencidos</span>
        </div>
        <div className="resumen-stat">
          <span className="resumen-stat-num">{pendCount}</span>
          <span className="resumen-stat-label">Pendientes</span>
        </div>
        <div className="resumen-stat">
          <span className="resumen-stat-num">{servicios.length}</span>
          <span className="resumen-stat-label">Total servicios</span>
        </div>
      </div>
      <div className="resumen-table-wrap">
        <table className="resumen-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Servicio</th>
              <th>Vencimiento</th>
              <th>Monto</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ s, proximo, estado }) => (
              <tr key={s.nombre} className={'resumen-row ' + estado.clase}>
                <td>
                  <span className={'estado-badge ' + estado.clase}>
                    {estado.emoji} {estado.label}
                  </span>
                </td>
                <td className="col-nombre-cell">
                  <span className="col-emo">{EMO[s.categoria] || '📌'}</span>
                  <span>{s.nombre}</span>
                </td>
                <td className="col-fecha-cell">{fmtFecha(proximo?.fechaVencimiento)}</td>
                <td className="col-monto-cell">{fmtMonto(proximo?.monto || s.ultimoMonto)}</td>
                <td>
                  {proximo ? (
                    proximo.monto ? (
                      <button className="btn btn-xs btn-success"
                        onClick={() => onMarcarPagado(s.nombre, proximo.id)}>
                        Pagar
                      </button>
                    ) : (
                      <button className="btn btn-xs btn-outline"
                        onClick={() => onRegistrarPago({ ...s, _vencimientoId: proximo.id, _fechaVenc: proximo.fechaVencimiento })}>
                        Registrar pago
                      </button>
                    )
                  ) : (
                    <button className="btn btn-xs btn-secondary"
                      onClick={() => onAgregarVencimiento(s)}>
                      + Agregar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
