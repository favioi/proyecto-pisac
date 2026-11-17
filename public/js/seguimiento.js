'use strict';

/* =========================================================================
   PISAC · Vista pública del tutor (acceso por enlace)
   ========================================================================= */

const $ = (sel) => document.querySelector(sel);

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

function badgeEstado(estado) {
  const mapa = { pendiente: 'badge-ambar', entregada: 'badge-verde', atrasada: 'badge-rojo' };
  return `<span class="badge ${mapa[estado] || 'badge-gris'}">${escapar(estado)}</span>`;
}

function badgeAsistencia(estado) {
  const mapa = { presente: 'badge-verde', ausente: 'badge-rojo', tarde: 'badge-ambar', justificado: 'badge-azul' };
  return `<span class="badge ${mapa[estado] || 'badge-gris'}">${escapar(estado)}</span>`;
}

function colorBarra(promedio, aprobatoria, notaMaxima) {
  if (promedio >= aprobatoria) return 'verde';
  if (promedio >= aprobatoria - notaMaxima * 0.1) return 'ambar';
  return 'rojo';
}

function nivelCualitativo(valor, cfg) {
  if (valor === null || valor === undefined || isNaN(Number(valor))) return { etiqueta: '—', clase: 'badge-gris' };
  const v = Number(valor);
  if (v >= cfg.nivelExcelente) return { etiqueta: 'Excelente', clase: 'badge-verde' };
  if (v >= cfg.nivelBueno) return { etiqueta: 'Bueno', clase: 'badge-azul' };
  if (v >= cfg.notaAprobatoria) return { etiqueta: 'Regular', clase: 'badge-ambar' };
  return { etiqueta: 'Insuficiente', clase: 'badge-rojo' };
}

function badgeNivel(valor, cfg) {
  const n = nivelCualitativo(valor, cfg);
  return '<span class="badge ' + n.clase + '">' + n.etiqueta + '</span>';
}

function badgeNota(valor, cfg) {
  const n = nivelCualitativo(valor, cfg);
  return '<span class="badge ' + n.clase + '">' + valor + ' / ' + cfg.notaMaxima + '</span>';
}

function textoLeyenda(cfg) {
  return 'Escala de calificación: 0–' + (cfg.notaAprobatoria - 1) + ' Insuficiente · ' +
    cfg.notaAprobatoria + '–' + (cfg.nivelBueno - 1) + ' Regular · ' +
    cfg.nivelBueno + '–' + (cfg.nivelExcelente - 1) + ' Bueno · ' +
    cfg.nivelExcelente + '–' + cfg.notaMaxima + ' Excelente';
}

async function iniciar() {
  const token = window.location.pathname.split('/').filter(Boolean).pop();

  try {
    const resp = await fetch('/api/seguimiento/' + encodeURIComponent(token));
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Enlace no válido.');
    pintar(data);
  } catch (err) {
    $('#cargando').classList.add('oculto');
    $('#error').classList.remove('oculto');
    $('#error-texto').textContent = err.message;
  }
}

