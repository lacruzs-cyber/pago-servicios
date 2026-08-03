import { useState, useRef } from 'react';
import Modal from './Modal';
import { fechaHoy, estimarProximoVencimiento, formatFecha } from '../utils/dateUtils';

function fechaHoyMas15() {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

/** Parsea "1.234,56" o "1234,56" o "1234.56" a número */
function parseMontoAR(str) {
  if (!str || !str.toString().trim()) return null;
  let s = str.toString().trim();
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Convierte número a formato raw "1234,56" (sin puntos de miles) */
function numToRaw(num) {
  if (num == null || isNaN(Number(num))) return '';
  const fixed = Number(num).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  return decPart === '00' ? intPart : intPart + ',' + decPart;
}

/** Formatea raw "1234,56" a display "1.234,56" */
function rawToDisplay(raw) {
  if (!raw) return '';
  const commaIdx = raw.indexOf(',');
  const intStr = commaIdx >= 0 ? raw.slice(0, commaIdx) : raw;
  const decStr = commaIdx >= 0 ? raw.slice(commaIdx + 1) : undefined;
  const formattedInt = intStr ? intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  return decStr !== undefined ? formattedInt + ',' + decStr : formattedInt;
}

export default function VencimientoForm({
  servicio,
  onGuardar,
  onCerrar,
  modoRegistroPago = false,
  modoEditar       = false,
  initialValues    = null,
}) {
  const fechaEstimada = estimarProximoVencimiento(servicio.diaEstimado);

  const montoPendiente  = servicio.montoPendiente;
  const ultimoMonto     = servicio.ultimoMonto;
  const montoReferencia = montoPendiente || ultimoMonto;

  const [form, setForm] = useState({
    fecha: modoEditar && initialValues?.fecha
      ? initialValues.fecha
      : modoRegistroPago ? fechaHoy() : fechaHoyMas15(),
    notas: modoEditar && initialValues?.notas ? initialValues.notas : '',
  });

  // Monto como string raw (sin puntos de miles), ej: "1234,56"
  const [montoRaw, setMontoRaw] = useState(() =>
    modoEditar && initialValues?.monto != null ? numToRaw(initialValues.monto) : ''
  );

  const [error, setError] = useState('');
  const montoInputRef = useRef(null);

  const montoDisplay = rawToDisplay(montoRaw);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  }

  function handleMontoKeyDown(e) {
    // Punto del teclado numerico o teclado normal → comma (separador decimal)
    if (e.key === '.' || e.key === 'Decimal' || e.key === ',') {
      e.preventDefault();
      if (!montoRaw.includes(',')) {
        setMontoRaw(prev => prev + ',');
      }
      return;
    }
    // Teclas de control permitidas
    const control = ['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Tab','Home','End','Enter'];
    if (control.includes(e.key) || e.ctrlKey || e.metaKey) return;
    // Bloquear todo lo que no sea un dígito
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  function handleMontoChange(e) {
    let val = e.target.value;
    // Quitar puntos de miles que puso el formato anterior
    val = val.replace(/\./g, '');
    // Solo digitos y una coma
    val = val.replace(/[^\d,]/g, '');
    const parts = val.split(',');
    let raw = parts[0];
    if (parts.length > 1) {
      raw += ',' + parts.slice(1).join('').slice(0, 2);
    }
    setMontoRaw(raw);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.fecha) {
      setError(modoRegistroPago ? 'La fecha de pago es obligatoria' : 'La fecha de vencimiento es obligatoria');
      return;
    }
    onGuardar({
      fecha:  form.fecha,
      monto:  parseMontoAR(montoRaw),
      notas:  form.notas.trim(),
      ...(modoRegistroPago ? { pagado: true, fechaPago: form.fecha } : {}),
    });
  }

  const titulo = modoEditar
    ? `Editar vencimiento — ${servicio.nombre}`
    : modoRegistroPago
      ? `Registrar pago — ${servicio.nombre}`
      : `Nuevo vencimiento — ${servicio.nombre}`;

  return (
    <Modal titulo={titulo} onClose={onCerrar}>
      <form onSubmit={handleSubmit} className="form">

        {modoRegistroPago && !modoEditar && (
          <div className="info-banner info-banner-green">
            ✅ Registrá un pago ya realizado. Podés ingresar una fecha pasada.
          </div>
        )}

        {!modoRegistroPago && !modoEditar && fechaEstimada && (
          <div className="info-banner">
            \U0001F4C5 Estimacion basada en tu historial: el dia <strong>{servicio.diaEstimado}</strong> de cada mes
            ({formatFecha(fechaEstimada)}). Podés cambiarla.
          </div>
        )}

        {!modoEditar && montoPendiente && (
          <div className="info-banner info-banner-orange">
            ⚠️ Monto en planilla sin pagar:{' '}
            <strong>${montoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
          </div>
        )}

        {!modoEditar && ultimoMonto && !montoPendiente && (
          <div className="info-banner info-banner-green">
            \U0001F4B0 Último valor pagado:{' '}
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
            {!modoEditar && montoReferencia && (
              <span className="form-hint">
                {' '}(referencia: ${montoReferencia.toLocaleString('es-AR', { maximumFractionDigits: 0 })})
              </span>
            )}
          </label>
          <div className="input-prefix-wrap">
            <span className="input-prefix">$</span>
            <input
              ref={montoInputRef}
              className="form-input with-prefix"
              name="monto"
              type="text"
              inputMode="decimal"
              value={montoDisplay}
              onChange={handleMontoChange}
              onKeyDown={handleMontoKeyDown}
              placeholder={!modoEditar && montoReferencia
                ? rawToDisplay(numToRaw(montoReferencia))
                : '0,00'}
            />
          </div>
          <span className="form-hint" style={{ marginTop: 4, display: 'block' }}>
            El punto del teclado numérico funciona como coma decimal
          </span>
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
            {modoEditar
              ? 'Guardar cambios'
              : modoRegistroPago
                ? '✅ Registrar pago'
                : 'Guardar y crear en Google Calendar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
