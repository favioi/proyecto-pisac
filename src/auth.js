'use strict';

const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('./config');

const SECRET = process.env.JWT_SECRET || 'pisac-dev-secret-cambiar-en-produccion';

let clienteGoogle = null;
let clientIdActual = '';

/**
 * Devuelve el cliente de Google usando el Client ID vigente.
 * Se recrea solo si el Client ID cambió (permite configurarlo en caliente).
 */
function obtenerClienteGoogle() {
  const id = config.googleClientId();
  if (!id) return null;
  if (!clienteGoogle || clientIdActual !== id) {
    clienteGoogle = new OAuth2Client(id);
    clientIdActual = id;
  }
  return clienteGoogle;
}

/**
 * Verifica una credencial (ID token) de "Iniciar sesion con Google".
 * Devuelve los datos de la cuenta de Google si el token es valido.
 */
async function verificarCredencialGoogle(credential) {
  const cliente = obtenerClienteGoogle();
  if (!cliente) {
    throw new Error('El inicio con Google no esta configurado (falta GOOGLE_CLIENT_ID).');
  }
  const ticket = await cliente.verifyIdToken({
    idToken: credential,
    audience: clientIdActual
  });
  return ticket.getPayload();
}

/**
 * Genera un token de sesion para un profesor.
 */
function firmarToken(profesor) {
  return jwt.sign(
    { id: profesor.id, email: profesor.email, nombre: profesor.nombre },
    SECRET,
    { expiresIn: process.env.SESSION_DURACION || '30d' }
  );
}

/**
 * Middleware que exige un token valido en la cabecera Authorization.
 */
function requiereAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'No autenticado. Inicie sesion.' });
  }
  try {
    req.profesor = jwt.verify(token, SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesion invalida o expirada.' });
  }
}

module.exports = { firmarToken, requiereAuth, verificarCredencialGoogle };
