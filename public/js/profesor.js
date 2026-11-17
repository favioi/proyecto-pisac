'use strict';

/* =========================================================================
   PISAC · Panel del profesor
   ========================================================================= */

function obtenerToken() {
  return localStorage.getItem('pisac_token') || sessionStorage.getItem('pisac_token');
}
function cerrarSesionLocal() {
  [localStorage, sessionStorage].forEach((s) => {
    s.removeItem('pisac_token');
    s.removeItem('pisac_profesor');
  });
}

const token = obtenerToken();
if (!token) {
  window.location.href = '/';
}

let CONFIG = {
  notaMaxima: 100,
  notaAprobatoria: 51,
  nivelBueno: 71,
  nivelExcelente: 91,
  baseUrl: '',
  baseUrlEsLocal: true,
  googleConfigurado: false
};
let ESTUDIANTES = [];
let MATERIAS = [];

/* ------------------------------------------------------------ Utilidades -- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function escapar(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatearFecha(valor) {
  if (!valor) return '—';
  const soloFecha = String(valor).slice(0, 10);
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return soloFecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatearFechaHora(valor) {
  if (!valor) return '—';
  // SQLite guarda created_at en UTC ("2026-01-15 20:30:00"); se muestra en
  // la hora local del navegador.
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return String(valor).slice(0, 16);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  if (isNaN(d.getTime())) return String(valor).slice(0, 16);
  return d.toLocaleString('es-EC', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/** Fecha de hoy en formato YYYY-MM-DD según la zona horaria del navegador. */
function hoyISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

let toastTimer;
function toast(mensaje, tipo) {
  const el = $('#toast');
  el.textContent = mensaje;
  el.className = 'toast visible ' + (tipo || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2800);
}

async function api(ruta, opciones) {
  opciones = opciones || {};
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    opciones.headers || {},
    { Authorization: 'Bearer ' + token }
  );
  const resp = await fetch(ruta, Object.assign({}, opciones, { headers }));
  if (resp.status === 401) {
    cerrarSesionLocal();
    window.location.href = '/';
    throw new Error('Sesión expirada');
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 413) throw new Error('El archivo es demasiado grande. Divídelo en partes.');
    throw new Error(data.error || `Error en la solicitud (${resp.status})`);
  }
  return data;
}

/* -------------------------------------------------------------- Navegación */
const vistas = ['inicio', 'estudiantes', 'materias', 'notas', 'tareas', 'examenes', 'asistencia', 'notificaciones', 'ajustes'];

function mostrarVista(nombre) {
  vistas.forEach((v) => {
    $('#vista-' + v).classList.toggle('oculto', v !== nombre);
  });
  $$('#nav button').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));
}

$$('#nav button').forEach((btn) => {
  btn.addEventListener('click', () => mostrarVista(btn.dataset.vista));
});

$('#btn-salir').addEventListener('click', () => {
  cerrarSesionLocal();
  window.location.href = '/';
});

/* ----------------------------------------------------------- Carga inicial */
async function cargarTodo() {
  const [estudiantes, materias, config] = await Promise.all([
    api('/api/estudiantes'),
    api('/api/materias'),
    api('/api/config')
  ]);
  ESTUDIANTES = estudiantes;
  MATERIAS = materias;
  CONFIG = config;

  const profesor = JSON.parse(
    localStorage.getItem('pisac_profesor') || sessionStorage.getItem('pisac_profesor') || '{}'
  );
  $('#usuario-nombre').textContent = profesor.nombre || profesor.email || 'Profesor';
  $('#usuario-email').textContent = profesor.email || '';
  if (profesor.foto) {
    const img = $('#usuario-foto');
    img.src = profesor.foto;
    img.classList.remove('oculto');
  }

  llenarSelectores();
  $('#prof-leyenda').textContent = textoLeyenda();
  aplicarLimitesNotas();
  $('#nota-fecha').value = hoyISO();
  $('#asis-fecha').value = hoyISO();
  renderAjustes();
  await Promise.all([
    renderInicio(),
    renderEstudiantes(),
    renderMaterias(),
    renderNotas(),
    renderTareas(),
    renderExamenes(),
    renderAsistencia(),
    renderNotificaciones()
  ]);
}

