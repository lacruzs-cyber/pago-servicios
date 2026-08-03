// ══════════════════════════════════════════════════════════════
//  Migracion Excel → SQLite local (sin pasar por Supabase)
//  Se corre UNA SOLA VEZ. Lee contexto/gastos 2026.xlsx (y
//  gastos 2025.xlsx si existe) y carga todo en
//  backend/data/pago_servicios.db.
//
//  Uso:
//    cd supabase
//    npm install
//    node migrate-excel-to-sqlite.js
// ══════════════════════════════════════════════════════════════
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Database = require('./sqlite-local');

const CONTEXTO = path.join(__dirname, '..', 'contexto');
const ARCHIVOS = [
  { file: path.join(CONTEXTO, 'gastos 2025.xlsx'), anio: 2025 },
  { file: path.join(CONTEXTO, 'gastos 2026.xlsx'), anio: 2026 },
];

const dbPath = path.join(__dirname, '..', 'backend', 'data', 'pago_servicios.db');

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
               'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

const COL_FPAGO = 0, COL_FVENC = 1, COL_MONTO = 2, COL_DESC = 3,
      COL_MES = 4, COL_ESTADO = 5, COL_COMENT = 6;

const CATEGORIAS_MAP = {
  'OSDE': 'salud', 'IOMA MAMA': 'salud_mama',
  'EDESUR': 'servicios', 'EDESUR MAMA': 'servicios_mama',
  'METROGAS': 'servicios', 'METROGAS MAMA': 'servicios_mama',
  'AYSA': 'servicios', 'AYSA MAMA': 'servicios_mama',
  'MUNICIPAL': 'servicios', 'MUNICIPAL MAMA': 'servicios_mama',
  'CABLEVISION': 'entretenimiento',
  'PERSONAL': 'telefonia', 'PERSONAL MOVIL': 'telefonia', 'PERSONAL HOGAR': 'telefonia',
  'MONOTRIBUTO (ROCIO)': 'impuestos', 'CAJA PREVISION ROCIO': 'impuestos',
  'ARBA': 'impuestos', 'ARBA MAMA': 'impuestos_mama',
  'PATENTE DEL AUTO': 'impuestos',
  'SEGURO AUTO': 'seguros', 'SEGURO CAJERO': 'seguros', 'SEGURO VIDA': 'seguros',
  'TARJETA NATIVA VISA': 'tarjetas', 'TARJETA NATIVA MASTER': 'tarjetas',
};

// Catalogo base documentado en CLAUDE.md — se carga siempre, aunque el
// Excel no tenga filas para alguno de estos (ej: CABLEVISION).
const BASE_SERVICIOS = [
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

const SERVICIOS_MULTIPLES_PAGOS = new Set(['NORA', 'ROSANA', 'MARIEL', 'AGUINALDO NORA', 'AGUINALDO ROSANA']);

function categoriaDeServicio(nombre) {
  return CATEGORIAS_MAP[nombre.toUpperCase()] || 'otros';
}

function excelDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
  return null;
}

function leerFilas(filePath, anio) {
  if (!fs.existsSync(filePath)) {
    console.log('No existe:', filePath, '— saltando.');
    return [];
  }
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets['Hoja1'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const filas = [];
  let mesActual = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;
    const mes = row[COL_MES];
    if (mes && MESES.includes(String(mes).toUpperCase())) mesActual = String(mes).toUpperCase();
    const desc = row[COL_DESC] ? String(row[COL_DESC]).trim() : null;
    if (!desc) continue;
    filas.push({
      servicio_nombre: desc,
      fecha_vencimiento: excelDateToISO(row[COL_FVENC]),
      fecha_pago: excelDateToISO(row[COL_FPAGO]),
      monto: typeof row[COL_MONTO] === 'number' ? row[COL_MONTO] : null,
      estado: row[COL_ESTADO] && String(row[COL_ESTADO]).trim().toUpperCase() === 'S' ? 'S' : 'N',
      mes: mesActual,
      anio,
      comentarios: row[COL_COMENT] ? String(row[COL_COMENT]).trim() : null,
    });
  }
  return filas;
}

