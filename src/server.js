'use strict';

// Antes que nada: comprobar que los componentes estén instalados.
require('./dependencias').comprobar();

require('dotenv').config();

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('./db');
const config = require('./config');
const { firmarToken, requiereAuth, verificarCredencialGoogle } = require('./auth');
const {
  construirReporte,
  NOTA_MAXIMA,
  NOTA_APROBATORIA,
  NIVEL_BUENO,
  NIVEL_EXCELENTE
} = require('./reporte');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// La URL publica se lee en cada peticion: el profesor puede cambiarla desde el
// panel (por ejemplo al abrir un tunel o al publicar en Render).
function baseUrlActual() {
  return config.baseUrl(PORT);
}

/** IP de la red local (Wi-Fi/LAN), para que el celular pueda abrir los enlaces. */
function ipDeRed() {
  const interfaces = os.networkInterfaces();
  for (const nombre of Object.keys(interfaces)) {
    for (const datos of interfaces[nombre] || []) {
      const familia = typeof datos.family === 'string' ? datos.family : String(datos.family);
      if ((familia === 'IPv4' || familia === '4') && !datos.internal) {
        return datos.address;
      }
    }
  }
  return null;
}

function esHostLocal(host) {
  const h = String(host || '').split(':')[0].toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

/**
 * Direccion que deben usar los enlaces del tutor. Prioridad:
 *   1. URL publica guardada o definida en BASE_URL
 *   2. El host con el que se abrio el panel (tunel, dominio, IP)
 *   3. La IP de la red local (funciona en celulares conectados al mismo Wi-Fi)
 *   4. localhost
 */
function baseUrlEfectiva(req) {
  const guardada = baseUrlActual();
  if (!config.esLocal(guardada)) return guardada;

  const host = req && req.headers ? String(req.headers.host || '') : '';
  if (host && !esHostLocal(host)) {
    const reenviado = req.headers['x-forwarded-proto'];
    const proto = reenviado ? String(reenviado).split(',')[0].trim() : (req.protocol || 'http');
    return proto + '://' + host;
  }

  const ip = ipDeRed();
  if (ip) return 'http://' + ip + ':' + PORT;
  return guardada;
}

function tipoDeBase(url) {
  if (config.esLocal(url)) return 'local';
  if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/i.test(url)) return 'red';
  return 'publica';
}

app.disable('x-powered-by');
// Limite amplio: una importacion de Excel con cientos de estudiantes pesa mas
// de los 100 KB que Express acepta por defecto.
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function numeroODefecto(valor) {
  // OJO: Number('') y Number(null) valen 0. Un campo vacio debe quedar como
  // null (sin calificar), no como un cero que hunda el promedio.
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/** Devuelve la fecha en formato YYYY-MM-DD o null si no es valida. */
function fechaISO(valor) {
  let s = texto(valor);
  if (!s) return null;
  // Acepta tambien 15/01/2026 y 15-01-2026 (formato habitual en Ecuador).
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) s = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // Numero de serie de Excel (dias desde 1899-12-30), por si llega sin formato.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial > 20000 && serial < 80000) {
      const f = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      s = f.toISOString().slice(0, 10);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [a, m, d] = s.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const real = fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
  return real ? s : null;
}

/** Valida una calificacion opcional: { ok, valor } */
function validarCalificacion(valor) {
  const n = numeroODefecto(valor);
  if (n === null) return { ok: true, valor: null };
  if (n < 0 || n > NOTA_MAXIMA) return { ok: false, valor: n };
  return { ok: true, valor: n };
}

const MENSAJE_RANGO = `La calificación debe estar entre 0 y ${NOTA_MAXIMA}.`;

function limpiarTelefono(tel) {
  return String(tel || '').replace(/[^\d]/g, '');
}

function enlaceWhatsApp(telefono, mensaje) {
  const numero = limpiarTelefono(telefono);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

function enlaceWhatsAppWeb(telefono, mensaje) {
  const numero = limpiarTelefono(telefono);
  return `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(mensaje)}`;
}

function mensajePredeterminado(reporte, mensajeExtra) {
  const { estudiante, resumen } = reporte;
  const promedio =
    resumen.promedioGeneral === null ? 'sin registros' : `${resumen.promedioGeneral}/${reporte.config.notaMaxima}`;
  const asistencia =
    resumen.porcentajeAsistencia === null ? 'sin registros' : `${resumen.porcentajeAsistencia}%`;

  const partes = [
    `Estimado/a ${estudiante.tutor_nombre}, le escribimos de la institución educativa para informarle el seguimiento académico de ${estudiante.nombres} ${estudiante.apellidos} (${estudiante.curso}).`,
    `Promedio general: ${promedio}.`,
    `Asistencia: ${asistencia}.`
  ];

  if (resumen.materiasEnRiesgo.length) {
    partes.push(`Materias con bajo rendimiento: ${resumen.materiasEnRiesgo.join(', ')}.`);
  }
  if (resumen.tareasPendientes || resumen.tareasAtrasadas) {
    const p = resumen.tareasPendientes;
    const a = resumen.tareasAtrasadas;
    partes.push(
      `Tareas: ${p} ${p === 1 ? 'pendiente' : 'pendientes'} y ${a} ${a === 1 ? 'atrasada' : 'atrasadas'}.`
    );
  }
  const extra = texto(mensajeExtra);
  if (extra) {
    partes.push(/[.!?]$/.test(extra) ? extra : extra + '.');
  }
  return partes.join(' ');
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------
// Limite simple de intentos fallidos para frenar ataques de fuerza bruta.
const intentosFallidos = new Map();
const MAX_INTENTOS = 12;
const VENTANA_INTENTOS = 15 * 60 * 1000;

function registrarIntentoFallido(clave) {
  const ahora = Date.now();
  const registro = intentosFallidos.get(clave) || { n: 0, desde: ahora };
  if (ahora - registro.desde > VENTANA_INTENTOS) {
    registro.n = 0;
    registro.desde = ahora;
  }
  registro.n += 1;
  intentosFallidos.set(clave, registro);
}

app.post('/api/auth/login', (req, res) => {
  const email = texto(req.body && req.body.email).toLowerCase();
  const password = req.body && req.body.password;
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
  }

  const clave = `${req.ip}|${email}`;
  const intentos = intentosFallidos.get(clave);
  if (intentos && intentos.n >= MAX_INTENTOS && Date.now() - intentos.desde < VENTANA_INTENTOS) {
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Espere unos minutos e intente de nuevo.'
    });
  }
  const profesor = db.prepare('SELECT * FROM profesores WHERE email = ?').get(email);
  const hash = profesor ? profesor.password_hash : '$2a$10$ikY5mJNrtLfyo6viJs.xKeJuk.Oe11g0SNlLtN6bPb/MIVSpcbXTW';
  const coincide = bcrypt.compareSync(String(password), hash);
  if (!profesor || !coincide) {
    registrarIntentoFallido(clave);
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }
  intentosFallidos.delete(clave);
  return res.json({
    token: firmarToken(profesor),
    profesor: { id: profesor.id, nombre: profesor.nombre, email: profesor.email }
  });
});