/* -------------------------------------------------------- Selects comunes -- */
function opcionesEstudiantes(select, textoVacio) {
  const anterior = select.value;
  select.innerHTML =
    (textoVacio ? `<option value="">${textoVacio}</option>` : '') +
    ESTUDIANTES.map(
      (e) => `<option value="${e.id}">${escapar(e.apellidos + ', ' + e.nombres)} · ${escapar(e.curso)}</option>`
    ).join('');
  if (anterior) select.value = anterior;
}

function opcionesMaterias(select) {
  const anterior = select.value;
  select.innerHTML = MATERIAS.map((m) => `<option value="${m.id}">${escapar(m.nombre)}</option>`).join('');
  if (anterior) select.value = anterior;
}

function llenarSelectores() {
  ['#nota-estudiante', '#tarea-estudiante', '#exam-estudiante', '#asis-estudiante', '#noti-estudiante'].forEach((s) => {
    opcionesEstudiantes($(s), null);
  });
  ['#filtro-notas', '#filtro-tareas', '#filtro-examenes', '#filtro-asistencia'].forEach((s) => {
    opcionesEstudiantes($(s), 'Todos los estudiantes');
  });
  ['#nota-materia', '#tarea-materia', '#exam-materia'].forEach((s) => opcionesMaterias($(s)));
}

/* =============================================================== INICIO === */async function renderInicio() {
  // Un solo endpoint devuelve los totales: antes se pedía un reporte completo
  // por cada estudiante (muy lento con cursos grandes).
  const resumen = await api('/api/resumen');

  const promedio = resumen.promedioInstitucional === null ? '—' : resumen.promedioInstitucional;
  const enRiesgo = resumen.estudiantesEnRiesgo || [];

  $('#tarjetas-resumen').innerHTML = `
    <div class="tarjeta">
      <div class="etiqueta">Estudiantes</div>
      <div class="valor">${resumen.totalEstudiantes}</div>
      <div class="detalle">registrados en el sistema</div>
    </div>
    <div class="tarjeta verde">
      <div class="etiqueta">Promedio institucional</div>
      <div class="valor">${promedio}</div>
      <div class="detalle">sobre ${CONFIG.notaMaxima} puntos</div>
    </div>
    <div class="tarjeta rojo">
      <div class="etiqueta">Estudiantes en riesgo</div>
      <div class="valor">${enRiesgo.length}</div>
      <div class="detalle">promedio &lt; ${CONFIG.notaAprobatoria}</div>
    </div>
    <div class="tarjeta ambar">
      <div class="etiqueta">Materias con bajo rendimiento</div>
      <div class="valor">${resumen.totalMateriasRiesgo}</div>
      <div class="detalle">casos detectados</div>
    </div>
    <div class="tarjeta">
      <div class="etiqueta">Materias</div>
      <div class="valor">${resumen.totalMaterias}</div>
      <div class="detalle">en el catálogo</div>
    </div>
  `;

  const tbody = $('#tabla-riesgo');
  if (!enRiesgo.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">No hay estudiantes con bajo rendimiento. 🎉</td></tr>`;
    return;
  }
  tbody.innerHTML = enRiesgo
    .map(
      (e) => `<tr>
        <td>${escapar(e.nombres + ' ' + e.apellidos)}</td>
        <td>${escapar(e.curso)}</td>
        <td><strong>${e.promedio}</strong> / ${CONFIG.notaMaxima}</td>
        <td>${escapar(e.tutor_nombre)}</td>
        <td><span class="badge badge-rojo">Requiere atención</span></td>
      </tr>`
    )
    .join('');
}

/* ========================================================= ESTUDIANTES === */
async function renderEstudiantes() {
  const filas = await api('/api/estudiantes');
  ESTUDIANTES = filas;
  const tbody = $('#tabla-estudiantes');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">Aún no hay estudiantes registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (e) => `<tr>
        <td>${escapar(e.nombres + ' ' + e.apellidos)}</td>
        <td>${escapar(e.curso)}</td>
        <td>${escapar(e.tutor_nombre)}</td>
        <td>${escapar(e.tutor_telefono)}</td>
        <td>
          <button class="btn btn-sec btn-mini" data-editar="${e.id}">Editar</button>
          <button class="btn btn-rojo btn-mini" data-eliminar="${e.id}">Eliminar</button>
        </td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => editarEstudiante(Number(b.dataset.editar)))
  );
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', () => eliminarEstudiante(Number(b.dataset.eliminar)))
  );
}