function pintar(d) {
  const e = d.estudiante;
  const r = d.resumen;
  const cfg = d.config;

  $('#cargando').classList.add('oculto');
  $('#reporte').classList.remove('oculto');

  $('#titulo-estudiante').textContent = e.nombres + ' ' + e.apellidos;
  $('#subtitulo-tutor').textContent = 'Tutor: ' + e.tutor_nombre;
  $('#curso-estudiante').textContent = e.curso;
  $('#leyenda').textContent = textoLeyenda(cfg);

  // Aviso de riesgo
  const aviso = $('#aviso');
  if (r.promedioGeneral === null) {
    aviso.innerHTML = `<div class="aviso-bien">Todavía no se han registrado calificaciones para este estudiante.</div>`;
  } else if (r.enRiesgo) {
    aviso.innerHTML = `<div class="aviso-riesgo"><strong>Atención:</strong> el promedio general (${r.promedioGeneral}/${cfg.notaMaxima}) está por debajo de la nota aprobatoria (${cfg.notaAprobatoria}). ${
      r.materiasEnRiesgo.length ? 'Materias que requieren refuerzo: ' + escapar(r.materiasEnRiesgo.join(', ')) + '.' : ''
    }</div>`;
  } else if (r.promedioGeneral < cfg.nivelBueno) {
    aviso.innerHTML = `<div class="aviso-ambar"><strong>Nivel Regular:</strong> el promedio general (${r.promedioGeneral}/${cfg.notaMaxima}) aprueba, pero se encuentra en un nivel <strong>Regular</strong>. Se recomienda reforzar las materias con menor puntaje.</div>`;
  } else {
    aviso.innerHTML = `<div class="aviso-bien"><strong>Buen desempeño:</strong> el promedio general (${r.promedioGeneral}/${cfg.notaMaxima}) se encuentra en un nivel <strong>${nivelCualitativo(r.promedioGeneral, cfg).etiqueta}</strong>.</div>`;
  }

  // Mensaje del profesor
  if (d.notificacion && d.notificacion.mensaje) {
    const m = $('#mensaje-profesor');
    m.classList.remove('oculto');
    m.innerHTML = `<strong>Mensaje del docente:</strong> ${escapar(d.notificacion.mensaje)}`;
  }

  // Tarjetas resumen
  const prom = r.promedioGeneral === null ? '—' : r.promedioGeneral;
  const asist = r.porcentajeAsistencia === null ? '—' : r.porcentajeAsistencia + '%';
  $('#tarjetas').innerHTML = `
    <div class="tarjeta ${r.promedioGeneral === null ? '' : (r.promedioGeneral >= cfg.nivelBueno ? 'verde' : (r.promedioGeneral >= cfg.notaAprobatoria ? 'ambar' : 'rojo'))}">
      <div class="etiqueta">Promedio general</div>
      <div class="valor">${prom}${r.promedioGeneral === null ? '' : ' / ' + cfg.notaMaxima}</div>
      <div class="detalle">${r.promedioGeneral === null ? 'sin calificaciones' : 'Nivel: ' + nivelCualitativo(r.promedioGeneral, cfg).etiqueta}</div>
    </div>
    <div class="tarjeta ${r.porcentajeAsistencia !== null && r.porcentajeAsistencia >= 85 ? 'verde' : 'ambar'}">
      <div class="etiqueta">Asistencia</div>
      <div class="valor">${asist}</div>
      <div class="detalle">${r.asistencia.presente} presentes · ${r.asistencia.ausente} ausencias</div>
    </div>
    <div class="tarjeta ${r.tareasAtrasadas ? 'rojo' : 'verde'}">
      <div class="etiqueta">Tareas pendientes</div>
      <div class="valor">${r.tareasPendientes}</div>
      <div class="detalle">${r.tareasAtrasadas} atrasadas de ${r.totalTareas}</div>
    </div>
    <div class="tarjeta">
      <div class="etiqueta">Exámenes</div>
      <div class="valor">${r.totalExamenes}</div>
      <div class="detalle">evaluaciones registradas</div>
    </div>
  `;

  // Rendimiento por materia
  const tbMaterias = $('#tabla-materias');
  if (!d.resumenMaterias.length) {
    tbMaterias.innerHTML = `<tr><td colspan="5" class="vacio">Sin calificaciones registradas.</td></tr>`;
  } else {
    tbMaterias.innerHTML = d.resumenMaterias
      .map((m) => {
        const pct = Math.max(0, Math.min(100, (m.promedio / cfg.notaMaxima) * 100));
        const color = colorBarra(m.promedio, cfg.notaAprobatoria, cfg.notaMaxima);
        return `<tr>
          <td>${escapar(m.materia)}</td>
          <td><strong>${m.promedio}</strong> / ${cfg.notaMaxima}</td>
          <td><div class="barra ${color}"><span style="width:${pct}%"></span></div></td>
          <td>${m.cantidad}</td>
          <td>${badgeNivel(m.promedio, cfg)}</td>
        </tr>`;
      })
      .join('');
  }

  // Notas
  const tbNotas = $('#tabla-notas');
  tbNotas.innerHTML = d.notas.length
    ? d.notas
        .map(
          (n) => `<tr>
            <td>${escapar(n.materia)}</td>
            <td>${escapar(n.periodo)}</td>
            <td>${badgeNota(n.calificacion, cfg)}</td>
            <td>${badgeNivel(n.calificacion, cfg)}</td>
            <td>${formatearFecha(n.fecha)}</td>
            <td>${escapar(n.observacion || '—')}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="6" class="vacio">Sin notas registradas.</td></tr>`;

  // Tareas
  const tbTareas = $('#tabla-tareas');
  tbTareas.innerHTML = d.tareas.length
    ? d.tareas
        .map(
          (t) => `<tr>
            <td>${escapar(t.materia)}</td>
            <td>${escapar(t.titulo)}</td>
            <td>${formatearFecha(t.fecha_entrega)}</td>
            <td>${badgeEstado(t.estado)}</td>
            <td>${t.calificacion == null ? '—' : t.calificacion}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="5" class="vacio">Sin tareas registradas.</td></tr>`;

  // Exámenes
  const tbExamenes = $('#tabla-examenes');
  tbExamenes.innerHTML = d.examenes.length
    ? d.examenes
        .map(
          (x) => `<tr>
            <td>${escapar(x.materia)}</td>
            <td>${escapar(x.titulo)}</td>
            <td>${formatearFecha(x.fecha)}</td>
            <td>${x.calificacion == null ? '—' : badgeNota(x.calificacion, cfg)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="vacio">Sin exámenes registrados.</td></tr>`;

  // Asistencia
  const tbAsistencia = $('#tabla-asistencia');
  tbAsistencia.innerHTML = d.asistencia.length
    ? d.asistencia
        .map(
          (a) => `<tr>
            <td>${formatearFecha(a.fecha)}</td>
            <td>${badgeAsistencia(a.estado)}</td>
            <td>${escapar(a.observacion || '—')}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="3" class="vacio">Sin registros de asistencia.</td></tr>`;
}

iniciar();
