# Cómo abrir y editar PISAC en tu computadora

Guía corta para instalar, arrancar y modificar el proyecto.

---

## 1. Requisitos (una sola vez)

1. **Node.js 22 LTS**: descárgalo de <https://nodejs.org> (instalador `.msi`, botón
   *LTS*). Acepta todas las opciones.
2. **Visual Studio Code** (editor gratuito): <https://code.visualstudio.com>
3. Comprueba en una terminal nueva:

   ```
   node -v
   npm -v
   ```

   Debe decir `v22.x.x` y `10.x.x` o superior.

---

## 2. Instalar el proyecto

1. Descomprime el ZIP en una ruta **simple y local**, por ejemplo `C:\PISAC`.
   Evita `Descargas`, USB, OneDrive y nombres con paréntesis.
2. Entra a `C:\PISAC\pisac` y haz doble clic en `INICIAR-PISAC.bat`.
   La primera vez instala los componentes y abre <http://localhost:3000>.
3. Para cerrar la app: cierra la ventana negra.

> Si algo falla, ejecuta `REPARAR-PISAC.bat`: reinstala todo sin borrar tus datos.

---

## 3. Abrir el proyecto en VS Code

1. Abre VS Code.
2. **Archivo → Abrir carpeta…** y elige `C:\PISAC\pisac`.
3. Instala la extensión recomendada **ESLint** (opcional) y **Spanish Language Pack**
   si quieres el editor en español.

Desde la terminal integrada de VS Code (`Ctrl + ñ` o *Terminal → Nueva terminal*):

```
npm install      # solo la primera vez
npm run dev      # arranca y se reinicia solo al guardar cambios
```

`npm run dev` es el modo cómodo para editar: guardas un archivo y el servidor se
reinicia automáticamente. Recarga el navegador para ver el cambio.

---

## 4. Qué hay en cada carpeta

```
pisac/
├── src/
│   ├── server.js        → API y rutas (la mayor parte de la lógica)
│   ├── db.js            → tablas de la base de datos y datos iniciales
│   ├── config.js        → Client ID de Google y URL pública
│   ├── auth.js          → sesión y verificación de Google
│   ├── reporte.js       → cálculo de promedios, niveles y riesgo
│   ├── dependencias.js  → comprobación de componentes al arrancar
│   ├── verificar.js     → diagnóstico (npm run verificar)
│   └── seed-demo.js     → datos de ejemplo (npm run seed:demo)
├── public/
│   ├── index.html       → pantalla de acceso con Google
│   ├── profesor.html    → panel del profesor (secciones y formularios)
│   ├── seguimiento.html → reporte que ve el tutor
│   ├── css/styles.css   → TODO el diseño y los colores
│   └── js/
│       ├── profesor.js  → lógica del panel
│       └── seguimiento.js → lógica del reporte del tutor
├── data/
│   ├── pisac.db         → base de datos (¡no borrar!)
│   └── config.json      → Client ID y URL pública
├── plantillas/          → modelos CSV/Excel (en la carpeta superior)
└── package.json         → nombre, dependencias y comandos
```

---

## 5. Cambios típicos y dónde hacerlos

### Cambiar colores o el tema

Todo está en `public/css/styles.css`, al inicio, en `:root`:

```css
--azul: #2563eb;        /* color principal */
--fondo: #05080f;       /* fondo general */
--panel: #0d1526;       /* tarjetas y paneles */
--verde: #22c55e;       /* estados positivos */
```

Cambia esos valores y recarga el navegador. Todo el sitio se adapta.

### Cambiar textos, títulos o el nombre "PISAC"

- Panel: `public/profesor.html`
- Acceso: `public/index.html`
- Reporte del tutor: `public/seguimiento.html`
- Mensaje de WhatsApp: `src/server.js` → función `mensajePredeterminado`

### Cambiar la escala de notas

Crea un archivo `.env` copiando `.env.example` y ajusta:

```
NOTA_MAXIMA=10
NOTA_APROBATORIA=7
NIVEL_BUENO=8
NIVEL_EXCELENTE=9
```

Reinicia la app. La escala se aplica en todo el sistema (panel y reporte).

### Cambiar las materias que se crean al inicio

`src/db.js` → función `sembrar()`. Solo afecta a instalaciones nuevas.

### Cambiar el mensaje del reporte o los niveles

`src/reporte.js` → `nivelCualitativo()` y `construirReporte()`.
textos del WhatsApp: `src/server.js` → `mensajePredeterminado()`.

### Agregar una sección nueva al panel

1. En `public/profesor.html` agrega un `<li>` en el menú y una
   `<section id="vista-mia" class="oculto">`.
2. En `public/js/profesor.js` agrega `'mia'` al arreglo `vistas`.
3. Crea tu función `renderMia()` y llámala dentro de `cargarTodo()`.

---

## 6. Base de datos: lo que debes cuidar

- Archivo: `data/pisac.db` (SQLite). Guarda estudiantes, notas, tareas, etc.
- **Haz respaldo**: copia ese archivo a otro lugar de vez en cuando.
- Para **empezar de cero**: cierra la app y borra `data/pisac.db`. Se crea vacía
  al volver a arrancar.
- Para ver los datos: instala la extensión **SQLite Viewer** en VS Code y abre
  `data/pisac.db`.
- Si cambias columnas de una tabla, hazlo también en `src/db.js` (`crearEsquema`)
  y en `migrar()` para no romper bases existentes.

---

## 7. Comandos útiles

| Comando | Para qué sirve |
|---|---|
| `npm run dev` | Arrancar con recarga automática mientras editas |
| `npm start` | Arrancar normal |
| `npm run verificar` | Revisar Node, dependencias, Google y base de datos |
| `npm run seed:demo` | Cargar un estudiante con notas de ejemplo |
| `Ctrl + C` | Detener el servidor |

---

## 8. Errores comunes al editar

| Síntoma | Causa |
|---|---|
| La página no cambia | Falta recargar con `Ctrl + F5`, o el servidor no está en modo `dev`. |
| `Cannot find module ...` | Falta `npm install` (o ejecuta `REPARAR-PISAC.bat`). |
| `EADDRINUSE` | Ya hay otra ventana con PISAC abierta: ciérrala. |
| Error de sintaxis al guardar | Revisa la terminal: indica el archivo y la línea. |
| El botón de Google no aparece | Falta el Client ID: Panel → Ajustes, o revisa `data/config.json`. |
| Los datos desaparecieron | Se borró `data/pisac.db` o se abrió otra copia del proyecto. |

---

## 9. Buenas prácticas

- **No edites** la carpeta `node_modules` (son librerías descargadas).
- **No compartas** `.env` ni `data/pisac.db` con datos reales de estudiantes.
- Antes de un cambio grande, copia la carpeta del proyecto completa como respaldo.
- Si vas a publicar la app, sigue el `README.md` (sección de Render).