function editarEstudiante(id) {
  const e = ESTUDIANTES.find((x) => x.id === id);
  if (!e) return;
  $('#est-id').value = e.id;
  $('#est-nombres').value = e.nombres;
  $('#est-apellidos').value = e.apellidos;
  $('#est-curso').value = e.curso;
  $('#est-tutor').value = e.tutor_nombre;
  $('#est-telefono').value = e.tutor_telefono;
  $('#titulo-form-estudiante').textContent = 'Editar estudiante';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormEstudiante() {
  $('#form-estudiante').reset();
  $('#est-id').value = '';
  $('#titulo-form-estudiante').textContent = 'Nuevo estudiante';
}

async function eliminarEstudiante(id) {
  if (!confirm('¿Eliminar este estudiante y todos sus registros?')) return;
  try {
    await api('/api/estudiantes/' + id, { method: 'DELETE' });
    toast('Estudiante eliminado', 'ok');
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('#btn-cancelar-estudiante').addEventListener('click', limpiarFormEstudiante);

$('#form-estudiante').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#est-id').value;
  const cuerpo = {
    nombres: $('#est-nombres').value,
    apellidos: $('#est-apellidos').value,
    curso: $('#est-curso').value,
    tutor_nombre: $('#est-tutor').value,
    tutor_telefono: $('#est-telefono').value
  };
  try {
    await api('/api/estudiantes' + (id ? '/' + id : ''), {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(cuerpo)
    });
    toast(id ? 'Estudiante actualizado' : 'Estudiante registrado', 'ok');
    limpiarFormEstudiante();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ============================================================ MATERIAS === */
async function renderMaterias() {
  const filas = await api('/api/materias');
  MATERIAS = filas;
  const tbody = $('#tabla-materias');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="vacio">Aún no hay materias.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (m) => `<tr>
        <td>${escapar(m.nombre)}</td>
        <td>${escapar(m.docente || '—')}</td>
        <td><button class="btn btn-rojo btn-mini" data-eliminar="${m.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar la materia? Se borrarán sus notas, tareas y exámenes.')) return;
      try {
        await api('/api/materias/' + b.dataset.eliminar, { method: 'DELETE' });
        toast('Materia eliminada', 'ok');
        await cargarTodo();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

$('#form-materia').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/materias', {
      method: 'POST',
      body: JSON.stringify({ nombre: $('#mat-nombre').value, docente: $('#mat-docente').value })
    });
    toast('Materia agregada', 'ok');
    $('#form-materia').reset();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* =============================================================== NOTAS === */
function badgeNota(valor) {
  const n = nivelCualitativo(valor);
  return `<span class="badge ${n.clase}">${valor} / ${CONFIG.notaMaxima}</span>`;
}

function nivelCualitativo(valor) {
  if (valor === null || valor === undefined || isNaN(Number(valor))) return { etiqueta: '—', clase: 'badge-gris' };
  const v = Number(valor);
  if (v >= CONFIG.nivelExcelente) return { etiqueta: 'Excelente', clase: 'badge-verde' };
  if (v >= CONFIG.nivelBueno) return { etiqueta: 'Bueno', clase: 'badge-azul' };
  if (v >= CONFIG.notaAprobatoria) return { etiqueta: 'Regular', clase: 'badge-ambar' };
  return { etiqueta: 'Insuficiente', clase: 'badge-rojo' };
}

function badgeNivel(valor) {
  const n = nivelCualitativo(valor);
  return `<span class="badge ${n.clase}">${n.etiqueta}</span>`;
}

function textoLeyenda() {
  return `Escala de calificación: 0–${CONFIG.notaAprobatoria - 1} Insuficiente · ` +
    `${CONFIG.notaAprobatoria}–${CONFIG.nivelBueno - 1} Regular · ` +
    `${CONFIG.nivelBueno}–${CONFIG.nivelExcelente - 1} Bueno · ` +
    `${CONFIG.nivelExcelente}–${CONFIG.notaMaxima} Excelente`;
}

/** Pone los límites de la escala en los campos de calificación. */
function aplicarLimitesNotas() {
  ['#nota-calificacion', '#tarea-calificacion', '#exam-calificacion'].forEach((sel) => {
    const campo = $(sel);
    if (!campo) return;
    campo.min = 0;
    campo.max = CONFIG.notaMaxima;
    campo.placeholder = `0 – ${CONFIG.notaMaxima}`;
  });
}

async function renderNotas() {
  const filtro = $('#filtro-notas').value;
  const filas = await api('/api/notas' + (filtro ? '?estudiante_id=' + filtro : ''));
  const tbody = $('#tabla-notas');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="vacio">No hay notas registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (n) => `<tr>
        <td>${escapar(n.apellidos + ', ' + n.nombres)}</td>
        <td>${escapar(n.materia)}</td>
        <td>${escapar(n.periodo)}</td>
        <td>${badgeNota(n.calificacion)}</td>
        <td>${badgeNivel(n.calificacion)}</td>
        <td>${formatearFecha(n.fecha)}</td>
        <td>${escapar(n.observacion || '—')}</td>
        <td><button class="btn btn-rojo btn-mini" data-eliminar="${n.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta nota?')) return;
      try {
        await api('/api/notas/' + b.dataset.eliminar, { method: 'DELETE' });
        toast('Nota eliminada', 'ok');
        await cargarTodo();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

$('#filtro-notas').addEventListener('change', renderNotas);

$('#form-nota').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/notas', {
      method: 'POST',
      body: JSON.stringify({
        estudiante_id: $('#nota-estudiante').value,
        materia_id: $('#nota-materia').value,
        periodo: $('#nota-periodo').value,
        calificacion: $('#nota-calificacion').value,
        fecha: $('#nota-fecha').value,
        observacion: $('#nota-observacion').value
      })
    });
    toast('Nota guardada', 'ok');
    $('#form-nota').reset();
    $('#nota-fecha').value = hoyISO();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ============================================================== TAREAS === */
function badgeEstado(estado) {
  const mapa = { pendiente: 'badge-ambar', entregada: 'badge-verde', atrasada: 'badge-rojo' };
  return `<span class="badge ${mapa[estado] || 'badge-gris'}">${escapar(estado)}</span>`;
}

async function renderTareas() {
  const filtro = $('#filtro-tareas').value;
  const filas = await api('/api/tareas' + (filtro ? '?estudiante_id=' + filtro : ''));
  const tbody = $('#tabla-tareas');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="vacio">No hay tareas registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (t) => `<tr>
        <td>${escapar(t.apellidos + ', ' + t.nombres)}</td>
        <td>${escapar(t.materia)}</td>
        <td>${escapar(t.titulo)}</td>
        <td>${formatearFecha(t.fecha_entrega)}</td>
        <td>${badgeEstado(t.estado)}</td>
        <td>${t.calificacion == null ? '—' : t.calificacion}</td>
        <td><button class="btn btn-rojo btn-mini" data-eliminar="${t.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta tarea?')) return;
      try {
        await api('/api/tareas/' + b.dataset.eliminar, { method: 'DELETE' });
        toast('Tarea eliminada', 'ok');
        await cargarTodo();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

$('#filtro-tareas').addEventListener('change', renderTareas);

$('#form-tarea').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/tareas', {
      method: 'POST',
      body: JSON.stringify({
        estudiante_id: $('#tarea-estudiante').value,
        materia_id: $('#tarea-materia').value,
        titulo: $('#tarea-titulo').value,
        descripcion: $('#tarea-descripcion').value,
        fecha_entrega: $('#tarea-fecha').value,
        estado: $('#tarea-estado').value,
        calificacion: $('#tarea-calificacion').value
      })
    });
    toast('Tarea guardada', 'ok');
    $('#form-tarea').reset();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ============================================================ EXÁMENES === */
async function renderExamenes() {
  const filtro = $('#filtro-examenes').value;
  const filas = await api('/api/examenes' + (filtro ? '?estudiante_id=' + filtro : ''));
  const tbody = $('#tabla-examenes');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="vacio">No hay exámenes registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (x) => `<tr>
        <td>${escapar(x.apellidos + ', ' + x.nombres)}</td>
        <td>${escapar(x.materia)}</td>
        <td>${escapar(x.titulo)}</td>
        <td>${formatearFecha(x.fecha)}</td>
        <td>${x.calificacion == null ? '—' : badgeNota(x.calificacion)}</td>
        <td><button class="btn btn-rojo btn-mini" data-eliminar="${x.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este examen?')) return;
      try {
        await api('/api/examenes/' + b.dataset.eliminar, { method: 'DELETE' });
        toast('Examen eliminado', 'ok');
        await cargarTodo();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

$('#filtro-examenes').addEventListener('change', renderExamenes);

$('#form-examen').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/examenes', {
      method: 'POST',
      body: JSON.stringify({
        estudiante_id: $('#exam-estudiante').value,
        materia_id: $('#exam-materia').value,
        titulo: $('#exam-titulo').value,
        fecha: $('#exam-fecha').value,
        calificacion: $('#exam-calificacion').value
      })
    });
    toast('Examen guardado', 'ok');
    $('#form-examen').reset();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ========================================================== ASISTENCIA === */
function badgeAsistencia(estado) {
  const mapa = { presente: 'badge-verde', ausente: 'badge-rojo', tarde: 'badge-ambar', justificado: 'badge-azul' };
  return `<span class="badge ${mapa[estado] || 'badge-gris'}">${escapar(estado)}</span>`;
}

async function renderAsistencia() {
  const filtro = $('#filtro-asistencia').value;
  const filas = await api('/api/asistencia' + (filtro ? '?estudiante_id=' + filtro : ''));
  const tbody = $('#tabla-asistencia');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">No hay registros de asistencia.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (a) => `<tr>
        <td>${escapar(a.apellidos + ', ' + a.nombres)}</td>
        <td>${formatearFecha(a.fecha)}</td>
        <td>${badgeAsistencia(a.estado)}</td>
        <td>${escapar(a.observacion || '—')}</td>
        <td><button class="btn btn-rojo btn-mini" data-eliminar="${a.id}">Eliminar</button></td>
      </tr>`
    )
    .join('');
  tbody.querySelectorAll('[data-eliminar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este registro?')) return;
      try {
        await api('/api/asistencia/' + b.dataset.eliminar, { method: 'DELETE' });
        toast('Registro eliminado', 'ok');
        await cargarTodo();
      } catch (err) {
        toast(err.message, 'error');
      }
    })
  );
}

$('#filtro-asistencia').addEventListener('change', renderAsistencia);

$('#form-asistencia').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/asistencia', {
      method: 'POST',
      body: JSON.stringify({
        estudiante_id: $('#asis-estudiante').value,
        fecha: $('#asis-fecha').value,
        estado: $('#asis-estado').value,
        observacion: $('#asis-observacion').value
      })
    });
    toast('Asistencia registrada', 'ok');
    $('#form-asistencia').reset();
    $('#asis-fecha').value = hoyISO();
    await cargarTodo();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ====================================================== NOTIFICACIONES === */
async function renderNotificaciones() {
  const filas = await api('/api/notificaciones');
  const tbody = $('#tabla-notificaciones');
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">Aún no se han enviado notificaciones.</td></tr>`;
    return;
  }
  tbody.innerHTML = filas
    .map(
      (n) => `<tr>
        <td>${formatearFechaHora(n.created_at)}</td>
        <td>${escapar(n.apellidos + ', ' + n.nombres)}</td>
        <td>${escapar(n.tutor_nombre)}<br /><small style="color:var(--gris-500)">${escapar(n.tutor_telefono)}</small></td>
        <td><a href="${escapar(n.enlace)}" target="_blank" rel="noopener">Ver reporte</a></td>
        <td><a class="btn btn-verde btn-mini" href="${escapar(n.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></td>
      </tr>`
    )
    .join('');
}

$('#form-notificacion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = e.target.querySelector('button[type=submit]');
  boton.disabled = true;
  try {
    const data = await api('/api/notificaciones', {
      method: 'POST',
      body: JSON.stringify({
        estudiante_id: $('#noti-estudiante').value,
        mensaje: $('#noti-mensaje').value
      })
    });
    $('#noti-resultado').classList.remove('oculto');
    $('#noti-texto').textContent = data.mensaje;
    $('#noti-enlace').textContent = data.enlace;
    $('#noti-whatsapp').href = data.whatsapp;
    $('#noti-whatsapp-web').href = data.whatsappWeb;
    $('#noti-ver').href = data.enlace;
    toast('Enlace generado. Listo para enviar por WhatsApp.', 'ok');
    await renderNotificaciones();
    await renderInicio();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    boton.disabled = false;
  }
});

$('#noti-copiar').addEventListener('click', async () => {
  const enlace = $('#noti-enlace').textContent;
  try {
    await navigator.clipboard.writeText(enlace);
    toast('Enlace copiado al portapapeles', 'ok');
  } catch (err) {
    toast('No se pudo copiar. Selecciónalo manualmente.', 'error');
  }
});

$('#noti-copiar-mensaje').addEventListener('click', async () => {
  const mensaje = $('#noti-texto').textContent;
  try {
    await navigator.clipboard.writeText(mensaje);
    toast('Mensaje copiado. Pégalo en WhatsApp.', 'ok');
  } catch (err) {
    toast('No se pudo copiar. Selecciónalo manualmente.', 'error');
  }
});

/* --------------------------------------------- Importar Excel / CSV ----- */

// SheetJS se carga solo cuando hace falta (para .xlsx / .xls).
let promesaSheetJS = null;
function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (promesaSheetJS) return promesaSheetJS;
  const urls = [
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  ];
  promesaSheetJS = new Promise((resolve, reject) => {
    const intentar = (i) => {
      if (i >= urls.length) {
        reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión o usa un archivo CSV.'));
        return;
      }
      const s = document.createElement('script');
      s.src = urls[i];
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : intentar(i + 1));
      s.onerror = () => intentar(i + 1);
      document.head.appendChild(s);
    };
    intentar(0);
  });
  return promesaSheetJS;
}

