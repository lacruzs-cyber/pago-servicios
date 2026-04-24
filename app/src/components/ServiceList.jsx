import { useState, useMemo } from 'react';
import ServiceCard from './ServiceCard';
import { CATEGORIAS } from '../data/serviciosIniciales';

const ES_MAMA = nombre => nombre.toUpperCase().includes('MAMA') || nombre.toUpperCase().includes('MAMÁ');

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
  const [mamaExpandido, setMamaExpandido] = useState(true);

  const serviciosPropios = useMemo(() =>
    servicios.filter(s => !ES_MAMA(s.nombre)), [servicios]);

  const serviciosMama = useMemo(() =>
    servicios.filter(s => ES_MAMA(s.nombre)), [servicios]);

  const propiosFiltrados = useMemo(() => {
    return serviciosPropios
      .filter(s => {
        const matchNombre = s.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchCat = categoriaFiltro === 'todas' || s.categoria === categoriaFiltro;
        return matchNombre && matchCat;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [serviciosPropios, busqueda, categoriaFiltro]);

  const porCategoria = useMemo(() => {
    const grupos = {};
    propiosFiltrados.forEach(s => {
      if (!grupos[s.categoria]) grupos[s.categoria] = [];
      grupos[s.categoria].push(s);
    });
    return grupos;
  }, [propiosFiltrados]);

  // Pendientes mama para el badge del encabezado
  const mamaPendientesCount = useMemo(() =>
    serviciosMama.reduce((acc, s) => acc + (s.vencimientos || []).filter(v => {
      const pagado = v.pagado === true || v.estado === 'S';
      return !pagado && (v.fecha || v.fechaVencimiento);
    }).length, 0),
  [serviciosMama]);

  const cardProps = {
    onAgregarVencimiento,
    onMarcarPagado,
    onEliminarVencimiento,
    onEditarServicio,
    onRegistrarPago,
    onOcultarServicio,
    esOculto: false,
  };

  return (
    <div className="service-list">

      {/* Barra de herramientas */}
      <div className="list-toolbar">
        <input
          className="form-input search-input"
          placeholder="🔍 Buscar servicio..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select
          className="form-input category-filter"
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
        >
          <option value="todas">Todas las categorías</option>
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
        {propiosFiltrados.length} servicio{propiosFiltrados.length !== 1 ? 's' : ''}
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

      {/* —— Sección Mamá —— */}
      {serviciosMama.length > 0 && (
        <div className="mama-section">
          <button
            className="mama-section-header"
            onClick={() => setMamaExpandido(v => !v)}
          >
            <span className="mama-title">
              👶 Servicios Mamá
              {mamaPendientesCount > 0 && (
                <span className="mama-badge">{mamaPendientesCount} pendiente{mamaPendientesCount !== 1 ? 's' : ''}</span>
              )}
            </span>
            <span className="mama-toggle">{mamaExpandido ? '▲' : '▼'}</span>
          </button>

          {mamaExpandido && (
            <div className="mama-body">
              <p className="mama-hint">
                📅 Vencen el <strong>día 10</strong> de cada mes — se generan automáticamente el 1ro.
              </p>
              <div className="mama-grid">
                {serviciosMama.map(serv => (
                  <ServiceCard
                    key={serv.id || serv.nombre}
                    servicio={serv}
                    {...cardProps}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* —— Lista principal por categoría —— */}
      {Object.entries(porCategoria).map(([catKey, items]) => {
        const cat = CATEGORIAS[catKey] || CATEGORIAS.otros;
        return (
          <div key={catKey} className="category-group">
            <h3 className="category-group-title" style={{ borderColor: cat.color }}>
              <span style={{ color: cat.color }}>{cat.emoji} {cat.label}</span>
              <span className="category-count">{items.length}</span>
            </h3>
            {items.map(serv => (
              <ServiceCard key={serv.id || serv.nombre} servicio={serv} {...cardProps} />
            ))}
          </div>
        );
      })}

      {propiosFiltrados.length === 0 && serviciosMama.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No se encontraron servicios</h3>
          <p>Probá con otra búsqueda o categoría.</p>
        </div>
      )}

      {/* —— Servicios ocultos —— */}
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