// --- Acceso directo desde la propia computadora ---------------------------
// Sirve para abrir la app sin configurar nada. Solo funciona desde localhost:
// si la app se publica en internet, esta ruta queda bloqueada.
app.post('/api/auth/local', (req, res) => {
  if (!esAccesoLocal(req)) {
    return res.status(403).json({
      error: 'El acceso directo solo está disponible en la computadora donde corre PISAC.'
    });
  }
  const email = String(process.env.ADMIN_EMAIL || 'admin@pisac.edu').toLowerCase();
  let profesor = db.prepare('SELECT * FROM profesores WHERE email = ?').get(email);
  if (!profesor) {
    profesor = db.prepare('SELECT * FROM profesores ORDER BY id LIMIT 1').get();
  }
  if (!profesor) {
    return res.status(404).json({ error: 'Todavía no hay ninguna cuenta creada.' });
  }
  return res.json({
    token: firmarToken(profesor),
    profesor: {
      id: profesor.id,
      nombre: profesor.nombre,
      email: profesor.email,
      foto: profesor.foto || null
    }
  });
});

// --- Inicio de sesion con Google (cuentas de varios profesores) -----------
// El frontend envia la credencial (ID token) que devuelve Google.
// Aqui se verifica y se crea/actualiza la cuenta del profesor.
app.post('/api/auth/google', async (req, res) => {
  const credential = texto(req.body && req.body.credential);
  if (!credential) {
    return res.status(400).json({ error: 'Falta la credencial de Google.' });
  }
  if (!config.googleClientId()) {
    return res.status(503).json({
      error: 'El inicio con Google no esta configurado. Falta GOOGLE_CLIENT_ID.'
    });
  }

  let datos;
  try {
    datos = await verificarCredencialGoogle(credential);
  } catch (err) {
    console.error('[PISAC] Google:', err.message);
    return res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
  }

  const email = String((datos && datos.email) || '').toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: 'La cuenta de Google no tiene un correo asociado.' });
  }
  if (datos.email_verified === false) {
    return res.status(401).json({ error: 'El correo de Google no esta verificado.' });
  }

  let profesor = db.prepare('SELECT * FROM profesores WHERE email = ?').get(email);

  if (!profesor) {
    // Primera vez: se registra automaticamente.
    // La contrasena queda con un valor aleatorio (la cuenta solo entra con Google).
    const nombre = texto(datos.name) || email.split('@')[0];
    const hash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
    const info = db
      .prepare(
        `INSERT INTO profesores (nombre, email, password_hash, google_id, foto, rol)
         VALUES (?, ?, ?, ?, ?, 'profesor')`
      )
      .run(nombre, email, hash, datos.sub || null, datos.picture || null);
    profesor = db.prepare('SELECT * FROM profesores WHERE id = ?').get(info.lastInsertRowid);
  } else {
    // Ya existe: se actualizan los datos que vienen de Google.
    db.prepare(
      `UPDATE profesores
          SET google_id = COALESCE(?, google_id),
              foto      = COALESCE(?, foto),
              nombre    = COALESCE(?, nombre)
        WHERE id = ?`
    ).run(datos.sub || null, datos.picture || null, texto(datos.name) || null, profesor.id);
    profesor = db.prepare('SELECT * FROM profesores WHERE id = ?').get(profesor.id);
  }

  return res.json({
    token: firmarToken(profesor),
    profesor: {
      id: profesor.id,
      nombre: profesor.nombre,
      email: profesor.email,
      foto: profesor.foto || null
    }
  });
});

app.get('/api/auth/me', requiereAuth, (req, res) => {
  const profesor = db
    .prepare('SELECT id, nombre, email, foto, rol FROM profesores WHERE id = ?')
    .get(req.profesor.id);
  res.json({ profesor });
});

