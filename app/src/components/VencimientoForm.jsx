import { useState } from 'react';
import Modal from './Modal';
import { fechaHoy, estimarProximoVencimiento, formatFecha } from '../utils/dateUtils';

function fechaHoyMas15() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

/** Formatea un número en estilo argentino: 1.234.567,89 */
function formatMontoAR(num) {
  if (num == null) return '';
  return Number(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parsea un string en formato AR u otros a número */
function parseMontoAR(str) {
  if (!str || !str.toString().trim()) return null;
  let s = str.toString().trim();
  if (s.includes(',')) {
    // Formato AR: punto=miles, coma=decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Sin coma: eliminar puntos (separador miles) y parsear
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export default function VencimientoForm({ servicio, onGuardar, onCerrar, modoRegistroPago = false }) {
  const fechaEstimada = estimarProximoVencimiento(servicio.diaEstimado);

  const montoPendiente  = servicio.montoPendiente;
  const ultimoMonto     = servicio.ultimoMonto;
  const montoReferencia = montoPendiente || ultimoMonto;

  const [form, setForm] = useState({
    fecha: modoRegistroPago ? fechaHoy() : fechaHoyMas15(),
    monto: montoReferencia ? formatMontoAR(montoReferencia) : '',
    notas: '',
  });
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.fecha) {
      setError(modoRegistroPago ? 'La fecha de pago es obligatoria' : 'La fecha de vencimiento es obligatoria');
      return;
    }
    onGuardar({
      fecha: form.fecha,
      monto: parseMontoAR(form.monto),
      notas: form.notas.trim(),
      ...(modoRegistroPago ? { pagado: true, fechaPago: form.fecha } : {}),
    });
  }

  const titulo = modoRegistroPago
    ? `Registrar pago — ${servicio.nombre}`
    : `Nuevo vencimiento — ${servicio.nombre}`;

  return (
    <Modal titulo={titulo} onClose={onCerrar}>
      <form onSubmit={handleSubmit} className="form">

        {modoRegistroPago && (
          <div className="info-banner info-banner-green">
            ✅ Registrá un pago ya realizado. Podés ingresar una fecha pasada.
          </div>
        )}

        {!modoRegistroPago && fechaEstimada && (
          <div className="info-banner">
            📅 Estimacion basada en tu historial: el dia <strong>{servicio.diaEstimado}</strong> de cada mes
            ({formatFecha(fechaEstimada)}). Podés cambiarla.
          </div>
        )}

        {montoPendiente && (
          <div className="info-banner info-banner-orange">
            ⚠️ Monto en planilla sin pagar:{' '}
            <strong>${montoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
          </div>
        )}

        {ultimoMonto && !montoPendiente && (
          <div className="info-banner info-banner-green">
            💰 Último valor pagado:{' '}
            <strong>${ultimoMonto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
            {' '}— solo referencia.
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            {modoRegistroPago ? 'Fecha de pago *' : 'Fecha de vencimiento *'}
          </label>
          <input
            className="form-input"
            name="fecha"
            type="date"
            value={form.fecha}
            onChange={handleChange}
            autoFocus
          />
          {error && <span className="form-error">{error}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">
            Monto
            {montoReferencia && (
              <span className="form-hint">
                {' '}(referencia: ${montoReferencia.toLocaleString('es-AR', { maximumFractionDigits: 0 })})
              </span>
            )}
          </label>
          <div className="input-prefix-wrap">
            <span className="input-prefix">$</span>
            <input
              className="form-input with-prefix"
              name="monto"
              type="text"
              inputMode="decimal"
              value={form.monto}
              onChange={handleChange}
              placeholder={montoReferencia
                ? formatMontoAR(montoReferencia)
                : '0,00'}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notas</label>
          <input
            className="form-input"
            name="notas"
            value={form.notas}
            onChange={handleChange}
            placeholder="Ej: incluye cuota seguro..."
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary">
            {modoRegistroPago ? '✅ Registrar pago' : 'Guardar y crear en Google Calendar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
