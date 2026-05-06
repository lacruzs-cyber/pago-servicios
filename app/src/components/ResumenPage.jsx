import { useMemo } from 'react';

const EMO = {
  salud:'🏥', servicios:'🏠', telefonia:'📱', entretenimiento:'📺',
  impuestos:'📋', seguros:'🛡️', tarjetas:'💳', servicios_mama:'👵',
  salud_mama:'💊', impuestos_mama:'📄', otros:'📌', personal:'👤',
};

const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_LARGOS = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function esMamaS(s) {
  return s.esMama === true || (s.categoria || '').includes('mama');
}

function calcEstado(s, mesActual) {
  const venc = s.vencimientos || [];

  if (s.permiteMultiplesPagos) {
    const pagosEsteMes = venc.filter(v =>
      v.estado === 'S' &&
      ((v.fechaPago || '').startsWith(mesActual) || (v.fechaVencimiento || '').startsWith(mesActual))
    );
    if (pagosEsteMes.length > 0) {
      return { clase: 'estado-multiple',
        label: pagosEsteMes.length + ' pago' + (pagosEsteMes.length !== 1 ? 's' : ''),
        emoji: '💰', esMama: false, pagosEsteMes, esMultiple: true };
    }
    return { clase: 'estado-normal', label: 'Pendiente', emoji: '🟢',
      esMama: false, pagosEsteMes: [], esMultiple: true };
  }

  if (venc.length === 0) return null;

  const pagadoEsteMes = venc.some(v =>
    v.estado === 'S' &&
    ((v.fechaPago || '').startsWith(mesActual) || (v.fechaVencimiento || '').startsWith(mesActual))
  );
  if (pagadoEsteMes) {
    return { clase: 'estado-pagado', label: 'Al día', emoji: '✅', esMama: esMamaS(s) };
  }

  const pend = venc.filter(v => v.estado !== 'S' && v.fechaVencimiento);
  if (pend.length > 0) {
    const prox = pend.reduce((m, v) => v.fechaVencimiento < m.fechaVencimiento ? v : m, pend[0]);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const d = Math.round((new Date(prox.fechaVencimiento + 'T12:00:00') - hoy) / 86400000);
    if (d < 0)  return { clase: 'estado-vencido',  label: 'Vencido',  emoji: '🔴', proximo: prox, esMama: esMamaS(s) };
    if (d === 0) return { clase: 'estado-hoy',     label: 'Hoy',      emoji: '⚠️', proximo: prox, esMama: esMamaS(s) };
    if (d <= 2)  return { clase: 'estado-urgente', label: 'Urgente',  emoji: '🟡', proximo: prox, esMama: esMamaS(s) };
    if (d <= 7)  return { clase: 'estado-proximo', label: 'Próximo',  emoji: '🔵', proximo: prox, esMama: esMamaS(s) };
    return { clase: 'estado-normal', label: 'Pendiente', emoji: '🟢', proximo: prox, esMama: esMamaS(s) };
  }

  return { clase: 'estado-normal', label: 'Pendiente', emoji: '🟢', proximo: null, esMama: esMamaS(s) };
}

const ORDEN = {
  'estado-vencido': 0, 'estado-hoy': 1, 'estado-urgente': 2,
  'estado-proximo': 3, 'estado-normal': 4, 'estado-multiple': 5, 'estado-pagado': 6,
};

function fmtFecha(f) {
  if (!f) return '-';
  const [a, m, d] = f.split('-');
  return d + ' ' + MESES_CORTOS[parseInt(m, 10) - 1] + ' ' + a;
}