/** true si la peticion viene desde esta misma computadora. */
function esAccesoLocal(req) {
  const ip = String(req.ip || '').replace('::ffff:', '');
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

app.get('/api/config', (req, res) => {
  const googleClientId = config.googleClientId();
  const baseUrl = baseUrlEfectiva(req);
  const urlGuardada = baseUrlActual();
  res.json({
    // En la propia computadora se puede entrar sin configurar Google.
    accesoLocal: esAccesoLocal(req),
    notaMaxima: NOTA_MAXIMA,
    notaAprobatoria: NOTA_APROBATORIA,
    nivelBueno: NIVEL_BUENO,
    nivelExcelente: NIVEL_EXCELENTE,
    // Si esta vacio, el frontend muestra el asistente para configurarlo.
    googleClientId: googleClientId || null,
    googleConfigurado: Boolean(googleClientId),
    googleDesdeEntorno: config.googleDesdeEntorno(),
    baseUrl,
    baseUrlTipo: tipoDeBase(baseUrl),
    ipRed: ipDeRed(),
    puerto: PORT,
    urlGuardada,
    urlPublicaGuardada: !config.esLocal(urlGuardada),
    baseUrlEsLocal: config.esLocal(baseUrl),
    baseUrlDesdeEntorno: config.baseUrlDesdeEntorno()
  });
});

/**
 * Guarda el Client ID de Google desde la propia app.
 * Solo se permite sin sesion cuando todavia no hay ninguno configurado
 * (primer arranque). Despues, cambiarlo exige estar dentro del panel.
 */
app.post('/api/config/google', (req, res) => {
  const yaConfigurado = Boolean(config.googleClientId());
  if (yaConfigurado) return requiereAuth(req, res, aplicar);
  return aplicar();

  function aplicar() {
    const id = texto(req.body && req.body.googleClientId);
    if (!id) return res.status(400).json({ error: 'Pega el Client ID de Google.' });
    if (!/\.apps\.googleusercontent\.com$/.test(id)) {
      return res.status(400).json({
        error: 'El Client ID no parece válido: debe terminar en .apps.googleusercontent.com'
      });
    }
    if (config.googleDesdeEntorno()) {
      return res.status(409).json({
        error: 'El Client ID está definido en el archivo .env. Cámbialo ahí y reinicia la app.'
      });
    }
    config.setGoogleClientId(id);
    res.json({ ok: true, googleClientId: id });
  }
});

/**
 * Ajustes del panel: URL publica (para los enlaces de WhatsApp) y, si hace
 * falta, el Client ID de Google.
 */
app.post('/api/config', requiereAuth, (req, res) => {
  const cambios = {};

  if (req.body && req.body.baseUrl !== undefined) {
    const url = texto(req.body.baseUrl);
    if (config.baseUrlDesdeEntorno()) {
      return res.status(409).json({
        error: 'La URL pública está fijada en la variable BASE_URL del archivo .env.'
      });
    }
    if (!url) {
      // Vaciar el campo quita la URL guardada y vuelve a la red local.
      config.setBaseUrl('');
      return res.json({
        ok: true,
        cambios: { baseUrl: '' },
        baseUrl: baseUrlEfectiva(req),
        baseUrlTipo: tipoDeBase(baseUrlEfectiva(req)),
        baseUrlEsLocal: config.esLocal(baseUrlEfectiva(req)),
        googleClientId: config.googleClientId() || null
      });
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'La URL no es válida. Ejemplo: https://mi-app.onrender.com' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'La URL debe empezar por http:// o https://' });
    }
    config.setBaseUrl(url);
    cambios.baseUrl = config.baseUrl(PORT);
  }

  if (req.body && req.body.googleClientId !== undefined) {
    if (config.googleDesdeEntorno()) {
      return res.status(409).json({
        error: 'El Client ID está definido en el archivo .env. Cámbialo ahí y reinicia la app.'
      });
    }
    const id = texto(req.body.googleClientId);
    if (id && !/\.apps\.googleusercontent\.com$/.test(id)) {
      return res.status(400).json({
        error: 'El Client ID no parece válido: debe terminar en .apps.googleusercontent.com'
      });
    }
    config.setGoogleClientId(id);
    cambios.googleClientId = id;
  }

  res.json({
    ok: true,
    cambios,
    baseUrl: baseUrlEfectiva(req),
    baseUrlTipo: tipoDeBase(baseUrlEfectiva(req)),
    baseUrlEsLocal: config.esLocal(baseUrlEfectiva(req)),
    googleClientId: config.googleClientId() || null
  });
});

// ---------------------------------------------------------------------------
// Estudiantes
// ---------------------------------------------------------------------------
app.get('/api/estudiantes', requiereAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM estudiantes ORDER BY apellidos, nombres').all());
});

