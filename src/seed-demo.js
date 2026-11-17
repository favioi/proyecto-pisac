'use strict';

/**
 * Datos de demostración para PISAC.
 * Uso:  npm run seed:demo
 *
 * Crea un estudiante de ejemplo con notas, tareas, exámenes y asistencia
 * para que puedas ver cómo se ve el reporte que recibe el tutor.
 */

require('./dependencias').comprobar();

require('dotenv').config();
const db = require('./db');

const estudiante = {
  nombres: 'Juan Andrés',
  apellidos: 'Pérez Gómez',
  curso: '8vo A',
  tutor_nombre: 'María Gómez',
  tutor_telefono: '+593999888777'
};

const existe = db
  .prepare('SELECT id FROM estudiantes WHERE nombres = ? AND apellidos = ?')
  .get(estudiante.nombres, estudiante.apellidos);

let estudianteId;

if (existe) {
  estudianteId = existe.id;
  console.log('El estudiante de demostración ya existe (id', estudianteId, ').');
} else {
  const info = db
    .prepare(
      `INSERT INTO estudiantes (nombres, apellidos, curso, tutor_nombre, tutor_telefono)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      estudiante.nombres,
      estudiante.apellidos,
      estudiante.curso,
      estudiante.tutor_nombre,
      estudiante.tutor_telefono
    );
  estudianteId = info.lastInsertRowid;
  console.log('Estudiante de demostración creado (id', estudianteId, ').');
}

const materiaId = (nombre) => {
  const fila = db.prepare('SELECT id FROM materias WHERE nombre = ?').get(nombre);
  if (!fila) throw new Error(`No existe la materia "${nombre}". Ejecute primero el servidor.`);
  return fila.id;
};

// Notas
const notas = [
  ['Matemáticas', '1er Trimestre', 51, 'Bajo rendimiento en álgebra'],
  ['Matemáticas', '2do Trimestre', 35, 'No alcanza la nota mínima'],
  ['Lengua y Literatura', '1er Trimestre', 62, null],
  ['Lengua y Literatura', '2do Trimestre', 70, 'Buena comprensión lectora'],
  ['Ciencias Naturales', '1er Trimestre', 45, 'Requiere refuerzo'],
  ['Ciencias Naturales', '2do Trimestre', 40, 'Faltan trabajos prácticos'],
  ['Estudios Sociales', '1er Trimestre', 50, null],
  ['Inglés', '1er Trimestre', 42, 'Reforzar vocabulario']
];

const insertNota = db.prepare(
  `INSERT INTO notas (estudiante_id, materia_id, periodo, calificacion, observacion, fecha)
   VALUES (?, ?, ?, ?, ?, date('now', ?))`
);
notas.forEach((n, i) =>
  insertNota.run(estudianteId, materiaId(n[0]), n[1], n[2], n[3], `-${i * 15} days`)
);

// Tareas
const tareas = [
  ['Matemáticas', 'Ejercicios de ecuaciones', 'Resolver la guía 3', 'pendiente', null],
  ['Lengua y Literatura', 'Ensayo sobre la lectura', 'Entrega del ensayo', 'entregada', 85],
  ['Ciencias Naturales', 'Maqueta del sistema solar', 'Trabajo grupal', 'atrasada', null],
  ['Inglés', 'Vocabulario unidad 4', 'Completar plana', 'pendiente', null]
];
const insertTarea = db.prepare(
  `INSERT INTO tareas (estudiante_id, materia_id, titulo, descripcion, estado, calificacion, fecha_entrega)
   VALUES (?, ?, ?, ?, ?, ?, date('now', ?))`
);
tareas.forEach((t, i) =>
  insertTarea.run(estudianteId, materiaId(t[0]), t[1], t[2], t[3], t[4], `${i - 2} days`)
);

// Exámenes
const examenes = [
  ['Matemáticas', 'Examen de álgebra', 51],
  ['Lengua y Literatura', 'Prueba de ortografía', 70],
  ['Ciencias Naturales', 'Examen de biología', 45],
  ['Estudios Sociales', 'Lección de historia', 50]
];
const insertExamen = db.prepare(
  `INSERT INTO examenes (estudiante_id, materia_id, titulo, calificacion, fecha)
   VALUES (?, ?, ?, ?, date('now', ?))`
);
examenes.forEach((e, i) =>
  insertExamen.run(estudianteId, materiaId(e[0]), e[1], e[2], `-${i * 20} days`)
);

// Asistencia (últimos 20 días hábiles aproximados)
const estados = ['presente', 'presente', 'presente', 'tarde', 'presente', 'ausente', 'presente', 'presente', 'justificado', 'presente'];
const insertAsistencia = db.prepare(
  `INSERT INTO asistencia (estudiante_id, fecha, estado, observacion)
   VALUES (?, date('now', ?), ?, ?)`
);
estados.forEach((estado, i) =>
  insertAsistencia.run(estudianteId, `-${i} days`, estado, null)
);

console.log('Datos de demostración insertados correctamente.');
console.log('Entra al panel y abre la pestaña "Notificaciones" para generar el enlace del tutor.');
