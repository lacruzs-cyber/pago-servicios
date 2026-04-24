import { useState } from 'react';
import { CATEGORIAS } from '../data/serviciosIniciales';
import Modal from './Modal';

export default function ServiceForm({ servicio, onGuardar, onCerrar }) {
  const [form, setForm] = useState({
    nombre: servicio?.nombre || '',
    categoria: servicio?.categoria || 'servicios',
    diaEstimado: servicio?.diaEstimado || '',
    notas: servicio?.notas || '',
  });
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) {
      setError('El nombre del servicio es obligatorio');
      return;
    }
    onGuardar({
      ...form,
      nombre: form.nombre.trim().toUpperCase(),
      diaEstimado: form.diaEstimado ? parseInt(form.diaEstimado) : null,
    });
  }

  return (
    <Modal titulo={servicio ? 'Editar Servicio' : 'Nuevo Servicio'} onClose={onCerrar}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label className="form-label">Nombre del servicio *</label>
          <input
            className="form-input"
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            placeholder="Ej: OSDE, EDESUR, PERSONAL..."
            autoFocus
          />
          {error && <span className="form-error">{error}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Categoría</label>
          <select className="form-input" name="categoria" value={form.categoria} onChange={handleChange}>
            {Object.entries(CATEGORIAS).map(([key, cat]) => (
              <option key={key} value={key}>{cat.emoji} {cat.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            Día estimado de vencimiento
            <span className="form-hint"> (calculado desde tu historial — solo referencia)</span>
          </label>
          <input
            className="form-input"
            name="diaEstimado"
            type="number"
            min="1"
            max="31"
            value={form.diaEstimado}
            onChange={handleChange}
            placeholder="Ej: 5 (día 5 de cada mes)"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Notas</label>
          <input
            className="form-input"
            name="notas"
            value={form.notas}
            onChange={handleChange}
            placeholder="Ej: Plan familiar, cuota 3/12..."
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="btn btn-primary">
            {servicio ? 'Guardar cambios' : 'Crear servicio'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
