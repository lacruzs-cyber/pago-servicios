// ══════════════════════════════════════════════════════════════
//  Migracion Supabase → SQLite local
//  Se corre UNA SOLA VEZ, desde tu maquina (necesita internet
//  para leer de Supabase). Despues de correrlo, la app ya no
//  necesita conexion a Supabase nunca mas.
//
//  Uso:
//    cd supabase
//    npm install
//    node migrate-to-sqlite.js
// ══════════════════════════════════════════════════════════════
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://himchcizeowsfihxtimj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_jZTQ9QUf5OYdloa_orP4oA_w90ughE8';

const dbPath = path.join(__dirname, '..', 'backend', 'data', 'pago_servicios.db');

async function main() {
  console.log('Conectando a Supabase para leer los datos actuales...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Trae TODAS las filas paginando (Supabase corta en 1000 por defecto)
  async function traerTodo(tabla, orderBy) {
    let todas = [];
    let desde = 0;
    const pageSize = 500;
    while (true) {
      let q = supabase.from(tabla).select('*').range(desde, desde + pageSize - 1);
      if (orderBy) q = q.order(orderBy);
      const { data, error } = await q;
      if (error) throw new Error(`Error leyendo ${tabla}: ${error.message}`);
      todas = todas.concat(data || []);
      if (!data || data.length < pageSize) break;
      desde += pageSize;
    }
    return todas;
  }

  const servicios = await traerTodo('servicios', 'nombre');
  const vencimientos = await traerTodo('vencimientos', 'id');
  const appSettings = await traerTodo('app_settings');

  console.log(`Encontrados: ${servicios.length} servicios, ${vencimientos.length} vencimientos, ${appSettings.length} configuraciones.`);

  if (!fs.existsSync(path.dirname(dbPath))) {
    console.error('No existe backend/data — corre primero "npm start" una vez (aunque falle) para que se cree la base, o crea la carpeta backend/data manualmente.');
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Asegura que existan las tablas (mismo esquema que backend/server.js)
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

  // Vacia lo que haya (por si se corre mas de una vez) y vuelve a cargar todo desde Supabase
  db.exec('DELETE FROM vencimientos; DELETE FROM servicios; DELETE FROM app_settings;');

  const insertServicio = db.prepare(`
    INSERT INTO servicios (nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas, activo)
    VALUES (@nombre, @categoria, @dia_estimado, @es_mama, @permite_multiples_pagos, @notas, @activo)
  `);
  const insertVencimiento = db.prepare(`
    INSERT INTO vencimientos
      (servicio_nombre, fecha_vencimiento, fecha_pago, monto, estado, mes, anio, comentarios, es_manual, es_auto_generado, calendar_event_id)
    VALUES
      (@servicio_nombre, @fecha_vencimiento, @fecha_pago, @monto, @estado, @mes, @anio, @comentarios, @es_manual, @es_auto_generado, @calendar_event_id)
  `);
  const insertConfig = db.prepare(`INSERT INTO app_settings (clave, valor) VALUES (@clave, @valor)`);

  const cargarTodo = db.transaction(() => {
    for (const s of servicios) {
      insertServicio.run({
        nombre: s.nombre,
        categoria: s.categoria || 'otros',
        dia_estimado: s.dia_estimado,
        es_mama: s.es_mama ? 1 : 0,
        permite_multiples_pagos: s.permite_multiples_pagos ? 1 : 0,
        notas: s.notas || '',
        activo: s.activo ? 1 : 0,
      });
    }
    for (const v of vencimientos) {
      insertVencimiento.run({
        servicio_nombre: v.servicio_nombre,
        fecha_vencimiento: v.fecha_vencimiento,
        fecha_pago: v.fecha_pago,
        monto: v.monto,
        estado: v.estado || 'N',
        mes: v.mes,
        anio: v.anio,
        comentarios: v.comentarios,
        es_manual: v.es_manual ? 1 : 0,
        es_auto_generado: v.es_auto_generado ? 1 : 0,
        calendar_event_id: v.calendar_event_id,
      });
    }
    for (const c of appSettings) {
      insertConfig.run({ clave: c.clave, valor: c.valor });
    }
  });

  cargarTodo();
  db.close();

  console.log('');
  console.log('Listo. Datos migrados a backend/data/pago_servicios.db');
  console.log('Ya podes borrar el proyecto de Supabase cuando quieras.');
}

main().catch(err => {
  console.error('Fallo la migracion:', err.message);
  process.exit(1);
});
