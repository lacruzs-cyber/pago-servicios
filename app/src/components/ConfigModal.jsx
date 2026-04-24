import { useState } from 'react';
import Modal from './Modal';

export default function ConfigModal({ clientId, onGuardar, onCerrar }) {
  const [id, setId] = useState(clientId || '');

  return (
    <Modal titulo="⚙️ Configurar Google Calendar" onClose={onCerrar} ancho="600px">
      <div className="form">
        <div className="info-banner" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
          <strong>¿Cómo obtener tu Client ID?</strong>
          <ol style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>Ir a <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">console.cloud.google.com</a></li>
            <li>Crear un proyecto nuevo (o seleccionar uno existente)</li>
            <li>Ir a <strong>APIs y Servicios → Biblioteca</strong>, buscar y activar <strong>Google Calendar API</strong></li>
            <li>Ir a <strong>APIs y Servicios → Credenciales → Crear credencial → ID de cliente OAuth 2.0</strong></li>
            <li>Tipo de aplicación: <strong>Aplicación web</strong></li>
            <li>En "Orígenes autorizados" agregar: <code>http://localhost:5173</code></li>
            <li>Copiar el <strong>Client ID</strong> y pegarlo abajo</li>
          </ol>
        </div>

        <div className="form-group" style={{ marginTop: 16 }}>
          <label className="form-label">Google Client ID</label>
          <input
            className="form-input"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            autoFocus
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onCerrar}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() => onGuardar(id.trim())}
            disabled={!id.trim()}
          >
            Guardar y conectar
          </button>
        </div>
      </div>
    </Modal>
  );
}
