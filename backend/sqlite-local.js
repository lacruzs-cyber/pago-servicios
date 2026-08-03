// Envoltorio minimo para usar el modulo SQLite nativo de Node (node:sqlite)
// con la misma API que usabamos con better-sqlite3, sin depender de ningun
// binario nativo — evita los problemas de instalacion en Windows.
// Requiere Node 22.5 o superior (Sebastian tiene Node 22.15).
'use strict';
const { DatabaseSync } = require('node:sqlite');

function wrapStmt(stmt) {
  return {
    get: (...params) => stmt.get(...params),
    all: (...params) => stmt.all(...params),
    run: (...params) => {
      const info = stmt.run(...params);
      return {
        lastInsertRowid: Number(info.lastInsertRowid),
        changes: Number(info.changes),
      };
    },
  };
}

class Database {
  constructor(filePath) {
    this._db = new DatabaseSync(filePath);
  }
  pragma(str) {
    try { this._db.exec('PRAGMA ' + str); } catch { /* algunos pragmas no aplican, se ignoran */ }
  }
  exec(sql) {
    this._db.exec(sql);
  }
  prepare(sql) {
    return wrapStmt(this._db.prepare(sql));
  }
  transaction(fn) {
    const db = this;
    return (...args) => {
      db._db.exec('BEGIN');
      try {
        const result = fn(...args);
        db._db.exec('COMMIT');
        return result;
      } catch (err) {
        db._db.exec('ROLLBACK');
        throw err;
      }
    };
  }
  close() {
    this._db.close();
  }
}

module.exports = Database;
