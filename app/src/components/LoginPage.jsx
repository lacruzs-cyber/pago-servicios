import { useState } from 'react';

const API = (import.meta.env.VITE_API_URL || '') + '/api';

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const r = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        sessionStorage.setItem('pagos_auth', '1');
        onLogin();
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('No se pudo conectar al servidor');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">💳</div>
        <h1 className="login-title">Pago de Servicios</h1>
        <p className="login-subtitle">Ingresá tu contraseña para continuar</p>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoFocus
              placeholder="••••••••"
              disabled={cargando}
            />
            {error && <span className="form-error">{error}</span>}
          </div>
          <button className="btn btn-primary" type="submit" disabled={cargando} style={{ width: '100%' }}>
            {cargando ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