// Lector de CSV propio (funciona sin internet).
function parsearCSV(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let dentro = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentro) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else dentro = false;
      } else campo += c;
    } else if (c === '"') {
      dentro = true;
    } else if (c === ',' || c === ';') {
      fila.push(campo);
      campo = '';
    } else if (c === '\n') {
      fila.push(campo);
      campo = '';
      if (fila.some((v) => String(v).trim() !== '')) filas.push(fila);
      fila = [];
    } else if (c !== '\r') {
      campo += c;
    }
  }
  fila.push(campo);
  if (fila.some((v) => String(v).trim() !== '')) filas.push(fila);
  return filas;
}

// Convierte la primera fila en encabezados y el resto en objetos.
// Si el archivo trae filas de titulo o instrucciones antes de los encabezados
// (como la plantilla .xlsx incluida), se busca la fila correcta.
function claveCelda(valor) {
  return String(valor == null ? '' : valor)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function detectarFilaEncabezado(filas, esperados) {
  if (!esperados || !esperados.length) return 0;
  const objetivos = esperados.map(claveCelda);
  let mejor = 0;
  let mejorPuntaje = 0;
  const limite = Math.min(filas.length, 15);
  for (let i = 0; i < limite; i++) {
    const celdas = (filas[i] || []).map(claveCelda).filter(Boolean);
    let puntaje = 0;
    celdas.forEach((c) => {
      if (objetivos.includes(c)) puntaje += 1;
    });
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = i;
    }
  }
  // Al menos dos encabezados reconocidos para considerar que es la fila buena.
  return mejorPuntaje >= Math.min(2, objetivos.length) ? mejor : 0;
}