app.post('/api/estudiantes', requiereAuth, (req, res) => {
  const nombres = texto(req.body.nombres);
  const apellidos = texto(req.body.apellidos);
  const curso = texto(req.body.curso);
  const tutor_nombre = texto(req.body.tutor_nombre);
  const tutor_telefono = texto(req.body.tutor_telefono);
  if (!nombres || !apellidos || !curso || !tutor_nombre || !tutor_telefono) {
    return res.status(400).json({ error: 'Complete todos los campos del estudiante.' });
  }
  if (limpiarTelefono(tutor_telefono).length < 7) {
    return res.status(400).json({
      error: 'El teléfono del tutor no es válido. Escríbelo con el código de país, por ejemplo +593999111222.'
    });
  }
  const info = db
    .prepare(
      `INSERT INTO estudiantes (nombres, apellidos, curso, tutor_nombre, tutor_telefono)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(nombres, apellidos, curso, tutor_nombre, tutor_telefono);
  res.status(201).json(db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/estudiantes/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const actual = db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Estudiante no encontrado.' });

  const datos = {
    nombres: texto(req.body.nombres) || actual.nombres,
    apellidos: texto(req.body.apellidos) || actual.apellidos,
    curso: texto(req.body.curso) || actual.curso,
    tutor_nombre: texto(req.body.tutor_nombre) || actual.tutor_nombre,
    tutor_telefono: texto(req.body.tutor_telefono) || actual.tutor_telefono
  };
  if (limpiarTelefono(datos.tutor_telefono).length < 7) {
    return res.status(400).json({
      error: 'El teléfono del tutor no es válido. Escríbelo con el código de país, por ejemplo +593999111222.'
    });
  }
  db.prepare(
    `UPDATE estudiantes
        SET nombres = ?, apellidos = ?, curso = ?, tutor_nombre = ?, tutor_telefono = ?
      WHERE id = ?`
  ).run(datos.nombres, datos.apellidos, datos.curso, datos.tutor_nombre, datos.tutor_telefono, id);
  res.json(db.prepare('SELECT * FROM estudiantes WHERE id = ?').get(id));
});

app.delete('/api/estudiantes/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM estudiantes WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Estudiante no encontrado.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Materias
// ---------------------------------------------------------------------------
app.get('/api/materias', requiereAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM materias ORDER BY nombre').all());
});

app.post('/api/materias', requiereAuth, (req, res) => {
  const nombre = texto(req.body.nombre);
  const docente = texto(req.body.docente);
  if (!nombre) return res.status(400).json({ error: 'El nombre de la materia es obligatorio.' });
  try {
    const info = db
      .prepare('INSERT INTO materias (nombre, docente) VALUES (?, ?)')
      .run(nombre, docente || null);
    res.status(201).json(db.prepare('SELECT * FROM materias WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una materia con ese nombre.' });
    }
    throw err;
  }
});

app.put('/api/materias/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const actual = db.prepare('SELECT * FROM materias WHERE id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Materia no encontrada.' });
  const nombre = texto(req.body.nombre) || actual.nombre;
  const docente = texto(req.body.docente) || actual.docente;
  db.prepare('UPDATE materias SET nombre = ?, docente = ? WHERE id = ?').run(nombre, docente, id);
  res.json(db.prepare('SELECT * FROM materias WHERE id = ?').get(id));
});

app.delete('/api/materias/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM materias WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Materia no encontrada.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------
app.get('/api/notas', requiereAuth, (req, res) => {
  const filtro = idValido(req.query.estudiante_id);
  const base = `SELECT n.*, e.nombres, e.apellidos, m.nombre AS materia
                  FROM notas n
                  JOIN estudiantes e ON e.id = n.estudiante_id
                  JOIN materias m ON m.id = n.materia_id`;
  const filas = filtro
    ? db.prepare(`${base} WHERE n.estudiante_id = ? ORDER BY n.fecha DESC`).all(filtro)
    : db.prepare(`${base} ORDER BY n.fecha DESC`).all();
  res.json(filas);
});

app.post('/api/notas', requiereAuth, (req, res) => {
  const estudiante_id = idValido(req.body.estudiante_id);
  const materia_id = idValido(req.body.materia_id);
  const periodo = texto(req.body.periodo);
  const calificacion = numeroODefecto(req.body.calificacion);
  if (!estudiante_id || !materia_id || !periodo || calificacion === null) {
    return res.status(400).json({ error: 'Estudiante, materia, periodo y calificación son obligatorios.' });
  }
  if (calificacion < 0 || calificacion > NOTA_MAXIMA) {
    return res.status(400).json({ error: MENSAJE_RANGO });
  }
  const fecha = texto(req.body.fecha) ? fechaISO(req.body.fecha) : null;
  if (texto(req.body.fecha) && !fecha) {
    return res.status(400).json({ error: 'La fecha de la nota no es válida.' });
  }
  const info = db
    .prepare(
      `INSERT INTO notas (estudiante_id, materia_id, periodo, calificacion, observacion, fecha)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now','localtime')))`
    )
    .run(estudiante_id, materia_id, periodo, calificacion, texto(req.body.observacion) || null, fecha);
  res.status(201).json(db.prepare('SELECT * FROM notas WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/notas/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM notas WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Nota no encontrada.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------
app.get('/api/tareas', requiereAuth, (req, res) => {
  const filtro = idValido(req.query.estudiante_id);
  const base = `SELECT t.*, e.nombres, e.apellidos, m.nombre AS materia
                  FROM tareas t
                  JOIN estudiantes e ON e.id = t.estudiante_id
                  JOIN materias m ON m.id = t.materia_id`;
  const filas = filtro
    ? db.prepare(`${base} WHERE t.estudiante_id = ? ORDER BY t.fecha_entrega DESC`).all(filtro)
    : db.prepare(`${base} ORDER BY t.fecha_entrega DESC`).all();
  res.json(filas);
});

app.post('/api/tareas', requiereAuth, (req, res) => {
  const estudiante_id = idValido(req.body.estudiante_id);
  const materia_id = idValido(req.body.materia_id);
  const titulo = texto(req.body.titulo);
  if (!estudiante_id || !materia_id || !titulo) {
    return res.status(400).json({ error: 'Estudiante, materia y título son obligatorios.' });
  }
  const estados = ['pendiente', 'entregada', 'atrasada'];
  const estado = estados.includes(req.body.estado) ? req.body.estado : 'pendiente';
  const calificacion = validarCalificacion(req.body.calificacion);
  if (!calificacion.ok) return res.status(400).json({ error: MENSAJE_RANGO });
  const fechaEntrega = texto(req.body.fecha_entrega) ? fechaISO(req.body.fecha_entrega) : null;
  if (texto(req.body.fecha_entrega) && !fechaEntrega) {
    return res.status(400).json({ error: 'La fecha de entrega no es válida.' });
  }
  const info = db
    .prepare(
      `INSERT INTO tareas (estudiante_id, materia_id, titulo, descripcion, fecha_entrega, estado, calificacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      estudiante_id,
      materia_id,
      titulo,
      texto(req.body.descripcion) || null,
      fechaEntrega,
      estado,
      calificacion.valor
    );
  res.status(201).json(db.prepare('SELECT * FROM tareas WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/tareas/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const actual = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Tarea no encontrada.' });
  const estados = ['pendiente', 'entregada', 'atrasada'];
  const estado = estados.includes(req.body.estado) ? req.body.estado : actual.estado;
  const calificacion = req.body.calificacion === undefined ? { ok: true, valor: actual.calificacion } : validarCalificacion(req.body.calificacion);
  if (!calificacion.ok) return res.status(400).json({ error: MENSAJE_RANGO });
  const fechaEntrega = req.body.fecha_entrega === undefined ? actual.fecha_entrega : fechaISO(req.body.fecha_entrega);
  if (req.body.fecha_entrega !== undefined && texto(req.body.fecha_entrega) && !fechaEntrega) {
    return res.status(400).json({ error: 'La fecha de entrega no es válida.' });
  }
  db.prepare(
    `UPDATE tareas SET titulo = ?, descripcion = ?, fecha_entrega = ?, estado = ?, calificacion = ?
      WHERE id = ?`
  ).run(
    texto(req.body.titulo) || actual.titulo,
    texto(req.body.descripcion) || actual.descripcion,
    fechaEntrega,
    estado,
    calificacion.valor,
    id
  );
  res.json(db.prepare('SELECT * FROM tareas WHERE id = ?').get(id));
});

app.delete('/api/tareas/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM tareas WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Tarea no encontrada.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Exámenes
// ---------------------------------------------------------------------------
app.get('/api/examenes', requiereAuth, (req, res) => {
  const filtro = idValido(req.query.estudiante_id);
  const base = `SELECT e.*, es.nombres, es.apellidos, m.nombre AS materia
                  FROM examenes e
                  JOIN estudiantes es ON es.id = e.estudiante_id
                  JOIN materias m ON m.id = e.materia_id`;
  const filas = filtro
    ? db.prepare(`${base} WHERE e.estudiante_id = ? ORDER BY e.fecha DESC`).all(filtro)
    : db.prepare(`${base} ORDER BY e.fecha DESC`).all();
  res.json(filas);
});

app.post('/api/examenes', requiereAuth, (req, res) => {
  const estudiante_id = idValido(req.body.estudiante_id);
  const materia_id = idValido(req.body.materia_id);
  const titulo = texto(req.body.titulo);
  if (!estudiante_id || !materia_id || !titulo) {
    return res.status(400).json({ error: 'Estudiante, materia y título son obligatorios.' });
  }
  const calificacion = validarCalificacion(req.body.calificacion);
  if (!calificacion.ok) return res.status(400).json({ error: MENSAJE_RANGO });
  const fecha = texto(req.body.fecha) ? fechaISO(req.body.fecha) : null;
  if (texto(req.body.fecha) && !fecha) {
    return res.status(400).json({ error: 'La fecha del examen no es válida.' });
  }
  const info = db
    .prepare(
      `INSERT INTO examenes (estudiante_id, materia_id, titulo, fecha, calificacion)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(estudiante_id, materia_id, titulo, fecha, calificacion.valor);
  res.status(201).json(db.prepare('SELECT * FROM examenes WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/examenes/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const actual = db.prepare('SELECT * FROM examenes WHERE id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Examen no encontrado.' });
  const calificacion = req.body.calificacion === undefined ? { ok: true, valor: actual.calificacion } : validarCalificacion(req.body.calificacion);
  if (!calificacion.ok) return res.status(400).json({ error: MENSAJE_RANGO });
  const fecha = req.body.fecha === undefined ? actual.fecha : fechaISO(req.body.fecha);
  if (req.body.fecha !== undefined && texto(req.body.fecha) && !fecha) {
    return res.status(400).json({ error: 'La fecha del examen no es válida.' });
  }
  db.prepare(
    `UPDATE examenes SET titulo = ?, fecha = ?, calificacion = ? WHERE id = ?`
  ).run(
    texto(req.body.titulo) || actual.titulo,
    fecha,
    calificacion.valor,
    id
  );
  res.json(db.prepare('SELECT * FROM examenes WHERE id = ?').get(id));
});

app.delete('/api/examenes/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM examenes WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Examen no encontrado.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Asistencia
// ---------------------------------------------------------------------------
app.get('/api/asistencia', requiereAuth, (req, res) => {
  const filtro = idValido(req.query.estudiante_id);
  const base = `SELECT a.*, e.nombres, e.apellidos
                  FROM asistencia a
                  JOIN estudiantes e ON e.id = a.estudiante_id`;
  const filas = filtro
    ? db.prepare(`${base} WHERE a.estudiante_id = ? ORDER BY a.fecha DESC`).all(filtro)
    : db.prepare(`${base} ORDER BY a.fecha DESC`).all();
  res.json(filas);
});

app.post('/api/asistencia', requiereAuth, (req, res) => {
  const estudiante_id = idValido(req.body.estudiante_id);
  const fecha = texto(req.body.fecha);
  const estados = ['presente', 'ausente', 'tarde', 'justificado'];
  const estado = req.body.estado;
  if (!estudiante_id || !fecha || !estados.includes(estado)) {
    return res.status(400).json({ error: 'Estudiante, fecha y estado válido son obligatorios.' });
  }
  const info = db
    .prepare(
      `INSERT INTO asistencia (estudiante_id, fecha, estado, observacion) VALUES (?, ?, ?, ?)`
    )
    .run(estudiante_id, fecha, estado, texto(req.body.observacion) || null);
  res.status(201).json(db.prepare('SELECT * FROM asistencia WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/asistencia/:id', requiereAuth, (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const info = db.prepare('DELETE FROM asistencia WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Registro no encontrado.' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Importación masiva desde la plantilla (Excel o CSV)
// ---------------------------------------------------------------------------

/** Convierte un encabezado en una clave simple: "Nombre del tutor" -> "nombre_del_tutor". */
function claveNormalizada(k) {
  return String(k == null ? '' : k)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Toma una fila con encabezados escritos de cualquier forma y devuelve los
 * campos internos. Ej.: "Teléfono del tutor" o "celular" -> tutor_telefono.
 */
function mapearFila(fila, alias) {
  const normal = {};
  Object.keys(fila || {}).forEach((k) => {
    normal[claveNormalizada(k)] = fila[k];
  });
  const salida = {};
  Object.keys(alias).forEach((campo) => {
    for (const posible of alias[campo]) {
      const valor = normal[posible];
      if (valor !== undefined && String(valor).trim() !== '') {
        salida[campo] = valor;
        break;
      }
    }
  });
  return salida;
}

const ALIAS = {
  estudiante: {
    nombres: ['nombres', 'nombre', 'nombres_del_estudiante', 'estudiante', 'nombres_estudiante'],
    apellidos: ['apellidos', 'apellido', 'apellidos_del_estudiante', 'apellidos_estudiante'],
    curso: ['curso', 'grado', 'paralelo', 'grado_curso', 'curso_paralelo'],
    tutor_nombre: ['tutor_nombre', 'nombre_del_tutor', 'tutor', 'representante', 'nombre_del_representante'],
    tutor_telefono: [
      'tutor_telefono', 'telefono_del_tutor', 'telefono', 'celular', 'whatsapp',
      'telefono_del_representante', 'celular_del_tutor', 'numero'
    ]
  },
  materia: {
    nombre: ['nombre', 'materia', 'asignatura', 'nombre_de_la_materia'],
    docente: ['docente', 'profesor', 'nombre_del_docente']
  },
  nota: {
    apellidos: ['apellidos', 'apellido'],
    nombres: ['nombres', 'nombre'],
    materia: ['materia', 'asignatura'],
    periodo: ['periodo', 'quimestre', 'parcial', 'trimestre'],
    calificacion: ['calificacion', 'nota', 'promedio'],
    observacion: ['observacion', 'observaciones', 'comentario'],
    fecha: ['fecha']
  }
};

function importarEstudiantes(filas) {
  const buscar = db.prepare(
    `SELECT id FROM estudiantes
      WHERE lower(nombres) = lower(?) AND lower(apellidos) = lower(?) AND lower(curso) = lower(?)`
  );
  const insertar = db.prepare(
    `INSERT INTO estudiantes (nombres, apellidos, curso, tutor_nombre, tutor_telefono)
     VALUES (?, ?, ?, ?, ?)`
  );
  const creados = [];
  const omitidos = [];
  const errores = [];

  db.transaction((lista) => {
    lista.forEach((fila, i) => {
      const f = mapearFila(fila, ALIAS.estudiante);
      const nro = i + 2; // la fila 1 son los encabezados
      const nombres = texto(f.nombres);
      const apellidos = texto(f.apellidos);
      const curso = texto(f.curso);
      const tutor_nombre = texto(f.tutor_nombre);
      const tutor_telefono = texto(f.tutor_telefono);

      if (!nombres || !apellidos || !curso || !tutor_nombre || !tutor_telefono) {
        errores.push({ fila: nro, motivo: 'Faltan datos obligatorios', datos: `${apellidos}, ${nombres}` });
        return;
      }
      if (buscar.get(nombres, apellidos, curso)) {
        omitidos.push({ fila: nro, motivo: 'Ya estaba registrado', datos: `${apellidos}, ${nombres}` });
        return;
      }
      const info = insertar.run(nombres, apellidos, curso, tutor_nombre, tutor_telefono);
      creados.push({ fila: nro, id: info.lastInsertRowid, datos: `${apellidos}, ${nombres}` });
    });
  })(filas);

  return { creados, omitidos, errores, total: filas.length };
}

function importarMaterias(filas) {
  const buscar = db.prepare('SELECT id FROM materias WHERE lower(nombre) = lower(?)');
  const insertar = db.prepare('INSERT INTO materias (nombre, docente) VALUES (?, ?)');
  const creados = [];
  const omitidos = [];
  const errores = [];

  db.transaction((lista) => {
    lista.forEach((fila, i) => {
      const f = mapearFila(fila, ALIAS.materia);
      const nro = i + 2;
      const nombre = texto(f.nombre);
      const docente = texto(f.docente);
      if (!nombre) {
        errores.push({ fila: nro, motivo: 'Falta el nombre de la materia', datos: '' });
        return;
      }
      if (buscar.get(nombre)) {
        omitidos.push({ fila: nro, motivo: 'Ya estaba registrada', datos: nombre });
        return;
      }
      const info = insertar.run(nombre, docente || null);
      creados.push({ fila: nro, id: info.lastInsertRowid, datos: nombre });
    });
  })(filas);

  return { creados, omitidos, errores, total: filas.length };
}

function importarNotas(filas) {
  const buscarEst = db.prepare(
    `SELECT id, nombres, apellidos FROM estudiantes
      WHERE lower(apellidos) = lower(?) AND lower(nombres) = lower(?)`
  );
  const buscarMat = db.prepare('SELECT id FROM materias WHERE lower(nombre) = lower(?)');
  // Una nota ya existe si coinciden estudiante, materia, periodo, calificacion
  // y fecha. Asi, subir dos veces el mismo archivo no duplica datos.
  const buscarDuplicada = db.prepare(
    `SELECT id FROM notas
      WHERE estudiante_id = ? AND materia_id = ?
        AND lower(trim(periodo)) = lower(trim(?))
        AND calificacion = ?
        AND COALESCE(fecha, '') = COALESCE(?, '')`
  );
  const insertar = db.prepare(
    `INSERT INTO notas (estudiante_id, materia_id, periodo, calificacion, observacion, fecha)
     VALUES (?, ?, ?, ?, ?, COALESCE(?, date('now','localtime')))`
  );
  const creados = [];
  const omitidos = [];
  const errores = [];

  db.transaction((lista) => {
    lista.forEach((fila, i) => {
      const f = mapearFila(fila, ALIAS.nota);
      const nro = i + 2;
      const apellidos = texto(f.apellidos);
      const nombres = texto(f.nombres);
      const materia = texto(f.materia);
      const periodo = texto(f.periodo) || 'Primer quimestre';
      const calificacion = numeroODefecto(f.calificacion);

      if (!apellidos || !nombres || !materia || calificacion === null) {
        errores.push({ fila: nro, motivo: 'Faltan apellidos, nombres, materia o calificación', datos: `${apellidos}, ${nombres}` });
        return;
      }
      if (calificacion < 0 || calificacion > NOTA_MAXIMA) {
        errores.push({ fila: nro, motivo: `La calificación debe estar entre 0 y ${NOTA_MAXIMA}`, datos: `${apellidos}, ${nombres}` });
        return;
      }
      const est = buscarEst.get(apellidos, nombres);
      if (!est) {
        errores.push({ fila: nro, motivo: 'El estudiante no existe (impórtalo primero)', datos: `${apellidos}, ${nombres}` });
        return;
      }
      const mat = buscarMat.get(materia);
      if (!mat) {
        errores.push({ fila: nro, motivo: `La materia "${materia}" no existe`, datos: `${apellidos}, ${nombres}` });
        return;
      }
      const fecha = texto(f.fecha) ? fechaISO(f.fecha) : null;
      if (texto(f.fecha) && !fecha) {
        errores.push({ fila: nro, motivo: 'La fecha no es válida (usa AAAA-MM-DD)', datos: `${apellidos}, ${nombres}` });
        return;
      }
      if (buscarDuplicada.get(est.id, mat.id, periodo, calificacion, fecha)) {
        omitidos.push({ fila: nro, motivo: 'Ya estaba registrada', datos: `${apellidos}, ${nombres} · ${materia}` });
        return;
      }
      insertar.run(
        est.id,
        mat.id,
        periodo,
        calificacion,
        texto(f.observacion) || null,
        fecha
      );
      creados.push({ fila: nro, datos: `${apellidos}, ${nombres} · ${materia}: ${calificacion}` });
    });
  })(filas);

  return { creados, omitidos, errores, total: filas.length };
}

app.post('/api/importar/estudiantes', requiereAuth, (req, res) => {
  const filas = Array.isArray(req.body && req.body.filas) ? req.body.filas : [];
  if (!filas.length) return res.status(400).json({ error: 'No se recibieron filas para importar.' });
  res.json(importarEstudiantes(filas));
});

app.post('/api/importar/materias', requiereAuth, (req, res) => {
  const filas = Array.isArray(req.body && req.body.filas) ? req.body.filas : [];
  if (!filas.length) return res.status(400).json({ error: 'No se recibieron filas para importar.' });
  res.json(importarMaterias(filas));
});

app.post('/api/importar/notas', requiereAuth, (req, res) => {
  const filas = Array.isArray(req.body && req.body.filas) ? req.body.filas : [];
  if (!filas.length) return res.status(400).json({ error: 'No se recibieron filas para importar.' });
  res.json(importarNotas(filas));
});

// ---------------------------------------------------------------------------
// Reporte interno (profesor)
// ---------------------------------------------------------------------------
app.get('/api/reporte/:estudianteId', requiereAuth, (req, res) => {
  const id = idValido(req.params.estudianteId);
  if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
  const reporte = construirReporte(id);
  if (!reporte) return res.status(404).json({ error: 'Estudiante no encontrado.' });
  res.json(reporte);
});

// ---------------------------------------------------------------------------
// Resumen del panel (una sola consulta en vez de un reporte por estudiante)
// ---------------------------------------------------------------------------
app.get('/api/resumen', requiereAuth, (req, res) => {
  const estudiantes = db
    .prepare('SELECT id, nombres, apellidos, curso, tutor_nombre FROM estudiantes ORDER BY apellidos, nombres')
    .all();
  const totalMaterias = db.prepare('SELECT COUNT(*) AS n FROM materias').get().n;

  const porMateria = db
    .prepare(
      `SELECT n.estudiante_id, n.materia_id, m.nombre AS materia, AVG(n.calificacion) AS promedio
         FROM notas n
         JOIN materias m ON m.id = n.materia_id
        GROUP BY n.estudiante_id, n.materia_id`
    )
    .all();

  const porEstudiante = new Map();
  let totalMateriasRiesgo = 0;
  for (const fila of porMateria) {
    if (!porEstudiante.has(fila.estudiante_id)) porEstudiante.set(fila.estudiante_id, []);
    const promedio = Math.round(fila.promedio * 100) / 100;
    porEstudiante.get(fila.estudiante_id).push({ materia: fila.materia, promedio });
    if (promedio < NOTA_APROBATORIA) totalMateriasRiesgo += 1;
  }

  const promedios = [];
  const enRiesgo = [];
  for (const e of estudiantes) {
    const materias = porEstudiante.get(e.id) || [];
    if (!materias.length) continue;
    const promedio = Math.round((materias.reduce((s, m) => s + m.promedio, 0) / materias.length) * 100) / 100;
    promedios.push(promedio);
    if (promedio < NOTA_APROBATORIA) {
      enRiesgo.push({
        id: e.id,
        nombres: e.nombres,
        apellidos: e.apellidos,
        curso: e.curso,
        tutor_nombre: e.tutor_nombre,
        promedio
      });
    }
  }
  enRiesgo.sort((a, b) => a.promedio - b.promedio);

  const promedioInstitucional = promedios.length
    ? Math.round((promedios.reduce((a, b) => a + b, 0) / promedios.length) * 100) / 100
    : null;

  res.json({
    totalEstudiantes: estudiantes.length,
    totalMaterias,
    totalMateriasRiesgo,
    promedioInstitucional,
    estudiantesEnRiesgo: enRiesgo
  });
});

// ---------------------------------------------------------------------------
// Notificaciones (genera el enlace para el tutor)
// ---------------------------------------------------------------------------
app.get('/api/notificaciones', requiereAuth, (req, res) => {
  const filas = db
    .prepare(
      `SELECT n.*, e.nombres, e.apellidos, e.curso, e.tutor_nombre, e.tutor_telefono
         FROM notificaciones n
         JOIN estudiantes e ON e.id = n.estudiante_id
        ORDER BY n.created_at DESC`
    )
    .all()
    .map((n) => {
      const enlace = `${baseUrlEfectiva(req)}/s/${n.token}`;
      // Se reconstruye el mensaje completo (con el enlace) para que el boton
      // de WhatsApp del historial tambien lleve al reporte.
      const reporte = construirReporte(n.estudiante_id);
      const mensaje = reporte
        ? mensajePredeterminado(reporte, n.mensaje) + ` Ver detalle: ${enlace}`
        : n.mensaje || `Seguimiento académico de ${n.nombres} ${n.apellidos}`;
      return {
        ...n,
        enlace,
        mensajeCompleto: mensaje,
        whatsapp: enlaceWhatsApp(n.tutor_telefono, mensaje),
        whatsappWeb: enlaceWhatsAppWeb(n.tutor_telefono, mensaje)
      };
    });
  res.json(filas);
});

app.post('/api/notificaciones', requiereAuth, (req, res) => {
  const estudiante_id = idValido(req.body.estudiante_id);
  if (!estudiante_id) return res.status(400).json({ error: 'Debe seleccionar un estudiante.' });

  const reporte = construirReporte(estudiante_id);
  if (!reporte) return res.status(404).json({ error: 'Estudiante no encontrado.' });

  const token = crypto.randomBytes(18).toString('hex');
  const mensaje = texto(req.body.mensaje) || null;

  const info = db
    .prepare(
      `INSERT INTO notificaciones (estudiante_id, token, mensaje, creada_por) VALUES (?, ?, ?, ?)`
    )
    .run(estudiante_id, token, mensaje, req.profesor.id);

  const enlace = `${baseUrlEfectiva(req)}/s/${token}`;
  const textoWhatsApp = mensajePredeterminado(reporte, mensaje) + ` Ver detalle: ${enlace}`;

  res.status(201).json({
    id: info.lastInsertRowid,
    token,
    enlace,
    whatsapp: enlaceWhatsApp(reporte.estudiante.tutor_telefono, textoWhatsApp),
    whatsappWeb: enlaceWhatsAppWeb(reporte.estudiante.tutor_telefono, textoWhatsApp),
    mensaje: textoWhatsApp,
    estudiante: reporte.estudiante
  });
});

// ---------------------------------------------------------------------------
// Vista pública del tutor
// ---------------------------------------------------------------------------
app.get('/api/seguimiento/:token', (req, res) => {
  const noti = db
    .prepare('SELECT * FROM notificaciones WHERE token = ?')
    .get(String(req.params.token));
  if (!noti) {
    return res.status(404).json({ error: 'Enlace no válido o expirado.' });
  }
  const reporte = construirReporte(noti.estudiante_id);
  if (!reporte) return res.status(404).json({ error: 'Estudiante no encontrado.' });
  res.json({
    ...reporte,
    notificacion: { mensaje: noti.mensaje, fecha: noti.created_at }
  });
});

app.get('/s/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'seguimiento.html'));
});

// ---------------------------------------------------------------------------
// Manejo de errores
// ---------------------------------------------------------------------------
app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // JSON mal formado enviado por el cliente
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ error: 'Los datos enviados no son un JSON válido.' });
  }
  // Cuerpo demasiado grande (importaciones muy pesadas)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'El archivo es demasiado grande. Divídelo en partes de menos de 10 MB.'
    });
  }

  console.error('[PISAC] Error:', err);
  const estado = Number(err.status) >= 400 && Number(err.status) < 600 ? Number(err.status) : 500;
  res.status(estado).json({
    error: estado === 500 ? 'Error interno del servidor.' : err.message || 'Solicitud no válida.'
  });
});

const servidor = app.listen(PORT, () => {
  console.log('');
  console.log('  PISAC - Plataforma de Interacción y Seguimiento Académico');
  console.log('  -------------------------------------------------------');
  console.log(`  Panel:     ${baseUrlActual()}/`);
  const ip = ipDeRed();
  if (ip) console.log(`  En tu red: http://${ip}:${PORT}  (celulares en el mismo Wi-Fi)`);
  console.log(`  Base de datos: ${db.DB_PATH}`);
  console.log('');
});

servidor.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(`  El puerto ${PORT} ya está ocupado por otra aplicación.`);
    console.error('  Cierra esa aplicación o arranca PISAC en otro puerto:');
    console.error(`      PORT=${PORT + 1} npm start   (Windows: set PORT=${PORT + 1} && npm start)`);
    console.error('');
    process.exit(1);
  }
  console.error('[PISAC] No se pudo iniciar el servidor:', err.message);
  process.exit(1);
});
