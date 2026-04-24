// Utilidades de fecha para la app de Pago de Servicios

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function formatFecha(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatFechaCorta(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function diasHasta(dateStr) {
  if (!dateStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(dateStr + 'T12:00:00');
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
}

export function etiquetaUrgencia(dateStr) {
  const dias = diasHasta(dateStr);
  if (dias === null) return null;
  if (dias < 0) return { texto: `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`, nivel: 'vencido' };
  if (dias === 0) return { texto: 'Vence HOY', nivel: 'hoy' };
  if (dias === 1) return { texto: 'Vence mañana', nivel: 'urgente' };
  if (dias <= 2) return { texto: `En ${dias} días`, nivel: 'urgente' };
  if (dias <= 7) return { texto: `En ${dias} días`, nivel: 'proximo' };
  if (dias <= 14) return { texto: `En ${dias} días`, nivel: 'normal' };
  return { texto: `En ${dias} días`, nivel: 'lejano' };
}

export function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

export function estimarProximoVencimiento(diaEstimado) {
  if (!diaEstimado) return null;
  const hoy = new Date();
  let año = hoy.getFullYear();
  let mes = hoy.getMonth(); // 0-based

  // Construir fecha este mes
  let candidata = new Date(año, mes, diaEstimado);

  // Si ya pasó (o es hoy), ir al próximo mes
  if (candidata <= hoy) {
    mes += 1;
    if (mes > 11) { mes = 0; año += 1; }
    candidata = new Date(año, mes, diaEstimado);
  }

  return candidata.toISOString().split('T')[0];
}

export function nombreMes(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function ordenarPorFecha(vencimientos) {
  return [...vencimientos].sort((a, b) => {
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return a.fecha.localeCompare(b.fecha);
  });
}
