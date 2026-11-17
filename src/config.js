'use strict';

/**
 * Configuración editable desde la interfaz (sin tocar archivos a mano).
 *
 * Se guarda en data/config.json. Las variables de entorno (.env) tienen
 * prioridad, para que en Render o en un servidor se pueda fijar todo por
 * variables sin preocuparse por este archivo.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'pisac.db');

const RUTA = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH)
  : path.join(path.dirname(DB_PATH), 'config.json');

let datos = {};

function cargar() {
  try {
    const contenido = fs.readFileSync(RUTA, 'utf8');
    const json = JSON.parse(contenido);
    datos = json && typeof json === 'object' ? json : {};
  } catch (e) {
    datos = {};
  }
}
cargar();

function guardar() {
  fs.mkdirSync(path.dirname(RUTA), { recursive: true });
  fs.writeFileSync(RUTA, JSON.stringify(datos, null, 2), 'utf8');
}

function limpiarUrl(valor) {
  return String(valor || '').trim().replace(/\/+$/, '');
}

/** Client ID de Google efectivo (env > archivo). */
function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || datos.googleClientId || '').trim();
}

/** true si el Client ID viene de una variable de entorno (no se puede cambiar aquí). */
function googleDesdeEntorno() {
  return Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim());
}

/** URL pública efectiva (env > archivo > localhost). */
function baseUrl(puerto) {
  const deEntorno = limpiarUrl(process.env.BASE_URL);
  const guardada = limpiarUrl(datos.baseUrl);
  const url = deEntorno || guardada || `http://localhost:${puerto}`;
  return url;
}

function baseUrlDesdeEntorno() {
  return Boolean(limpiarUrl(process.env.BASE_URL));
}

function esLocal(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname);
  } catch (e) {
    return true;
  }
}

function setGoogleClientId(valor) {
  datos.googleClientId = String(valor || '').trim();
  guardar();
}

function setBaseUrl(valor) {
  datos.baseUrl = limpiarUrl(valor);
  guardar();
}

module.exports = {
  RUTA,
  googleClientId,
  googleDesdeEntorno,
  baseUrl,
  baseUrlDesdeEntorno,
  esLocal,
  setGoogleClientId,
  setBaseUrl
};
