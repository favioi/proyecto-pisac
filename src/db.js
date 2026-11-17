'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'pisac.db');

// Asegura que exista la carpeta de datos.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
// Si dos peticiones escriben a la vez, espera en lugar de fallar con SQLITE_BUSY.
db.pragma('busy_timeout = 5000');

/**
 * Crea las tablas si no existen.
 */
function crearEsquema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profesores (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      google_id     TEXT,
      foto          TEXT,
      rol           TEXT NOT NULL DEFAULT 'profesor',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estudiantes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nombres         TEXT NOT NULL,
      apellidos       TEXT NOT NULL,
      curso           TEXT NOT NULL,
      tutor_nombre    TEXT NOT NULL,
      tutor_telefono  TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materias (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL UNIQUE,
      docente     TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      materia_id     INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
      periodo        TEXT NOT NULL,
      calificacion   REAL NOT NULL,
      observacion    TEXT,
      fecha          TEXT NOT NULL DEFAULT (date('now','localtime')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      materia_id     INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
      titulo         TEXT NOT NULL,
      descripcion    TEXT,
      fecha_entrega  TEXT,
      estado         TEXT NOT NULL DEFAULT 'pendiente',
      calificacion   REAL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS examenes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      materia_id     INTEGER NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
      titulo         TEXT NOT NULL,
      fecha          TEXT,
      calificacion   REAL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS asistencia (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      estado         TEXT NOT NULL,
      observacion    TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id  INTEGER NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
      token          TEXT NOT NULL UNIQUE,
      mensaje        TEXT,
      creada_por     INTEGER REFERENCES profesores(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notas_estudiante     ON notas(estudiante_id);
    CREATE INDEX IF NOT EXISTS idx_tareas_estudiante    ON tareas(estudiante_id);
    CREATE INDEX IF NOT EXISTS idx_examenes_estudiante  ON examenes(estudiante_id);
    CREATE INDEX IF NOT EXISTS idx_asistencia_estudiante ON asistencia(estudiante_id);
    CREATE INDEX IF NOT EXISTS idx_notificaciones_token ON notificaciones(token);
  `);
}

/**
 * Agrega columnas nuevas a bases de datos que ya existian antes.
 * (SQLite no permite cambiar columnas, pero si agregarlas.)
 */
function migrar() {
  const columnas = db.prepare('PRAGMA table_info(profesores)').all().map((c) => c.name);
  const faltantes = [
    ['google_id', 'TEXT'],
    ['foto', 'TEXT'],
    ['rol', "TEXT NOT NULL DEFAULT 'profesor'"]
  ];
  faltantes.forEach(([nombre, tipo]) => {
    if (!columnas.includes(nombre)) {
      db.exec(`ALTER TABLE profesores ADD COLUMN ${nombre} ${tipo}`);
    }
  });
}

/**
 * Crea el profesor administrador y el catalogo de materias la primera vez.
 */
function sembrar() {
  const totalProfesores = db.prepare('SELECT COUNT(*) AS n FROM profesores').get().n;
  if (totalProfesores === 0) {
    const nombre = process.env.ADMIN_NOMBRE || 'Prof. Administrador';
    const email = (process.env.ADMIN_EMAIL || 'admin@pisac.edu').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare(
      'INSERT INTO profesores (nombre, email, password_hash) VALUES (?, ?, ?)'
    ).run(nombre, email, bcrypt.hashSync(password, 10));
  }

  const totalMaterias = db.prepare('SELECT COUNT(*) AS n FROM materias').get().n;
  if (totalMaterias === 0) {
    const materias = [
      ['Matemáticas', ''],
      ['Lengua y Literatura', ''],
      ['Ciencias Naturales', ''],
      ['Estudios Sociales', ''],
      ['Inglés', ''],
      ['Educación Física', '']
    ];
    const insert = db.prepare('INSERT INTO materias (nombre, docente) VALUES (?, ?)');
    const tx = db.transaction((lista) => lista.forEach((m) => insert.run(m[0], m[1])));
    tx(materias);
  }
}

crearEsquema();
migrar();
sembrar();

module.exports = db;
module.exports.DB_PATH = DB_PATH;
