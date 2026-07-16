import { supabase } from './supabase';

const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

function fmtVenc(v) {
  return {
    id:               v.id,
    anio:             v.anio,
    mes:              v.mes,
    descripcion:      v.servicio_nombre,
    fechaVencimiento: v.fecha_vencimiento,
    fechaPago:        v.fecha_pago,
    monto:            v.monto !== null ? parseFloat(v.monto) : null,
    estado:           v.estado || 'N',
    comentarios:      v.comentarios,
    calendarEventId:  v.calendar_event_id || null,
    esManual:         v.es_manual,
    esAutoGenerado:   v.es_auto_generado,
  };
}

export async function getServicios() {
  const [{ data: servicios, error: e1 }, { data: vencimientos, error: e2 }] = await Promise.all([
    supabase.from('servicios').select('*').eq('activo', true).order('nombre'),
    supabase.from('vencimientos').select('*').order('fecha_vencimiento'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const result = (servicios || []).map(s => {
    const venc = (vencimientos || [])
      .filter(v => v.servicio_nombre.toUpperCase() === s.nombre.toUpperCase())
      .map(fmtVenc);

    const pendientes = venc.filter(v => v.estado !== 'S' && v.fechaVencimiento);
    const pagados    = venc.filter(v => v.estado === 'S' && v.monto)
                          .sort((a, b) => (b.fechaVencimiento || '').localeCompare(a.fechaVencimiento || ''));
    const proximo    = pendientes.length > 0
      ? pendientes.reduce((m, v) => v.fechaVencimiento < m.fechaVencimiento ? v : m, pendientes[0])
      : null;

    return {
      nombre:                s.nombre,
      categoria:             s.categoria,
      diaEstimado:           s.dia_estimado,
      esMama:                s.es_mama,
      permiteMultiplesPagos: s.permite_multiples_pagos || false,
      notas:                 s.notas || '',
      vencimientos:          venc,
      proximoVencimiento:    proximo,
      ultimoMonto:           pagados[0]?.monto ?? null,
      tienePendientes:       pendientes.length > 0,
    };
  });

  result.sort((a, b) => {
    const fa = a.proximoVencimiento?.fechaVencimiento;
    const fb = b.proximoVencimiento?.fechaVencimiento;
    if (!fa && !fb) return a.nombre.localeCompare(b.nombre);
    if (!fa) return 1;
    if (!fb) return -1;
    return fa.localeCompare(fb);
  });

  return result;
}

export async function crearVencimiento({ servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado, calendarEventId }) {
  if (!servicioNombre) throw new Error('Falta servicioNombre');
  const esPagado  = pagado === true;
  const fp        = esPagado ? (fechaPago || fecha) : null;
  const fechaRef  = fecha ? new Date(fecha + 'T12:00:00') : null;
  const mesNombre = fechaRef ? MESES_ES[fechaRef.getMonth()] : null;
  const anioNum   = fechaRef ? fechaRef.getFullYear() : null;

  const { data, error } = await supabase
    .from('vencimientos')
    .insert({
      servicio_nombre:   servicioNombre,
      fecha_vencimiento: fecha,
      monto:             monto || null,
      comentarios:       notas || null,
      estado:            esPagado ? 'S' : 'N',
      fecha_pago:        fp,
      mes:               mesNombre,
      anio:              anioNum,
      es_manual:         true,
      es_auto_generado:  esAutoGenerado === true,
      calendar_event_id: calendarEventId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return fmtVenc(data);
}

export async function pagarVencimiento({ id, fechaPago, monto }) {
  if (!id) throw new Error('Falta id');
  const fp = fechaPago || new Date().toISOString().slice(0, 10);
  const updates = { estado: 'S', fecha_pago: fp };
  if (monto != null) updates.monto = monto;
  const { error } = await supabase.from('vencimientos').update(updates).eq('id', id);
  if (error) throw error;
  return { ok: true, id };
}

export async function actualizarVencimiento({ id, monto, fechaVencimiento, comentarios }) {
  if (!id) throw new Error('Falta id');
  const updates = {};
  if (monto != null)        updates.monto             = monto;
  if (fechaVencimiento)     updates.fecha_vencimiento = fechaVencimiento;
  if (comentarios != null)  updates.comentarios       = comentarios;
  const { error } = await supabase.from('vencimientos').update(updates).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

export async function actualizarCalendarEvent({ id, calendarEventId }) {
  if (!id) throw new Error('Falta id');
  const { error } = await supabase.from('vencimientos')
    .update({ calendar_event_id: calendarEventId || null }).eq('id', id);
  if (error) throw error;
  return { ok: true };
}

export async function eliminarVencimiento(id) {
  const { error } = await supabase.from('vencimientos').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

export async function crearServicio({ nombre, categoria, diaEstimado, notas }) {
  if (!nombre) throw new Error('Falta nombre');
  const { data, error } = await supabase
    .from('servicios')
    .insert({ nombre, categoria: categoria || 'otros', dia_estimado: diaEstimado || null, notas: notas || '' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function actualizarServicio(nombre, { categoria, diaEstimado, notas }) {
  const updates = {};
  if (categoria)              updates.categoria    = categoria;
  if (diaEstimado != null)    updates.dia_estimado = diaEstimado;
  if (notas != null)          updates.notas        = notas;
  const { error } = await supabase.from('servicios').update(updates).eq('nombre', nombre);
  if (error) throw error;
  return { ok: true };
}

export async function eliminarServicio(nombre) {
  const { error } = await supabase.from('servicios').update({ activo: false }).eq('nombre', nombre);
  if (error) throw error;
  return { ok: true };
}

export async function getConfig() {
  const { data, error } = await supabase.from('app_settings').select('clave, valor');
  if (error) throw error;
  const map = {};
  for (const row of (data || [])) map[row.clave] = row.valor;
  return { googleClientId: map['google_client_id'] || null };
}

export async function setConfig({ googleClientId }) {
  if (googleClientId !== undefined) {
    const { error } = await supabase.from('app_settings')
      .upsert({ clave: 'google_client_id', valor: googleClientId || '' }, { onConflict: 'clave' });
    if (error) throw error;
  }
  return { ok: true };
}
