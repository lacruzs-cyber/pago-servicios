require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const Database = require('./sqlite-local');

const app = express();
app.use(cors());
app.use(express.json());

// ── Base de datos SQLite local ──────────────────────────
// Un solo archivo en disco, sin servidor externo, sin nube.
const dataDir = path.join(__dirname, 'data');
require('fs').mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'pago_servicios.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS servicios (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre                   TEXT UNIQUE NOT NULL,
    categoria                TEXT NOT NULL DEFAULT 'otros',
    dia_estimado             INTEGER,
    es_mama                  INTEGER DEFAULT 0,
    permite_multiples_pagos  INTEGER DEFAULT 0,
    notas                    TEXT DEFAULT '',
    activo                   INTEGER DEFAULT 1,
    creado_en                TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vencimientos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    servicio_nombre    TEXT NOT NULL,
    fecha_vencimiento  TEXT,
    fecha_pago         TEXT,
    monto              REAL,
    estado             TEXT DEFAULT 'N',
    mes                TEXT,
    anio               INTEGER,
    comentarios        TEXT,
    es_manual          INTEGER DEFAULT 0,
    es_auto_generado   INTEGER DEFAULT 0,
    calendar_event_id  TEXT,
    creado_en          TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_venc_servicio ON vencimientos(servicio_nombre);
  CREATE INDEX IF NOT EXISTS idx_venc_estado   ON vencimientos(estado);
  CREATE INDEX IF NOT EXISTS idx_venc_fecha    ON vencimientos(fecha_vencimiento);

  CREATE TABLE IF NOT EXISTS app_settings (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );
