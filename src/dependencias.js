'use strict';

/**
 * Comprueba que las dependencias estén instaladas antes de arrancar.
 * Si falta alguna, muestra un mensaje claro en lugar del error técnico
 * "Cannot find module ..." con toda la traza de Node.
 */

const MODULOS = [
  'dotenv',
  'express',
  'better-sqlite3',
  'jsonwebtoken',
  'bcryptjs',
  'google-auth-library'
];

function faltantes() {
  // Se cargan de verdad: así también se detecta un módulo nativo dañado
  // (por ejemplo better-sqlite3 compilado para otra versión de Node).
  return MODULOS.filter((modulo) => {
    try {
      require(modulo);
      return false;
    } catch (e) {
      return true;
    }
  });
}

function comprobarNode() {
  var mayor = Number(String(process.versions.node).split('.')[0]);
  if (mayor >= 20) return true;

  console.error('');
  console.error('  ====================================================');
  console.error('   PISAC necesita una version mas nueva de Node.js');
  console.error('  ====================================================');
  console.error('');
  console.error('  Tienes: ' + process.version);
  console.error('  Necesitas: Node.js 20 o superior (recomendado 22 LTS).');
  console.error('');
  console.error('  1. Entra a  https://nodejs.org');
  console.error('  2. Descarga la version LTS e instalala.');
  console.error('  3. Cierra la ventana y vuelve a abrir PISAC.');
  console.error('');
  process.exit(1);
}

function comprobar() {
  comprobarNode();
  const lista = faltantes();
  if (!lista.length) return true;

  const esWindows = process.platform === 'win32';
  const reparar = esWindows ? 'REPARAR-PISAC.bat' : './reparar-pisac.command';
  const abrir = esWindows ? 'INICIAR-PISAC.bat' : './iniciar-pisac.command';

  console.error('');
  console.error('  ====================================================');
  console.error('   PISAC no puede arrancar: faltan componentes');
  console.error('  ====================================================');
  console.error('');
  console.error(`  Faltan o están dañados: ${lista.join(', ')}`);
  console.error('');
  console.error('  Esto pasa cuando la carpeta se copió incompleta o la');
  console.error('  instalación no terminó. Solución:');
  console.error('');
  console.error(`    1. Cierra esta ventana.`);
  console.error(`    2. Abre "${reparar}" (doble clic) y espera.`);
  console.error(`    3. Vuelve a abrir "${abrir}".`);
  console.error('');
  console.error('  Si prefieres hacerlo a mano, abre una terminal en');
  console.error('  esta carpeta y ejecuta:');
  console.error('');
  console.error('      npm install');
  console.error('');
  if (lista.includes('better-sqlite3')) {
    console.error('  Si solo falla better-sqlite3, prueba:');
    console.error('      npm install better-sqlite3@13');
    console.error('');
  }
  process.exit(1);
}

module.exports = { comprobar, comprobarNode, faltantes, MODULOS };