function filasAObjetos(filas, encabezadosEsperados) {
  if (!filas.length) return [];
  const inicio = detectarFilaEncabezado(filas, encabezadosEsperados);
  const encabezados = filas[inicio].map((h) => String(h == null ? '' : h).trim());
  return filas
    .slice(inicio + 1)
    .map((f) => {
      const obj = {};
      encabezados.forEach((h, i) => {
        if (h) obj[h] = f[i] === undefined ? '' : f[i];
      });
      return obj;
    })
    .filter((o) => Object.values(o).some((v) => String(v).trim() !== ''));
}

function claveHoja(nombre) {
  return String(nombre || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function leerArchivo(file, nombreHoja, encabezadosEsperados) {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith('.csv')) {
    const texto = await file.text();
    return filasAObjetos(parsearCSV(texto.replace(/^\uFEFF/, '')), encabezadosEsperados);
  }
  const XLSX = await cargarSheetJS();
  const buffer = await file.arrayBuffer();
  // cellDates: convierte las fechas de Excel en fechas reales (si no, llegan
  // como numeros de serie). raw:false devuelve el texto tal como se ve.
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Si el libro tiene una hoja con el nombre esperado (ej. "Estudiantes"),
  // se usa esa; si no, la primera hoja con datos.
  let hoja = null;
  if (nombreHoja) {
    const encontrada = libro.SheetNames.find((n) => claveHoja(n) === claveHoja(nombreHoja));
    if (encontrada) hoja = libro.Sheets[encontrada];
  }
  if (!hoja) hoja = libro.Sheets[libro.SheetNames[0]];

  const filas = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });
  return filasAObjetos(filas, encabezadosEsperados);
}

