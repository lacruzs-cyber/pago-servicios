-- ══════════════════════════════════════════════════════
--  Pago de Servicios — Schema Supabase PostgreSQL
--  Ejecutar en: Supabase → SQL Editor → New query
-- ══════════════════════════════════════════════════════

-- ── Tabla de servicios ──────────────────────────────
CREATE TABLE IF NOT EXISTS servicios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT UNIQUE NOT NULL,
  categoria    TEXT NOT NULL DEFAULT 'otros',
  dia_estimado INTEGER,
  es_mama      BOOLEAN DEFAULT false,
  notas        TEXT DEFAULT '',
  activo       BOOLEAN DEFAULT true,
  creado_en    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabla de vencimientos ───────────────────────────
CREATE TABLE IF NOT EXISTS vencimientos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servicio_nombre    TEXT NOT NULL REFERENCES servicios(nombre) ON UPDATE CASCADE ON DELETE CASCADE,
  fecha_vencimiento  DATE,
  fecha_pago         DATE,
  monto              DECIMAL(14,2),
  estado             TEXT DEFAULT 'N',   -- 'N' = pendiente, 'S' = pagado
  mes                TEXT,
  anio               INTEGER,
  comentarios        TEXT,
  es_manual          BOOLEAN DEFAULT false,
  es_auto_generado   BOOLEAN DEFAULT false,
  creado_en          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Índices ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_venc_servicio ON vencimientos(servicio_nombre);
CREATE INDEX IF NOT EXISTS idx_venc_estado   ON vencimientos(estado);
CREATE INDEX IF NOT EXISTS idx_venc_fecha    ON vencimientos(fecha_vencimiento);

-- ── Seed: Servicios ─────────────────────────────────
INSERT INTO servicios (nombre, categoria, dia_estimado, es_mama, notas) VALUES
  ('OSDE',                 'salud',           2,    false, ''),
  ('EDESUR',               'servicios',       2,    false, ''),
  ('METROGAS',             'servicios',       2,    false, ''),
  ('AYSA',                 'servicios',       8,    false, ''),
  ('MUNICIPAL',            'servicios',       8,    false, 'Tasa municipal'),
  ('CABLEVISION',          'entretenimiento', 13,   false, ''),
  ('PERSONAL',             'telefonia',       6,    false, 'Celular'),
  ('PERSONAL HOGAR',       'telefonia',       13,   false, 'Internet hogar'),
  ('MONOTRIBUTO (ROCIO)',  'impuestos',       8,    false, ''),
  ('CAJA PREVISION ROCIO', 'impuestos',       8,    false, ''),
  ('ARBA',                 'impuestos',       7,    false, 'Impuesto inmobiliario'),
  ('PATENTE DEL AUTO',     'impuestos',       14,   false, ''),
  ('SEGURO AUTO',          'seguros',         NULL, false, ''),
  ('SEGURO CAJERO',        'seguros',         NULL, false, ''),
  ('SEGURO VIDA',          'seguros',         NULL, false, ''),
  ('TARJETA NATIVA VISA',  'tarjetas',        NULL, false, ''),
  ('TARJETA NATIVA MASTER','tarjetas',        NULL, false, ''),
  ('AYSA MAMA',            'servicios_mama',  10,   true,  ''),
  ('EDESUR MAMA',          'servicios_mama',  10,   true,  ''),
  ('METROGAS MAMA',        'servicios_mama',  10,   true,  ''),
  ('IOMA MAMA',            'salud_mama',      10,   true,  ''),
  ('MUNICIPAL MAMA',       'servicios_mama',  10,   true,  ''),
  ('ARBA MAMA',            'impuestos_mama',  10,   true,  '')
ON CONFLICT (nombre) DO NOTHING;

-- ── Nota ────────────────────────────────────────────
-- Los vencimientos se cargan ejecutando:
--   cd supabase && node migrate-excel.js
-- Ese script lee gastos 2026.xlsx e inserta todas las filas.
