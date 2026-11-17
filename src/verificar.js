'use strict';

/**
 * PISAC · Verificador de instalación
 * Ejecuta:  npm run verificar
 *
 * Revisa que todo esté listo y te dice exactamente qué falta.
 */

require('./dependencias').comprobar();

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const AMBAR = '\x1b[33m';
const AZUL = '\x1b[36m';
const GRIS = '\x1b[90m';
const NEGRITA = '\x1b[1m';
const FIN = '\x1b[0m';

const ok = `${VERDE}✔${FIN}`;
const no = `${ROJO}✘${FIN}`;
const aviso = `${AMBAR}!${FIN}`;

const problemas = [];
const pendientes = [];

function titulo(t) {
  console.log('');
  console.log(`${NEGRITA}${t}${FIN}`);
  console.log(GRIS + '─'.repeat(58) + FIN);
}

function linea(estado, texto, detalle) {
  console.log(`  ${estado} ${texto}${detalle ? GRIS + '  ' + detalle + FIN : ''}`);
}

console.log('');
console.log(`${NEGRITA}${AZUL}  PISAC · Verificación de instalación${FIN}`);
console.log(GRIS + '  Comprueba que todo esté listo para funcionar.' + FIN);

// --------------------------------------------------------- 1. Node.js ------
titulo('1. Node.js');
const v = process.version;
const mayor = Number(v.replace('v', '').split('.')[0]);
if (mayor >= 20) {
  linea(ok, `Node.js ${v}`, '(se requiere 20 o superior)');
} else {
  linea(no, `Node.js ${v}`, '(necesitas 20 o superior)');
  problemas.push('Actualiza Node.js desde https://nodejs.org');
}

// ------------------------------------------------ 2. Dependencias ----------
titulo('2. Dependencias instaladas');
const requeridas = ['express', 'better-sqlite3', 'jsonwebtoken', 'bcryptjs', 'dotenv', 'google-auth-library'];
requeridas.forEach((paquete) => {
  try {
    require.resolve(paquete);
    linea(ok, paquete);
  } catch (e) {
    linea(no, paquete, '(falta)');
    problemas.push(`Falta "${paquete}". Ejecuta:  npm install`);
  }
});

// -------------------------------------------------------- 3. Archivo .env --
titulo('3. Configuración (.env)');
const rutaEnv = path.join(__dirname, '..', '.env');
const rutaEjemplo = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(rutaEnv)) {
  linea(ok, 'Archivo .env encontrado');
} else {
  linea(aviso, 'No existe el archivo .env', '(usando valores por defecto)');
  console.log(
    `      ${GRIS}Crea uno copiando .env.example:` +
      `\n        Windows:  copy .env.example .env` +
      `\n        Mac/Linux: cp .env.example .env${FIN}`
  );
}

// ------------------------------------------------------- 4. JWT_SECRET -----
const secreto = process.env.JWT_SECRET || '';
if (secreto && secreto.length >= 16 && !secreto.includes('cambia')) {
  linea(ok, 'JWT_SECRET configurado', `(${secreto.length} caracteres)`);
} else if (secreto) {
  linea(aviso, 'JWT_SECRET es débil o de ejemplo', '(cámbialo antes de publicar)');
} else {
  linea(aviso, 'JWT_SECRET no configurado', '(usa el valor por defecto de desarrollo)');
  pendientes.push('Define JWT_SECRET en el .env antes de publicar en internet.');
}

// ----------------------------------------------------- 5. Google login -----
titulo('4. Inicio de sesión con Google');
const config = require('./config');
const clientId = config.googleClientId();