function fmtMonto(m) {
  if (!m && m !== 0) return '-';
  return '$' + Number(m).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ResumenPage({ servicios, onMarcarPagado, onRegistrarPago, onAgregarVencimiento }) {
  const ahora = new Date();
  const mesActual = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0');

  const filas = useMemo(() => {
    const rows = [];
    for (const s of servicios) {
      const estado = calcEstado(s, mesActual);
      if (!estado) continue;
      rows.push({ s, estado, proximo: estado.proximo || null });
    }
    return rows.sort((a, b) => {
      const oa = ORDEN[a.estado.clase] ?? 99;
      const ob = ORDEN[b.estado.clase] ?? 99;
      if (oa !== ob) return oa - ob;
      if (a.estado.esMama !== b.estado.esMama) return a.estado.esMama ? 1 : -1;
      const fa = a.proximo?.fechaVencimiento || 'z';
      const fb = b.proximo?.fechaVencimiento || 'z';
      return fa.localeCompare(fb);
    });
  }, [servicios, mesActual]);

  const pendCount    = filas.filter(f => ORDEN[f.estado.clase] <= 4).length;
  const vencidoCount = filas.filter(f => f.estado.clase === 'estado-vencido').length;
  // Solo suma montos explícitamente cargados en vencimientos del mes
  const montoEstimado = filas
    .filter(f => f.estado.clase !== 'estado-pagado' && f.estado.clase !== 'estado-multiple')
    .reduce((sum, { proximo }) => sum + (proximo?.monto || 0), 0);

  const diaTexto = DIAS_ES[ahora.getDay()] + ' ' + ahora.getDate() +
    ' de ' + MESES_LARGOS[ahora.getMonth()] + ' de ' + ahora.getFullYear();

  return (
    <div className="resumen-page">
      <div className="resumen-encabezado">
        <div className="resumen-fecha-hoy">📅 Hoy es <strong>{diaTexto}</strong></div>
        {montoEstimado > 0 && (
          <div className="resumen-monto-est">
            💵 Monto estimado pendiente: <strong>{fmtMonto(montoEstimado)}</strong>
          </div>
        )}
      </div>

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
          <span className="resumen-stat-num">{filas.length}</span>
          <span className="resumen-stat-label">Activos</span>
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
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ s, estado, proximo }) => {
              // Solo mostrar monto cargado en el vencimiento actual.
              // ultimoMonto solo como referencia si hay vencimiento sin monto.
              const montoExplicito = proximo?.monto != null ? proximo.monto : null;
              const montoRef = montoExplicito ?? (proximo && s.ultimoMonto ? s.ultimoMonto : null);
              const esMontoRef = montoExplicito == null && montoRef != null;
              const esMultiple = estado.esMultiple;
              const tieneMontoConocido = proximo?.monto != null;
              const ultimoPagoMes = esMultiple && estado.pagosEsteMes?.length > 0
                ? estado.pagosEsteMes[estado.pagosEsteMes.length - 1]
                : null;

              return (
                <tr key={s.nombre} className={'resumen-row ' + estado.clase}>
                  <td>
                    <span className={'estado-badge ' + estado.clase}>
                      {estado.emoji} {estado.label}
                    </span>
                    {esMultiple && estado.pagosEsteMes?.length > 0 && (
                      <div className="resumen-pagos-total">
                        {fmtMonto(estado.pagosEsteMes.reduce((t, v) => t + (v.monto || 0), 0))}
                      </div>
                    )}
                  </td>
                  <td className="col-nombre-cell">
                    <span className="col-emo">{EMO[s.categoria] || '📌'}</span>
                    <span>{s.nombre}</span>
                  </td>
                  <td className="col-fecha-cell">
                    {esMultiple
                      ? fmtFecha(ultimoPagoMes?.fechaPago || ultimoPagoMes?.fechaVencimiento)
                      : fmtFecha(proximo?.fechaVencimiento)}
                  </td>
                  <td className="col-monto-cell">
                    {montoRef != null
                      ? <span className={esMontoRef ? 'col-monto-ref-txt' : ''}>{fmtMonto(montoRef)}</span>
                      : '-'}
                  </td>
                  <td>
                    {esMultiple ? (
                      <button className="btn btn-xs btn-outline"
                        onClick={() => onRegistrarPago({ ...s, _multipago: true })}>
                        + Agregar pago
                      </button>
                    ) : proximo ? (
                      tieneMontoConocido ? (
                        <button className="btn btn-xs btn-success"
                          onClick={() => onMarcarPagado(s.nombre, proximo.id)}>
                          Marcar como pagado
                        </button>
                      ) : (
                        <button className="btn btn-xs btn-outline"
                          onClick={() => onRegistrarPago({ ...s, _vencimientoId: proximo.id, _fechaVenc: proximo.fechaVencimiento })}>
                          Registrar pago
                        </button>
                      )
                    ) : (
                      <button className="btn btn-xs btn-outline"
                        onClick={() => onRegistrarPago(s)}>
                        Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
