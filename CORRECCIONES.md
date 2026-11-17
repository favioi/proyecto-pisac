# PISAC · Correcciones aplicadas

## Actualización 5 · Lanzadores para Windows (.bat)

Los archivos `INICIAR-PISAC.bat` y `REPARAR-PISAC.bat` se habían generado con
saltos de línea de Linux (LF). El CMD de Windows no interpreta bien los bloques
`if (...)` con LF: la ventana se abría y se cerraba al instante sin mostrar el
error.

- Ahora ambos archivos usan **CRLF** (fin de línea de Windows) y el script de
  empaquetado lo fuerza automáticamente en cada compilación.
- Si querés ver el mensaje cuando algo falla, abrí una terminal en la carpeta
  `pisac` y ejecutá `INICIAR-PISAC.bat`: la ventana queda abierta con el detalle.

## Actualización 4 · Comprobación de la versión de Node.js

El fallo real al instalar era que la máquina tenía **Node.js 12.22.12** (sin
soporte desde 2022). npm fallaba con `code UNKNOWN` y `mkdir ... .staging`
(errno -4094), y antes se veía `Cannot find module 'dotenv'`.

- Los lanzadores (`INICIAR-PISAC.bat`, `REPARAR-PISAC.bat` y sus versiones para
  Mac/Linux) ahora **comprueban la versión de Node.js** y, si es menor que 20,
  muestran un mensaje claro con el enlace de descarga en lugar de errores raros.
- `src/dependencias.js` hace la misma comprobación al arrancar el servidor.
- Se unificó el requisito en **Node.js 20+ (recomendado 22 LTS)** en
  `package.json`, `README.md`, `LEEME.txt` y `npm run verificar`.
- Documentado el error `npm ERR! code UNKNOWN` y la recomendación de usar una
  ruta simple (`C:\PISAC`) en disco local.

## Actualización 3 · Arranque a prueba de fallos

### Error "Cannot find module 'dotenv'" al arrancar
Ocurría cuando la carpeta se copiaba incompleta o `npm install` no terminaba: el
lanzador solo comprobaba que existiera `node_modules`, no su contenido, y Node
mostraba una traza técnica difícil de entender.

- `INICIAR-PISAC.bat` ahora **verifica los seis paquetes necesarios** en cada
  arranque (`dotenv`, `express`, `better-sqlite3`, `jsonwebtoken`, `bcryptjs`,
  `google-auth-library`), comprueba que se puedan cargar (incluido el binario de
  SQLite) e instala automáticamente si falta alguno.
- Si no hay `package.json`, avisa que el ZIP no se extrajo completo.
- Nuevo **`REPARAR-PISAC.bat`** / `reparar-pisac.command`: borra `node_modules`,
  reinstala todo y ejecuta la verificación. No toca `data/`.
- `src/server.js`, `seed-demo.js` y `verificar.js` detectan dependencias
  faltantes y muestran un mensaje en español con los pasos a seguir.

## Actualización 2 · Google, tema oscuro y WhatsApp

### Acceso solo con Google
- La pantalla de acceso ya **no muestra correo y contraseña**: solo el botón
  **Continuar con Google**.
- La primera vez, la propia pantalla pide el **Client ID** y lo guarda en
  `data/config.json`. Ya no hay que editar el archivo `.env` ni reiniciar.
- El profesor se registra automáticamente la primera vez que entra con su cuenta.
- La sesión dura 30 días (no vuelve a pedir la cuenta).
- El inicio con correo y contraseña queda solo como respaldo técnico de la API.

### Tema visual azul/negro
- Fondo negro azulado con degradados y rejilla sutil.
- Tarjetas, tablas, formularios, badges y avisos rediseñados en modo oscuro.
- Pantalla de acceso con panel de marca en azul profundo.
- La página del tutor usa el mismo estilo.

### WhatsApp
- Botón **Enviar por WhatsApp** (`wa.me`) que abre la app con el mensaje y el
  enlace ya escritos.