function descargarPlantillaCSV(nombreArchivo, encabezados, ejemplo) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [encabezados.map(esc).join(',')];
  ejemplo.forEach((fila) => lineas.push(fila.map(esc).join(',')));
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

function pintarResultado(contenedor, resultado, entidad) {
  const creados = resultado.creados || [];
  const omitidos = resultado.omitidos || [];
  const errores = resultado.errores || [];
  const total = resultado.total || 0;
  const partes = [`<strong>${creados.length} de ${total}</strong> ${entidad} importados correctamente.`];
  if (omitidos.length) partes.push(`${omitidos.length} omitidos porque ya existían.`);
  if (errores.length) {
    partes.push(`${errores.length} con problemas:`);
    partes.push(
      '<ul>' +
        errores
          .slice(0, 12)
          .map((e) => `<li>Fila ${e.fila}: ${escapar(e.motivo)}${e.datos ? ' — ' + escapar(e.datos) : ''}</li>`)
          .join('') +
        '</ul>'
    );
    if (errores.length > 12) partes.push(`<em>…y ${errores.length - 12} más.</em>`);
  }
  contenedor.className = 'resultado-import ' + (errores.length ? 'aviso' : 'ok');
  contenedor.innerHTML = partes.join(' ');
}

function conectarImportacion(cfg) {
  cfg.botonPlantilla.addEventListener('click', () => {
    descargarPlantillaCSV(cfg.nombreArchivo, cfg.encabezados, cfg.ejemplo);
    toast('Plantilla descargada. Ábrela con Excel y llénala.', 'ok');
  });

  cfg.botonImportar.addEventListener('click', () => cfg.input.click());

  cfg.input.addEventListener('change', async () => {
    const file = cfg.input.files && cfg.input.files[0];
    if (!file) return;
    cfg.contenedor.classList.add('oculto');
    cfg.botonImportar.disabled = true;
    cfg.botonImportar.textContent = 'Importando…';
    try {
      const filas = await leerArchivo(file, cfg.hoja, cfg.encabezados);
      if (!filas.length) throw new Error('El archivo no tiene datos. Revisa que llenaste la plantilla.');
      const resultado = await api(cfg.ruta, { method: 'POST', body: JSON.stringify({ filas }) });
      pintarResultado(cfg.contenedor, resultado, cfg.entidad);
      await cargarTodo();
      toast(`${resultado.creados.length} ${cfg.entidad} ${resultado.creados.length === 1 ? 'importado' : 'importados'}`, 'ok');
    } catch (err) {
      cfg.contenedor.className = 'resultado-import error';
      cfg.contenedor.textContent = err.message;
      cfg.contenedor.classList.remove('oculto');
      toast(err.message, 'error');
    } finally {
      cfg.botonImportar.disabled = false;
      cfg.botonImportar.textContent = '📥 Importar archivo';
      cfg.input.value = '';
    }
  });
}

