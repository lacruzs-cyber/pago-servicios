/**
 * migrate-excel.js v2
 * Importa los vencimientos del Excel a Supabase.
 * Ejecutar UNA SOLA VEZ despues de crear el schema.
 *
 * Uso:
 *   cd supabase && npm install && node migrate-excel.js
 *
 * Lee backend/.env para SUPABASE_URL y SUPABASE_SERVICE_KEY
 */

require('dotenv').config({ path: '../backend/.env' });
const XLSX   = require('xlsx');
const path   = require('path');
const fs     = require('fs');
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en backend/.env');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CONTEXTO = path.join(__dirname, '..', 'contexto');
const ARCHIVOS = [
  { file: path.join(CONTEXTO, 'gastos 2025.xlsx'), anio: 2025 },
  { file: path.join(CONTEXTO, 'gastos 2026.xlsx'), anio: 2026 },
];

const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
               'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];

const COL_FPAGO=0, COL_FVENC=1, COL_MONTO=2, COL_DESC=3,
      COL_MES=4,   COL_ESTADO=5, COL_COMENT=6;

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

function categoriaDeServicio(nombre) {
  return CATEGORIAS_MAP[nombre.toUpperCase()] || 'otros';
}

function excelDateToISO(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0,10);
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (!d) return null;
    return d.y + '-' + String(d.m).padStart(2,'0') + '-' + String(d.d).padStart(2,'0');
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0,10);
  return null;
}

function leerFilas(filePath, anio) {
  if (!fs.existsSync(filePath)) {
    console.log('No existe:', filePath, '— saltando.');
    return [];
  }
  const wb   = XLSX.readFile(filePath, { cellDates: true });
  const ws   = wb.Sheets['Hoja1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const filas = [];
  let mesActual = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;
    const mes = row[COL_MES];
    if (mes && MESES.includes(String(mes).toUpperCase()))
      mesActual = String(mes).toUpperCase();
    const desc = row[COL_DESC] ? String(row[COL_DESC]).trim() : null;
    if (!desc) continue;
    filas.push({
      servicio_nombre:   desc,
      fecha_vencimiento: excelDateToISO(row[COL_FVENC]),
      fecha_pago:        excelDateToISO(row[COL_FPAGO]),
      monto:             typeof row[COL_MONTO] === 'number' ? row[COL_MONTO] : null,
      estado:            row[COL_ESTADO] && String(row[COL_ESTADO]).trim().toUpperCase() === 'S' ? 'S' : 'N',
      mes:               mesActual,
      anio,
      comentarios:       row[COL_COMENT] ? String(row[COL_COMENT]).trim() : null,
      es_manual:         false,
      es_auto_generado:  false,
    });
  }
  return filas;
}

async function asegurarServicios(nombres) {
  // Obtener servicios ya existentes
  const { data: existentes } = await supabase.from('servicios').select('nombre');
  const existentesSet = new Set((existentes || []).map(s => s.nombre.toUpperCase()));

  const nuevos = [...new Set(nombres)]
    .filter(n => !existentesSet.has(n.toUpperCase()))
    .map(nombre => ({
      nombre,
      categoria: categoriaDeServicio(nombre),
      es_mama: nombre.toUpperCase().includes('MAMA'),
      notas: '',
    }));

  if (nuevos.length === 0) {
    console.log('Todos los servicios ya existen en la tabla.');
    return;
  }

  console.log('Insertando', nuevos.length, 'servicios nuevos encontrados en el Excel:');
  nuevos.forEach(s => console.log('  +', s.nombre, '(' + s.categoria + ')'));

  const { error } = await supabase.from('servicios').insert(nuevos);
  if (error) {
    console.error('Error insertando servicios:', error.message);
    throw error;
  }
}

async function main() {
  console.log('Iniciando migracion Excel -> Supabase...\n');

  // 1. Leer todas las filas de los archivos Excel
  const todasFilas = [];
  for (const { file, anio } of ARCHIVOS) {
    const filas = leerFilas(file, anio);
    if (filas.length) console.log('Leidas', filas.length, 'filas del anio', anio);
    todasFilas.push(...filas);
  }

  if (todasFilas.length === 0) {
    console.log('No se encontraron filas para migrar.');
    return;
  }

  // 2. Asegurar que todos los servicios del Excel existen en la tabla
  const nombresUnicos = [...new Set(todasFilas.map(f => f.servicio_nombre))];
  await asegurarServicios(nombresUnicos);

  // 3. Insertar vencimientos en lotes de 100
  console.log('\nInsertando', todasFilas.length, 'vencimientos...');
  let insertados = 0;
  let errores = 0;

  for (let i = 0; i < todasFilas.length; i += 100) {
    const lote = todasFilas.slice(i, i + 100);
    const { error } = await supabase.from('vencimientos').insert(lote);
    if (error) {
      console.error('Error en lote ' + i + ':', error.message);
      errores += lote.length;
    } else {
      insertados += lote.length;
    }
  }

  console.log('\nMigracion completa:');
  console.log('  Insertados:', insertados, 'vencimientos');
  if (errores > 0) console.log('  Con error: ', errores);
}

main().catch(e => { console.error(e); process.exit(1); });