- Botón **WhatsApp Web** para enviarlo desde la computadora.
- Botones **Copiar enlace** y **Copiar mensaje**.
- Nueva sección **Ajustes → URL pública** para que el enlace abra en el celular
  (túnel o Render), con aviso visible cuando la dirección es local.
- El historial reconstruye el mensaje completo con el enlace.
- Validación del teléfono con código de país.

### Fallo crítico de la página del tutor
- El reporte público se abría en `/s/<token>` pero el CSS y el JavaScript se
  buscaban en `/s/css/...` y `/s/js/...`, así que **la página salía sin estilos
  y sin datos**. Ahora las rutas son absolutas (`/css/styles.css`,
  `/js/seguimiento.js`) y el reporte carga correctamente.
- La pantalla de acceso también se ajustó para celulares (antes el botón de
  Google se salía de la pantalla).

### Otros
- Nueva sección **Ajustes** con el estado de Google y de la URL pública.
- `npm run verificar` ahora revisa el Client ID y la URL pública.
- Guía paso a paso en `GUIA-GOOGLE.md`.


Revisión completa de la aplicación (backend, base de datos y frontend) con pruebas
reales de cada flujo: iniciar sesión, registrar estudiantes, materias, notas,
tareas, exámenes, asistencia, importar Excel/CSV, generar el enlace del tutor y
abrir el reporte público.

---

## 1. Errores corregidos

### 1.1 Una tarea o un examen sin nota se guardaba con 0
`Number('')` y `Number(null)` valen `0`. Al registrar una tarea o un examen sin
calificación, el sistema guardaba **0** en lugar de "sin calificar", lo que
arrastraba el promedio hacia abajo.

- **Ahora:** un campo vacío se guarda como `NULL` (sin calificar) y se muestra "—".
- Archivo: `src/server.js` → `numeroODefecto()`.

### 1.2 Se aceptaban calificaciones fuera de la escala
Se podía guardar una nota de `150`, `-20`, etc. Eso rompía promedios, niveles y
el reporte del tutor.

- **Ahora:** se valida el rango `0 – NOTA_MAXIMA` en notas, tareas y exámenes, y
  se devuelve un mensaje claro: *"La calificación debe estar entre 0 y 100."*
- Además, el formulario pone `min`, `max` y el marcador según la escala configurada.

### 1.3 La plantilla Excel incluida no se podía importar
El archivo `plantillas/plantilla-pisac.xlsx` traía una fila de instrucciones antes
de los encabezados. El importador tomaba esa fila como encabezados y **todas las
filas fallaban** ("Faltan datos obligatorios").

- **Ahora:** el lector busca automáticamente la fila de encabezados entre las
  primeras 15 filas (tolera títulos, filas vacías y notas).
- La plantilla `.xlsx` se regeneró con los encabezados en la primera fila y las
  instrucciones en una hoja aparte.
- Archivo: `public/js/profesor.js` → `detectarFilaEncabezado()`.

### 1.4 Las fechas de Excel se perdían
Las fechas de un `.xlsx` llegaban como número de serie (por ejemplo `46000`) y se
guardaban como texto inválido.

- **Ahora:** se leen como fecha real y se normalizan a `AAAA-MM-DD`. También se
  aceptan `15/01/2026`, `15-01-2026` y el número de serie de Excel.
- Archivos: `public/js/profesor.js` (`cellDates`, `raw:false`, `dateNF`) y
  `src/server.js` (`fechaISO()`).

### 1.5 Importar notas dos veces duplicaba los datos
El README prometía que las filas ya existentes se omitían, pero en las notas
siempre se insertaban de nuevo.

- **Ahora:** se omite la nota si ya existe una igual (mismo estudiante, materia,
  periodo, calificación y fecha), y se informa cuántas se omitieron.

### 1.6 Importaciones grandes fallaban con "Error interno del servidor"
Express aceptaba solo 100 KB de JSON: un Excel con ~1.000 estudiantes devolvía
error 500 y el panel no explicaba qué pasaba.