conectarImportacion({
  botonPlantilla: $('#btn-plantilla-estudiantes'),
  botonImportar: $('#btn-importar-estudiantes'),
  input: $('#archivo-estudiantes'),
  contenedor: $('#resultado-import-estudiantes'),
  ruta: '/api/importar/estudiantes',
  entidad: 'estudiantes',
  nombreArchivo: 'plantilla-estudiantes.csv',
  hoja: 'Estudiantes',
  encabezados: ['Nombres', 'Apellidos', 'Curso', 'Nombre del tutor', 'Teléfono del tutor'],
  ejemplo: [
    ['María Fernanda', 'Gómez Ruiz', '8vo A', 'Ana Ruiz', '+593999111222'],
    ['Carlos Andrés', 'Pérez Loor', '8vo A', 'Luis Pérez', '+593988333444']
  ]
});

conectarImportacion({
  botonPlantilla: $('#btn-plantilla-notas'),
  botonImportar: $('#btn-importar-notas'),
  input: $('#archivo-notas'),
  contenedor: $('#resultado-import-notas'),
  ruta: '/api/importar/notas',
  entidad: 'notas',
  nombreArchivo: 'plantilla-notas.csv',
  hoja: 'Notas',
  encabezados: ['Apellidos', 'Nombres', 'Materia', 'Periodo', 'Calificación', 'Observación', 'Fecha'],
  ejemplo: [
    ['Gómez Ruiz', 'María Fernanda', 'Matemáticas', 'Primer quimestre', 85, 'Buen desempeño', '2026-01-15'],
    ['Pérez Loor', 'Carlos Andrés', 'Matemáticas', 'Primer quimestre', 45, 'Debe reforzar', '2026-01-15']
  ]
});

