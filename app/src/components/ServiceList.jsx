import { useState, useMemo } from 'react';
import ServiceCard from './ServiceCard';
import { CATEGORIAS } from '../data/serviciosIniciales';

const ES_CAT_MAMA = catKey => catKey.endsWith('_mama');

export default function ServiceList({
  servicios,
  serviciosOcultos = [],
  onAgregarServicio,
  onAgregarVencimiento,
  onMarcarPagado,
  onEliminarVencimiento,
  onEditarServicio,
  onOcultarServicio,
  onMostrarServicio,
  onRegistrarPago,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [mostrarOcultos, setMostrarOcultos] = useState(false);
  const [grupoExpandido, setGrupoExpandido] = useState(null);

  function toggleGrupo(catKey) {
    setGrupoExpandido(prev => prev === catKey ? null : catKey);
  }

  const filtrados = useMemo(() => {
    return servicios
      .filter(s => {
        const matchNombre = s.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchCat = categoriaFiltro === 'todas' || s.categoria === categoriaFiltro;
        return matchNombre && matchCat;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [servicios, busqueda, categoriaFiltro]);

  const { porCategoria, serviciosMama } = useMemo(() => {
    const normal = {};
    const mama = [];
    filtrados.forEach(s => {
      if (ES_CAT_MAMA(s.categoria)) {
        mama.push(s);
      } else {
        if (!normal[s.categoria]) normal[s.categoria] = [];
        normal[s.categoria].push(s);
      }
    });
    return { porCategoria: normal, serviciosMama: mama };
  }, [filtrados]);

  const cardProps = {
    onAgregarVencimiento,
    onMarcarPagado,
    onEliminarVencimiento,
    onEditarServicio,
    onRegistrarPago,
    onOcultarServicio,
    esOculto: false,
  };

  function renderGrupo(catKey, items) {
    const cat = CATEGORIAS[catKey] || CATEGORIAS.otros;
    const abierto = grupoExpandido === catKey;
    const pendientesGrupo = items.reduce((acc, s) =>
      acc + (s.vencimientos || []).filter(v => !v.pagado && v.estado !== 'S' && (v.fecha || v.fechaVencimiento)).length, 0);
    return (
      <div key={catKey} className="category-group">
        <button
          className="category-group-title category-group-toggle"
          style={{ borderColor: cat.color }}
          onClick={() => toggleGrupo(catKey)}
        >
          <span style={{ color: cat.color }}>
            {cat.emoji} {cat.label}
            {pendientesGrupo > 0 && (
              <span className="mama-badge" style={{ marginLeft: 8 }}>
                {pendientesGrupo} pendiente{pendientesGrupo !== 1 ? 's' : ''}
              </span>
            )}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="category-count">{items.length}</span>
            <span className="mama-toggle">{abierto ? '▲' : '▼'}</span>
          </span>
        </button>
        {abierto && items.map(serv => (
          <ServiceCard key={serv.id || serv.nombre} servicio={serv} {...cardProps} />
        ))}
      </div>
    );
  }

  return (
    <div className="service-list">

      {/* Barra de herramientas */}
      <div className="list-toolbar">
        <input
          className="form-input search-input"
          placeholder="Buscar servicio..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select
          className="form-input category-filter"
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
        >
          <option value="todas">Todas las categorias</option>
          {Object.entries(CATEGORIAS).map(([key, cat]) => (
            <option key={key} value={key}>{cat.emoji} {cat.label}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={onAgregarServicio}>
          + Nuevo servicio
        </button>
      </div>

      {/* Contador */}
      <div className="list-count">
        {filtrados.length} servicio{filtrados.length !== 1 ? 's' : ''}
        {busqueda || categoriaFiltro !== 'todas' ? ' (filtrado)' : ''}
        {serviciosOcultos.length > 0 && (
          <span className="list-ocultos-hint">
            {' — '}
            <button className="btn-link" onClick={() => setMostrarOcultos(v => !v)}>
              {mostrarOcultos
                ? 'Ocultar servicios desactivados'
                : `👁️ ${serviciosOcultos.length} oculto${serviciosOcultos.length !== 1 ? 's' : ''}`
              }
            </button>
          </span>
        )}
      </div>

      {/* Grupos normales */}
      {Object.entries(porCategoria).map(([catKey, items]) => renderGrupo(catKey, items))}

      {/* Grupo unificado Mama — al final */}
      {serviciosMama.length > 0 && renderGrupo('vencimientos_mama', serviciosMama)}

      {filtrados.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No se encontraron servicios</h3>
          <p>Probá con otra búsqueda o categoría.</p>
        </div>
      )}

      {/* Servicios ocultos */}
      {mostrarOcultos && serviciosOcultos.length > 0 && (
        <div className="ocultos-section">
          <h3 className="ocultos-section-title">
            👁️ Servicios ocultos
            <span className="category-count">{serviciosOcultos.length}</span>
          </h3>
          <p className="ocultos-hint">Estos servicios no aparecen en el dashboard ni en la lista principal.</p>
          {serviciosOcultos.map(serv => (
            <ServiceCard
              key={serv.id || serv.nombre}
              servicio={serv}
              onAgregarVencimiento={onAgregarVencimiento}
              onMarcarPagado={onMarcarPagado}
              onEliminarVencimiento={onEliminarVencimiento}
              onEditarServicio={onEditarServicio}
              onRegistrarPago={onRegistrarPago}
              onOcultarServicio={nombre => onMostrarServicio(nombre)}
              esOculto={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
