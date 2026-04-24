require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    esManual:         v.es_manual,
    esAutoGenerado:   v.es_auto_generado,
  };
}

// GET /api/servicios
app.get('/api/servicios', async (req, res) => {
  try {
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
        nombre:             s.nombre,
        categoria:          s.categoria,
        diaEstimado:        s.dia_estimado,
        esMama:             s.es_mama,
        notas:              s.notas || '',
        vencimientos:       venc,
        proximoVencimiento: proximo,
        ultimoMonto:        pagados[0]?.monto ?? null,
        tienePendientes:    pendientes.length > 0,
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

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vencimientos
app.get('/api/vencimientos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vencimientos').select('*').order('fecha_vencimiento');
    if (error) throw error;
    res.json((data || []).map(fmtVenc));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/vencimientos/pendientes
app.get('/api/vencimientos/pendientes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vencimientos').select('*').neq('estado', 'S').order('fecha_vencimiento');
    if (error) throw error;
    res.json((data || []).map(fmtVenc));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const MESES_ES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                  'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

// POST /api/vencimientos — crear nuevo vencimiento
app.post('/api/vencimientos', async (req, res) => {
  try {
    const { servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado } = req.body;
    if (!servicioNombre) return res.status(400).json({ error: 'Falta servicioNombre' });
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
      })
      .select()
      .single();
    if (error) throw error;
    res.json(fmtVenc(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vencimientos/pagar
app.patch('/api/vencimientos/pagar', async (req, res) => {
  try {
    const { id, fechaPago, monto } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const fp = fechaPago || new Date().toISOString().slice(0, 10);
    const updates = { estado: 'S', fecha_pago: fp };
    if (monto != null) updates.monto = monto;
    const { error } = await supabase.from('vencimientos').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vencimientos/actualizar
app.patch('/api/vencimientos/actualizar', async (req, res) => {
  try {
    const { id, monto, fechaVencimiento, comentarios } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const updates = {};
    if (monto != null)       updates.monto             = monto;
    if (fechaVencimiento)    updates.fecha_vencimiento = fechaVencimiento;
    if (comentarios != null) updates.comentarios       = comentarios;
    const { error } = await supabase.from('vencimientos').update(updates).eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/vencimientos/:id
app.delete('/api/vencimientos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('vencimientos').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servicios — crear servicio nuevo
app.post('/api/servicios', async (req, res) => {
  try {
    const { nombre, categoria, diaEstimado, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Falta nombre' });
    const { data, error } = await supabase
      .from('servicios')
      .insert({ nombre, categoria: categoria || 'otros', dia_estimado: diaEstimado || null, notas: notas || '' })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servicios/:nombre — editar servicio
app.patch('/api/servicios/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const { categoria, diaEstimado, notas } = req.body;
    const updates = {};
    if (categoria)              updates.categoria    = categoria;
    if (diaEstimado != null)    updates.dia_estimado = diaEstimado;
    if (notas != null)          updates.notas        = notas;
    const { error } = await supabase.from('servicios').update(updates).eq('nombre', nombre);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servicios/:nombre — ocultar servicio (soft delete)
app.delete('/api/servicios/:nombre', async (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const { error } = await supabase.from('servicios').update({ activo: false }).eq('nombre', nombre);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Servir frontend en produccion
if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '..', 'app', 'dist');
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Backend en http://localhost:' + PORT));