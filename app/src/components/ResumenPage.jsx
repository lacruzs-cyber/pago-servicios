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

const SERVICIOS_OCULTOS_RESUMEN = ['MARIEL'];
const SERVICIOS_TOOLTIP_ANUAL   = ['NORA', 'ROSANA'];

function esMamaS(s) {
  return s.esMama === true || (s.categoria || '').includes('mama');
}

function calcEstado(s, mesActual) {
  const venc = s.vencimientos || [];

  if (s.permiteMultiplesPagos) {
    const anioActual = mesActual.split('-')[0];
    const pagosEsteMes = venc.filter(v =>
      v.estado === 'S' &&
      ((v.fechaPago || '').startsWith(mesActual) || (v.fechaVencimiento || '').startsWith(mesActual))
    );
    const pagosEsteAnio = venc
      .filter(v => v.estado === 'S' &&
        ((v.fechaPago || '').startsWith(anioActual) || (v.fechaVencimiento || '').startsWith(anioActual)))
      .sort((a, b) =>
        (a.fechaPago || a.fechaVencimiento || '').localeCompare(b.fechaPago || b.fechaVencimiento || ''));
    if (pagosEsteMes.length > 0) {
      return { clase: 'estado-multiple',
        label: pagosEsteMes.length + ' pago' + (pagosEsteMes.length !== 1 ? 's' : ''),
        emoji: '💰', esMama: false, pagosEsteMes, pagosEsteAnio, esMultiple: true };
    }
    return { clase: 'estado-normal', label: 'Pendiente', emoji: '🟢',
      esMama: false, pagosEsteMes: [], pagosEsteAnio, esMultiple: true };
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
      if (SERVICIOS_OCULTOS_RESUMEN.includes(s.nombre)) continue;
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
  const hoyStr = ahora.toISOString().split('T')[0];
  const en3dias = new Date(ahora); en3dias.setDate(ahora.getDate() + 3);
  const en3diasStr = en3dias.toISOString().split('T')[0];
  const montoProximos3 = filas
    .filter(f => f.estado.clase !== 'estado-pagado' && f.estado.clase !== 'estado-multiple')
    .filter(({ proximo }) => proximo?.fechaVencimiento && proximo.fechaVencimiento <= en3diasStr)
    .reduce((sum, { proximo }) => sum + (proximo?.monto || 0), 0);
  const montoEstimado = filas
    .filter(f => f.estado.clase !== 'estado-pagado' && f.estado.clase !== 'estado-multiple')
    .reduce((sum, { proximo }) => sum + (proximo?.monto || 0), 0);

  const diaTexto = DIAS_ES[ahora.getDay()] + ' ' + ahora.getDate() +
    ' de ' + MESES_LARGOS[ahora.getMonth()] + ' de ' + ahora.getFullYear();

  return (
    <div className="resumen-page">
      <div className="resumen-encabezado">
        <div className="resumen-fecha-hoy">📅 Hoy es <strong>{diaTexto}</strong></div>
        {montoProximos3 > 0 && (
          <div className="resumen-monto-est resumen-monto-urgente">
            ⚠️ A pagar en los próximos 3 días: <strong>{fmtMonto(montoProximos3)}</strong>
          </div>
        )}
        {montoEstimado > 0 && (
          <div className="resumen-monto-est">
            💵 Monto estimado pendiente: <strong>{fmtMonto(montoEstimado)}</strong>
          </div>
        )}
      </div>


      <div className="resumen-leyenda">
        <span className="leyenda-item"><span className="leyenda-icon">📅</span> Cargar vencimiento</span>
        <span className="leyenda-sep">|</span>
        <span className="leyenda-item"><span className="leyenda-icon">✅</span> Marcar como pagado</span>
      </div>

      <div className="resumen-table-wrap">
        <table className="resumen-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Servicio</th>
              <th>Vencimiento</th>
              <th>Monto</th>
              <th className="col-acciones-th">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ s, estado, proximo }) => {
              const montoExplicito = proximo?.monto != null ? proximo.monto : null;
              const montoRef = montoExplicito ?? (proximo && s.ultimoMonto ? s.ultimoMonto : null);
              const esMontoRef = montoExplicito == null && montoRef != null;
              const esMultiple = estado.esMultiple;
              const tieneMontoConocido = proximo?.monto != null;
              const esTooltipAnual = SERVICIOS_TOOLTIP_ANUAL.includes(s.nombre);
              const tooltipAnualStr = esTooltipAnual
                ? (estado.pagosEsteAnio?.length > 0
                    ? 'Pagos ' + mesActual.split('-')[0] + ':\n' +
                      estado.pagosEsteAnio.map(p => {
                        const f = p.fechaPago || p.fechaVencimiento || '';
                        return fmtFecha(f) + (p.monto != null ? ': ' + fmtMonto(p.monto) : '');
                      }).join('\n')
                    : 'Sin pagos registrados este año')
                : null;
              const ultimoPagoMes = esMultiple && estado.pagosEsteMes?.length > 0
                ? estado.pagosEsteMes[estado.pagosEsteMes.length - 1]
                : null;


              return (
                <tr key={s.nombre} className={'resumen-row ' + estado.clase}>
                  <td>
                    <span
                      className={'estado-badge ' + estado.clase}
                      title={tooltipAnualStr || undefined}
                      style={esTooltipAnual ? { cursor: 'help' } : undefined}
                    >
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
                    {esTooltipAnual
                      ? '-'
                      : esMultiple
                        ? fmtFecha(ultimoPagoMes?.fechaPago || ultimoPagoMes?.fechaVencimiento)
                        : fmtFecha(proximo?.fechaVencimiento)}
                  </td>
                  <td className="col-monto-cell">
                    {esTooltipAnual
                      ? '-'
                      : montoRef != null
                        ? <span className={esMontoRef ? 'col-monto-ref-txt' : ''}>{fmtMonto(montoRef)}</span>
                        : '-'}
                  </td>
                  <td className="col-acciones-cell">
                    <button
                      className="btn-icono btn-icono-cargar"
                      title="Cargar vencimiento"
                      onClick={() => onAgregarVencimiento(s)}
                    >📅</button>

                    <button
                      className="btn-icono btn-icono-ok"
                      title="Marcar como pagado"
                      onClick={() => onMarcarPagado(s, proximo?.id || null)}
                    >✅</button>
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