conectarImportacion({
  botonPlantilla: $('#btn-plantilla-materias'),
  botonImportar: $('#btn-importar-materias'),
  input: $('#archivo-materias'),
  contenedor: $('#resultado-import-materias'),
  ruta: '/api/importar/materias',
  entidad: 'materias',
  nombreArchivo: 'plantilla-materias.csv',
  hoja: 'Materias',
  encabezados: ['Nombre de la materia', 'Docente'],
  ejemplo: [
    ['Matemáticas', 'Prof. Ana Torres'],
    ['Lengua y Literatura', 'Prof. Luis Vega']
  ]
});

/* ------------------------------------------------------------- Ajustes --- */
function renderAjustes() {
  const google = $('#ajustes-google');
  if (google) {
    google.innerHTML = CONFIG.googleConfigurado
      ? `<div class="banner banner-verde" style="margin-bottom:0">
           <span class="icono-banner">✅</span>
           <div><strong>Google conectado</strong>
           El panel se abre con cuentas de Google. Para entrar con otra cuenta, cierra sesión y vuelve a iniciar.</div>
         </div>`
      : `<div class="banner banner-ambar" style="margin-bottom:0">
           <span class="icono-banner">🔑</span>
           <div><strong>Google no está configurado</strong>
           Cierra sesión y la pantalla de acceso te pedirá el Client ID.</div>
         </div>`;
  }

  const url = $('#ajustes-url');
  if (url) {
    if (CONFIG.baseUrlTipo === 'publica') {
      url.innerHTML = `<div class="banner banner-verde" style="margin-bottom:0">
        <span class="icono-banner">🌐</span>
        <div><strong>Enlaces públicos activos</strong>
        Los enlaces del tutor usan <code>${escapar(CONFIG.baseUrl)}</code> y abren desde cualquier celular, con datos o Wi-Fi.</div>
      </div>`;
    } else if (CONFIG.baseUrlTipo === 'red') {
      url.innerHTML = `<div class="banner banner-azul" style="margin-bottom:0">
        <span class="icono-banner">📶</span>
        <div><strong>Enlaces para tu red Wi-Fi</strong>
        Se generan con <code>${escapar(CONFIG.baseUrl)}</code>. Abren en celulares conectados al mismo Wi-Fi que esta computadora.
        Para que funcionen con datos móviles u otra red, pega abajo una dirección pública.</div>
      </div>`;
    } else {
      url.innerHTML = `<div class="banner banner-ambar" style="margin-bottom:0">
        <span class="icono-banner">⚠️</span>
        <div><strong>Sin red detectada</strong>
        No se encontró una dirección de red. Conecta la computadora al Wi-Fi o pega una dirección pública abajo.</div>
      </div>`;
    }
  }

  const campo = $('#ajuste-base-url');
  if (campo) campo.value = CONFIG.urlPublicaGuardada ? CONFIG.urlGuardada : '';
  const botonQuitar = $('#btn-restaurar-url');
  if (botonQuitar) botonQuitar.classList.toggle('oculto', !CONFIG.urlPublicaGuardada);
}

async function recargarConfig() {
  CONFIG = await api('/api/config');
  renderAjustes();
  await renderNotificaciones();
  await renderInicio();
}

async function guardarAjustesUrl(valor) {
  const boton = $('#btn-guardar-ajustes');
  if (boton) {
    boton.disabled = true;
    boton.textContent = 'Guardando…';
  }
  try {
    const data = await api('/api/config', {
      method: 'POST',
      body: JSON.stringify({ baseUrl: valor })
    });
    await recargarConfig();
    toast('Dirección guardada. Los enlaces de WhatsApp ya la usan.', 'ok');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = 'Guardar dirección';
    }
  }
}

$('#btn-guardar-ajustes').addEventListener('click', () => {
  const valor = $('#ajuste-base-url').value.trim();
  if (!valor) {
    toast('Escribe una dirección, por ejemplo https://mi-app.onrender.com', 'error');
    return;
  }
  guardarAjustesUrl(valor);
});

$('#btn-restaurar-url').addEventListener('click', () => {
  guardarAjustesUrl('');
});

/* -------------------------------------------------------------- Arranque -- */
cargarTodo().catch((err) => toast(err.message, 'error'));
