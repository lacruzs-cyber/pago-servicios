import { useState } from 'react';
import Modal from './Modal';
import { fechaHoy, estimarProximoVencimiento, formatFecha } from '../utils/dateUtils';

export default function VencimientoForm({ servicio, onGuardar, onCerrar, modoRegistroPago = false }) {
  const fechaEstimada = estimarProximoVencimiento(servicio.diaEstimado);

  const [form, setForm] = useState({
    fecha: modoRegistroPago ? fechaHoy() : (fechaEstimada || ''),
    monto: '',
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
      monto: form.monto ? parseFloat(form.monto) : null,
      notas: form.notas.trim(),
      ...(modoRegistroPago ? { pagado: true, fechaPago: form.fecha } : {}),
    });
  }

  const montoPendiente = servicio.montoPendiente;
  const ultimoMonto = servicio.ultimoMonto;
  const montoReferencia = montoPendiente || ultimoMonto;

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
              type="number"
              min="0"
              step="0.01"
              value={form.monto}
              onChange={handleChange}
              placeholder={montoReferencia
                ? montoReferencia.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : '0.00'}
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