function main() {
  console.log('Leyendo Excel...\n');
  let todasFilas = [];
  for (const { file, anio } of ARCHIVOS) {
    const filas = leerFilas(file, anio);
    if (filas.length) console.log('Leidas', filas.length, 'filas del anio', anio, '(' + path.basename(file) + ')');
    todasFilas.push(...filas);
  }

  if (todasFilas.length === 0) {
    console.log('No se encontraron filas para migrar.');
    return;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
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

  // Vacia lo que haya (por si se corre mas de una vez) y recarga todo desde el Excel
  db.exec('DELETE FROM vencimientos; DELETE FROM servicios; DELETE FROM app_settings;');

  const insertServicio = db.prepare(`
    INSERT INTO servicios (nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas, activo)
    VALUES (@nombre, @categoria, @dia_estimado, @es_mama, @permite_multiples_pagos, @notas, 1)
  `);
  const insertVencimiento = db.prepare(`
    INSERT INTO vencimientos
      (servicio_nombre, fecha_vencimiento, fecha_pago, monto, estado, mes, anio, comentarios, es_manual, es_auto_generado)
    VALUES
      (@servicio_nombre, @fecha_vencimiento, @fecha_pago, @monto, @estado, @mes, @anio, @comentarios, 0, 0)
  `);

  // Nombre "canonico" tal como aparece la primera vez en el Excel, indexado por nombre en mayusculas
  const nombreOriginal = {};
  for (const f of todasFilas) {
    const key = f.servicio_nombre.trim().toUpperCase();
    if (!nombreOriginal[key]) nombreOriginal[key] = f.servicio_nombre.trim();
  }

  const cargarTodo = db.transaction(() => {
    // 1. Catalogo base documentado (siempre disponible, tenga o no filas en el Excel)
    const yaInsertados = new Set();
    for (const [nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas] of BASE_SERVICIOS) {
      insertServicio.run({ nombre, categoria, dia_estimado, es_mama, permite_multiples_pagos, notas });
      yaInsertados.add(nombre.toUpperCase());
    }

    // 2. Servicios extra encontrados en el Excel que no estan en el catalogo base
    //    (ej: entradas historicas puntuales como "AYSA 1", "CAMPAMENTO NES", etc.)
    for (const key of Object.keys(nombreOriginal)) {
      if (yaInsertados.has(key)) continue;
      const nombre = nombreOriginal[key];
      insertServicio.run({
        nombre,
        categoria: categoriaDeServicio(nombre),
        dia_estimado: null,
        es_mama: key.includes('MAMA') ? 1 : 0,
        permite_multiples_pagos: SERVICIOS_MULTIPLES_PAGOS.has(key) ? 1 : 0,
        notas: '',
      });
      yaInsertados.add(key);
    }

    // 3. Vencimientos
    for (const f of todasFilas) {
      const key = f.servicio_nombre.trim().toUpperCase();
      insertVencimiento.run({
        servicio_nombre: nombreOriginal[key],
        fecha_vencimiento: f.fecha_vencimiento,
        fecha_pago: f.fecha_pago,
        monto: f.monto,
        estado: f.estado,
        mes: f.mes,
        anio: f.anio,
        comentarios: f.comentarios,
      });
    }

    return { servicios: yaInsertados.size, vencimientos: todasFilas.length };
  });

  const resultado = cargarTodo();
  db.close();

  console.log('');
  console.log('Listo:', resultado.servicios, 'servicios y', resultado.vencimientos, 'vencimientos cargados en backend/data/pago_servicios.db');
  console.log('Ojo: esto solo tiene lo que estaba en el Excel — lo que cargaste a mano en la app despues de migrar a Supabase (desde abril) no esta incluido.');
}

main();