`);

// Seed inicial de servicios (solo si la tabla esta vacia — primer arranque)
const yaTieneServicios = db.prepare('SELECT COUNT(*) AS c FROM servicios').get().c > 0;
if (!yaTieneServicios) {
  const seed = db.prepare(`
    INSERT INTO servicios (nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas)
    VALUES (@nombre, @categoria, @dia_estimado, @es_mama, @permite_multiples_pagos, @notas)
  `);
  const servicios = [
    ['OSDE','salud',2,0,0,''],
    ['EDESUR','servicios',2,0,0,''],
    ['METROGAS','servicios',2,0,0,''],
    ['AYSA','servicios',8,0,0,''],
    ['MUNICIPAL','servicios',8,0,0,'Tasa municipal'],
    ['CABLEVISION','entretenimiento',13,0,0,''],
    ['PERSONAL','telefonia',6,0,0,'Celular'],
    ['PERSONAL MOVIL','telefonia',null,0,0,''],
    ['PERSONAL HOGAR','telefonia',13,0,0,'Internet hogar'],
    ['MONOTRIBUTO (ROCIO)','impuestos',8,0,0,''],
    ['CAJA PREVISION ROCIO','impuestos',8,0,0,''],
    ['ARBA','impuestos',7,0,0,'Impuesto inmobiliario'],
    ['PATENTE DEL AUTO','impuestos',14,0,0,''],
    ['SEGURO AUTO','seguros',null,0,0,''],
    ['SEGURO CAJERO','seguros',null,0,0,''],
    ['SEGURO VIDA','seguros',null,0,0,''],
    ['TARJETA NATIVA VISA','tarjetas',null,0,0,''],
    ['TARJETA NATIVA MASTER','tarjetas',null,0,0,''],
    ['AYSA MAMA','servicios_mama',10,1,0,''],
    ['EDESUR MAMA','servicios_mama',10,1,0,''],
    ['METROGAS MAMA','servicios_mama',10,1,0,''],
    ['IOMA MAMA','salud_mama',10,1,0,''],
    ['MUNICIPAL MAMA','servicios_mama',10,1,0,''],
    ['ARBA MAMA','impuestos_mama',10,1,0,''],
    ['NORA','otros',null,0,1,''],
    ['ROSANA','otros',null,0,1,''],
    ['MARIEL','otros',null,0,1,''],
    ['AGUINALDO NORA','otros',null,0,1,''],
    ['AGUINALDO ROSANA','otros',null,0,1,''],
  ];
  const insertMany = db.transaction((rows) => {
    for (const [nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas] of rows) {
      seed.run({ nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas });
    }
  });
  insertMany(servicios);
  console.log('Base de datos inicializada con el catalogo de servicios.');
}

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
    esManual:         !!v.es_manual,
    esAutoGenerado:   !!v.es_auto_generado,
  };
}

// GET /api/servicios — catalogo + vencimientos anidados
app.get('/api/servicios', (req, res) => {
  try {
    const servicios = db.prepare('SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre').all();
    const vencimientos = db.prepare('SELECT * FROM vencimientos ORDER BY fecha_vencimiento').all();

    const result = servicios.map(s => {
      const venc = vencimientos
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
        esMama:                !!s.es_mama,
        permiteMultiplesPagos: !!s.permite_multiples_pagos,
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

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/vencimientos — crear nuevo vencimiento
app.post('/api/vencimientos', (req, res) => {
  try {
    const { servicioNombre, fecha, monto, notas, pagado, fechaPago, esAutoGenerado, calendarEventId } = req.body;
    if (!servicioNombre) return res.status(400).json({ error: 'Falta servicioNombre' });
    const esPagado  = pagado === true;
    const fp        = esPagado ? (fechaPago || fecha) : null;
    const fechaRef  = fecha ? new Date(fecha + 'T12:00:00') : null;
    const mesNombre = fechaRef ? MESES_ES[fechaRef.getMonth()] : null;
    const anioNum   = fechaRef ? fechaRef.getFullYear() : null;

    const info = db.prepare(`
      INSERT INTO vencimientos
        (servicio_nombre, fecha_vencimiento, monto, comentarios, estado, fecha_pago, mes, anio, es_manual, es_auto_generado, calendar_event_id)
      VALUES
        (@servicio_nombre, @fecha_vencimiento, @monto, @comentarios, @estado, @fecha_pago, @mes, @anio, 1, @es_auto_generado, @calendar_event_id)
    `).run({
      servicio_nombre:  servicioNombre,
      fecha_vencimiento: fecha || null,
      monto:             monto || null,
      comentarios:       notas || null,
      estado:            esPagado ? 'S' : 'N',
      fecha_pago:        fp,
      mes:               mesNombre,
      anio:              anioNum,
      es_auto_generado:  esAutoGenerado === true ? 1 : 0,
      calendar_event_id: calendarEventId || null,
    });

    const row = db.prepare('SELECT * FROM vencimientos WHERE id = ?').get(info.lastInsertRowid);
    res.json(fmtVenc(row));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vencimientos/pagar
app.patch('/api/vencimientos/pagar', (req, res) => {
  try {
    const { id, fechaPago, monto } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const fp = fechaPago || new Date().toISOString().slice(0, 10);
    if (monto != null) {
      db.prepare('UPDATE vencimientos SET estado = ?, fecha_pago = ?, monto = ? WHERE id = ?').run('S', fp, monto, id);
    } else {
      db.prepare('UPDATE vencimientos SET estado = ?, fecha_pago = ? WHERE id = ?').run('S', fp, id);
    }
    res.json({ ok: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vencimientos/actualizar
app.patch('/api/vencimientos/actualizar', (req, res) => {
  try {
    const { id, monto, fechaVencimiento, comentarios } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const actual = db.prepare('SELECT * FROM vencimientos WHERE id = ?').get(id);
    if (!actual) return res.status(404).json({ error: 'No encontrado' });
    db.prepare(`
      UPDATE vencimientos SET
        monto             = @monto,
        fecha_vencimiento = @fecha_vencimiento,
        comentarios       = @comentarios
      WHERE id = @id
    `).run({
      id,
      monto:             monto != null ? monto : actual.monto,
      fecha_vencimiento: fechaVencimiento || actual.fecha_vencimiento,
      comentarios:       comentarios != null ? comentarios : actual.comentarios,
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/vencimientos/calendar-event — guarda el id del evento de Google Calendar
app.patch('/api/vencimientos/calendar-event', (req, res) => {
  try {
    const { id, calendarEventId } = req.body;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    db.prepare('UPDATE vencimientos SET calendar_event_id = ? WHERE id = ?').run(calendarEventId || null, id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/vencimientos/:id
app.delete('/api/vencimientos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vencimientos WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servicios — crear servicio nuevo
app.post('/api/servicios', (req, res) => {
  try {
    const { nombre, categoria, diaEstimado, notas } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Falta nombre' });
    const info = db.prepare(`
      INSERT INTO servicios (nombre, categoria, dia_estimado, notas)
      VALUES (@nombre, @categoria, @dia_estimado, @notas)
    `).run({
      nombre,
      categoria:    categoria || 'otros',
      dia_estimado: diaEstimado || null,
      notas:        notas || '',
    });
    const row = db.prepare('SELECT * FROM servicios WHERE id = ?').get(info.lastInsertRowid);
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servicios/:nombre — editar servicio
app.patch('/api/servicios/:nombre', (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    const actual = db.prepare('SELECT * FROM servicios WHERE nombre = ?').get(nombre);
    if (!actual) return res.status(404).json({ error: 'No encontrado' });
    const { categoria, diaEstimado, notas } = req.body;
    db.prepare(`
      UPDATE servicios SET categoria = @categoria, dia_estimado = @dia_estimado, notas = @notas
      WHERE nombre = @nombre
    `).run({
      nombre,
      categoria:    categoria || actual.categoria,
      dia_estimado: diaEstimado != null ? diaEstimado : actual.dia_estimado,
      notas:        notas != null ? notas : actual.notas,
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servicios/:nombre — ocultar servicio (soft delete)
app.delete('/api/servicios/:nombre', (req, res) => {
  try {
    const nombre = decodeURIComponent(req.params.nombre);
    db.prepare('UPDATE servicios SET activo = 0 WHERE nombre = ?').run(nombre);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/config — lee configuracion (ej. Google Client ID)
app.get('/api/config', (req, res) => {
  try {
    const rows = db.prepare('SELECT clave, valor FROM app_settings').all();
    const map = {};
    for (const row of rows) map[row.clave] = row.valor;
    res.json({ googleClientId: map['google_client_id'] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/config — guarda configuracion
app.patch('/api/config', (req, res) => {
  try {
    const { googleClientId } = req.body;
    if (googleClientId !== undefined) {
      db.prepare(`
        INSERT INTO app_settings (clave, valor) VALUES ('google_client_id', @valor)
        ON CONFLICT(clave) DO UPDATE SET valor = @valor
      `).run({ valor: googleClientId || '' });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Servir el frontend ya compilado (npm run build en /app) — todo en un solo puerto.
const distDir = path.join(__dirname, '..', 'app', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('');
  console.log('  Pago de Servicios corriendo en tu maquina');
  console.log('  → http://localhost:' + PORT);
  console.log('');
});
