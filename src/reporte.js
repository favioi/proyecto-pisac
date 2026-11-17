'use strict';

const db = require('./db');

const NOTA_MAXIMA = Number(process.env.NOTA_MAXIMA || 100);
const NOTA_APROBATORIA = Number(process.env.NOTA_APROBATORIA || 51);
const NIVEL_BUENO = Number(process.env.NIVEL_BUENO || 71);
const NIVEL_EXCELENTE = Number(process.env.NIVEL_EXCELENTE || 91);

function redondear(n, decimales = 2) {
  const f = Math.pow(10, decimales);
  return Math.round(n * f) / f;
}

/** Nivel cualitativo: Excelente / Bueno / Regular / Insuficiente. */
function nivelCualitativo(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return null;
  const v = Number(valor);
  if (v >= NIVEL_EXCELENTE) return 'Excelente';
  if (v >= NIVEL_BUENO) return 'Bueno';
  if (v >= NOTA_APROBATORIA) return 'Regular';
  return 'Insuficiente';
}

/**
 * Construye el reporte academico completo de un estudiante:
 * notas, promedio por materia, tareas, examenes y asistencia.
 */
function construirReporte(estudianteId) {
  const estudiante = db
    .prepare('SELECT * FROM estudiantes WHERE id = ?')
    .get(estudianteId);
  if (!estudiante) return null;

  const notas = db
    .prepare(
      `SELECT n.id, n.periodo, n.calificacion, n.observacion, n.fecha,
              m.nombre AS materia, m.id AS materia_id
         FROM notas n
         JOIN materias m ON m.id = n.materia_id
        WHERE n.estudiante_id = ?
        ORDER BY m.nombre, n.fecha DESC`
    )
    .all(estudianteId);

  const tareas = db
    .prepare(
      `SELECT t.id, t.titulo, t.descripcion, t.fecha_entrega, t.estado,
              t.calificacion, m.nombre AS materia
         FROM tareas t
         JOIN materias m ON m.id = t.materia_id
        WHERE t.estudiante_id = ?
        ORDER BY (t.fecha_entrega IS NULL), t.fecha_entrega DESC`
    )
    .all(estudianteId);

  const examenes = db
    .prepare(
      `SELECT e.id, e.titulo, e.fecha, e.calificacion, m.nombre AS materia
         FROM examenes e
         JOIN materias m ON m.id = e.materia_id
        WHERE e.estudiante_id = ?
        ORDER BY (e.fecha IS NULL), e.fecha DESC`
    )
    .all(estudianteId);

  const asistencia = db
    .prepare(
      `SELECT id, fecha, estado, observacion
         FROM asistencia
        WHERE estudiante_id = ?
        ORDER BY fecha DESC`
    )
    .all(estudianteId);

  // --- Promedio general ---
  const promedioGeneral = notas.length
    ? redondear(notas.reduce((s, n) => s + Number(n.calificacion), 0) / notas.length)
    : null;

  // --- Resumen por materia ---
  const mapa = new Map();
  for (const n of notas) {
    if (!mapa.has(n.materia)) mapa.set(n.materia, []);
    mapa.get(n.materia).push(Number(n.calificacion));
  }
  const resumenMaterias = [...mapa.entries()]
    .map(([materia, valores]) => {
      const promedio = redondear(
        valores.reduce((a, b) => a + b, 0) / valores.length
      );
      return {
        materia,
        promedio,
        nivel: nivelCualitativo(promedio),
        cantidad: valores.length,
        enRiesgo: promedio < NOTA_APROBATORIA
      };
    })
    .sort((a, b) => a.promedio - b.promedio);

  // --- Asistencia ---
  const conteo = { presente: 0, ausente: 0, tarde: 0, justificado: 0 };
  for (const a of asistencia) {
    if (conteo[a.estado] !== undefined) conteo[a.estado] += 1;
  }
  const totalClases = asistencia.length;
  const porcentajeAsistencia = totalClases
    ? redondear(((conteo.presente + conteo.tarde) / totalClases) * 100, 1)
    : null;

  const materiasEnRiesgo = resumenMaterias
    .filter((m) => m.enRiesgo)
    .map((m) => m.materia);

  return {
    estudiante,
    config: {
      notaMaxima: NOTA_MAXIMA,
      notaAprobatoria: NOTA_APROBATORIA,
      nivelBueno: NIVEL_BUENO,
      nivelExcelente: NIVEL_EXCELENTE
    },
    resumen: {
      promedioGeneral,
      nivelGeneral: nivelCualitativo(promedioGeneral),
      materiasEnRiesgo,
      enRiesgo: promedioGeneral !== null && promedioGeneral < NOTA_APROBATORIA,
      tareasPendientes: tareas.filter((t) => t.estado === 'pendiente').length,
      tareasAtrasadas: tareas.filter((t) => t.estado === 'atrasada').length,
      totalTareas: tareas.length,
      totalExamenes: examenes.length,
      porcentajeAsistencia,
      asistencia: { total: totalClases, ...conteo }
    },
    resumenMaterias,
    notas,
    tareas,
    examenes,
    asistencia
  };
}

module.exports = {
  construirReporte,
  nivelCualitativo,
  NOTA_MAXIMA,
  NOTA_APROBATORIA,
  NIVEL_BUENO,
  NIVEL_EXCELENTE
};