- **Ahora:** el límite es de 10 MB, con mensaje claro (HTTP 413) si se supera.

### 1.7 Un JSON mal formado devolvía "Error interno del servidor" (500)
- **Ahora:** devuelve HTTP 400 con *"Los datos enviados no son un JSON válido."*

### 1.8 El botón de WhatsApp del historial no incluía el enlace del reporte
Se reenviaba solo el mensaje extra del docente, sin el enlace único.

- **Ahora:** el historial reconstruye el mensaje completo (datos del estudiante,
  promedio, asistencia, tareas y `Ver detalle: <enlace>`).

### 1.9 Fechas desfasadas por la zona horaria
`date('now')` usa UTC: una nota registrada a las 20:00 en Ecuador se guardaba con
la fecha del día siguiente. Además, la fecha de la notificación se mostraba con
5 horas de diferencia.

- **Ahora:** la fecha de la nota se toma del navegador (`hoyISO()`), el respaldo
  del servidor usa `localtime`, y el historial convierte la hora UTC a hora local.

### 1.10 El panel se volvía lento con muchos estudiantes
La pantalla de inicio pedía un reporte completo **por cada estudiante** (una
petición HTTP por alumno).

- **Ahora:** un único endpoint `GET /api/resumen` calcula los totales y la lista
  de estudiantes en riesgo.

### 1.11 Si Google no cargaba, el profesor quedaba sin acceso
Al estar configurado `GOOGLE_CLIENT_ID`, el formulario de correo y contraseña se
ocultaba. Si el script de Google fallaba (sin internet, red bloqueada), no había
ninguna forma de entrar.

- **Ahora:** se muestra automáticamente el acceso con correo y contraseña como
  respaldo.

### 1.12 El servidor se caía con un error críptico si el puerto estaba ocupado
- **Ahora:** mensaje claro con la instrucción para cambiar de puerto (`PORT=3001`).

### 1.13 Otros ajustes
- Protección contra fuerza bruta en el inicio de sesión (12 intentos / 15 min).
- Comparación de contraseña también cuando el correo no existe (evita descubrir
  qué correos están registrados).
- Validación del teléfono del tutor (mínimo 7 dígitos, con código de país).
- Fechas inválidas (`2026-02-31`) rechazadas con mensaje claro.
- `busy_timeout` en SQLite para evitar bloqueos con escrituras simultáneas.
- Cabeceras `X-Content-Type-Options` y `Referrer-Policy`; se oculta `X-Powered-By`.
- Los errores al eliminar registros ya no quedan sin avisar (se muestra el toast).
- Textos corregidos: "1 pendiente" / "2 pendientes", "1 importado" / "2 importados".
- Se quitó la incongruencia de la versión de Node: ahora todo pide **Node.js 22+**.

---

## 2. Cómo se comprobó

- Login correcto e incorrecto, bloqueo por intentos, rutas protegidas.
- Alta de estudiante, nota, tarea, examen y asistencia.
- Validaciones: nota vacía, nota 101, fecha imposible, JSON roto, ruta inexistente.
- Importación de la plantilla oficial, de un Excel con título arriba y de un CSV.
- Duplicados: importar dos veces el mismo archivo no duplica.
- Notificación: enlace `/s/<token>` válido, mensaje de WhatsApp con enlace,
  historial correcto, token inválido → 404.
- Borrado en cascada de una materia con sus notas.
- Panel y página del tutor renderizados en un navegador automatizado, sin errores
  de JavaScript, con datos reales.

---

## 3. Recomendaciones antes de presentar

1. Crea un archivo `.env` a partir de `.env.example` y cambia `JWT_SECRET`.
2. Si vas a publicar la app, cambia también `ADMIN_PASSWORD`.
3. Para el enlace del tutor desde un celular usa un túnel o Render (ver README):
   `localhost` solo abre en tu propia computadora.