if (!clientId) {
  linea(aviso, 'Google todavía no está conectado');
  console.log(`      ${GRIS}La app mostrará un asistente para pegar el Client ID la primera vez.${FIN}`);
  console.log(`      ${GRIS}Créalo gratis en https://console.cloud.google.com → Credenciales${FIN}`);
  pendientes.push('Conectar Google desde la pantalla de acceso (solo una vez).');
} else if (!clientId.endsWith('.apps.googleusercontent.com')) {
  linea(no, 'El Client ID de Google parece incorrecto');
  console.log(`      ${GRIS}Debe terminar en  .apps.googleusercontent.com${FIN}`);
  problemas.push('Revisa que copiaste el Client ID completo.');
} else {
  linea(ok, 'Client ID de Google configurado', config.googleDesdeEntorno() ? '(.env)' : '(config.json)');
  console.log(`      ${GRIS}${clientId.slice(0, 28)}…${FIN}`);
  try {
    const { OAuth2Client } = require('google-auth-library');
    new OAuth2Client(clientId);
    linea(ok, 'Librería de Google operativa');
  } catch (e) {
    linea(no, 'No se pudo cargar google-auth-library');
    problemas.push('Ejecuta:  npm install');
  }
  const urlPublica = config.baseUrl(3000);
  console.log('');
  console.log(`  ${AMBAR}Recuerda:${FIN} agrega este origen en Google Cloud → Credenciales →`);
  console.log(`  ${GRIS}Orígenes de JavaScript autorizados:${FIN}`);
  console.log(`      http://localhost:3000`);
  if (!config.esLocal(urlPublica)) console.log(`      ${urlPublica}`);
  console.log(`  ${GRIS}Y agrégate en "Usuarios de prueba" de la pantalla de consentimiento.${FIN}`);
}

// ------------------------------------------------ 4b. URL de los enlaces --
titulo('4b. URL pública (enlaces de WhatsApp)');
const urlActual = config.baseUrl(3000);
if (config.esLocal(urlActual)) {
  linea(aviso, `Dirección local: ${urlActual}`);
  console.log(`      ${GRIS}El enlace del tutor solo abrirá en esta computadora.${FIN}`);
  console.log(`      ${GRIS}Puedes cambiarla luego desde el panel: Ajustes → URL pública.${FIN}`);
} else {
  linea(ok, `Dirección pública: ${urlActual}`);
}

// ----------------------------------------------------- 6. Base de datos -----
titulo('5. Base de datos');
try {
  const db = require('./db');
  const n = (tabla) => db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n;
  linea(ok, 'Base de datos accesible');
  console.log(`      ${GRIS}Ruta: ${db.DB_PATH}${FIN}`);
  linea(ok, `Profesores registrados: ${n('profesores')}`);
  linea(ok, `Estudiantes registrados: ${n('estudiantes')}`);
  linea(ok, `Materias registradas: ${n('materias')}`);
  linea(ok, `Notas registradas: ${n('notas')}`);
  // Nota: no se cierra la base aquí; better-sqlite3 falla al salir si se cierra
  // mientras el módulo todavía tiene sentencias preparadas.
} catch (e) {
  linea(no, 'No se pudo abrir la base de datos');
  console.log(`      ${GRIS}${e.message}${FIN}`);
  problemas.push('Revisa permisos de escritura o ejecuta:  npm rebuild better-sqlite3');
}

// ---------------------------------------------------------- 7. Escala ------
titulo('6. Escala de calificación');
const { NOTA_MAXIMA, NOTA_APROBATORIA, NIVEL_BUENO, NIVEL_EXCELENTE } = require('./reporte');
linea(ok, `Nota máxima: ${NOTA_MAXIMA}`);
linea(ok, `Aprueba desde: ${NOTA_APROBATORIA}`);
linea(ok, `Bueno desde: ${NIVEL_BUENO} · Excelente desde: ${NIVEL_EXCELENTE}`);

// -------------------------------------------------------- 8. Resumen -------
titulo('RESUMEN');

if (!problemas.length && !pendientes.length) {
  console.log(`  ${VERDE}${NEGRITA}¡Todo listo! La aplicación está preparada.${FIN}`);
  console.log(`  ${GRIS}Arranca con:  npm start${FIN}`);
} else {
  if (problemas.length) {
    console.log(`  ${ROJO}${NEGRITA}Hay ${problemas.length} problema(s) que impiden funcionar:${FIN}`);
    problemas.forEach((p, i) => console.log(`    ${i + 1}. ${p}`));
    console.log('');
  }
  if (pendientes.length) {
    console.log(`  ${AMBAR}${NEGRITA}Funciona, pero falta para que esté completo:${FIN}`);
    pendientes.forEach((p, i) => console.log(`    ${i + 1}. ${p}`));
  }
  if (!problemas.length) {
    console.log('');
    console.log(`  ${VERDE}Puedes arrancar ya con:  npm start${FIN}`);
  }
}

console.log('');
console.log(GRIS + '  Instrucciones completas en:  pisac/README.md' + FIN);
console.log('');

// Se cierra el proceso explícitamente: si no, better-sqlite3 puede fallar
// al destruir sus sentencias durante la salida (aviso nativo de Node).
process.exit(0);
