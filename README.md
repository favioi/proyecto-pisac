# PISAC · Plataforma de Interacción y Seguimiento Académico

Aplicación web para que el **profesor** registre el rendimiento académico de sus
estudiantes (notas, tareas, exámenes y asistencia) y **notifique al tutor** con un
enlace privado que llega por **WhatsApp**, donde el representante ve el reporte
completo y detallado.

---

## ✨ Funcionalidades

| Módulo | Descripción |
|---|---|
| **Estudiantes** | Registro de datos del estudiante y de su tutor (nombre y teléfono). |
| **Materias** | Catálogo de asignaturas. |
| **Notas** | Calificaciones por estudiante, materia y periodo. |
| **Tareas** | Estado de trabajos y deberes (pendiente / entregada / atrasada). |
| **Exámenes** | Resultados de pruebas y evaluaciones. |
| **Asistencia** | Registro diario (presente / ausente / tarde / justificado). |
| **Notificaciones** | Genera un enlace único por estudiante y lo envía por WhatsApp. |
| **Vista del tutor** | Página pública con el reporte: promedio, materias en riesgo, notas, tareas, exámenes y asistencia. |

El sistema detecta automáticamente a los estudiantes con **promedio por debajo de la
nota aprobatoria** y los marca como "en riesgo".

---

## 🧱 Tecnología

- **Backend:** Node.js + Express
- **Base de datos:** SQLite (archivo local, sin servidor externo)
- **Autenticación:** JWT + contraseñas cifradas con bcrypt
- **Frontend:** HTML, CSS y JavaScript puro (sin frameworks)

---

## 🚀 Instalación y ejecución

Requisitos: **Node.js 20 o superior** (recomendado: la **LTS 22** de nodejs.org).

```bash
# 0. (Recomendado) Comprobar que todo esté listo
npm run verificar

# 1. Entrar a la carpeta del proyecto
cd pisac

# 2. Instalar dependencias
npm install

# 3. (Opcional) crear el archivo de configuración
cp .env.example .env

# 4. Iniciar el servidor
npm start
```

Luego abre en el navegador: **http://localhost:3000**

> Si al instalar aparece el aviso *"1 package has install scripts not yet covered by allowScripts"*
> (npm 11 o superior bloquea los scripts de instalación), ejecuta:
> ```bash
> npm install-scripts approve better-sqlite3
> npm rebuild better-sqlite3
> ```

### Iniciar sesión

La app se puede abrir de dos formas:

1. **Acceso directo (recomendado para empezar):** en la computadora donde corre
   PISAC aparece el botón **Entrar al panel**. No pide cuenta ni contraseña. Este
   acceso está limitado a `localhost`: si la app se publica en internet, queda
   deshabilitado automáticamente.
2. **Cuenta de Google:** al conectar el Client ID (paso a paso abajo), aparece el
   botón **Continuar con Google** y cada profesor entra con su propia cuenta.

> La cuenta de profesor se crea automáticamente la primera vez que alguien entra
> con su cuenta de Google.

> 🔧 **Recuperación:** si alguna vez Google no está disponible, el inicio con
> correo y contraseña sigue existiendo en la API (`POST /api/auth/login`) con el
> usuario `admin@pisac.edu` / `admin123`. No se muestra en la interfaz porque el
> acceso normal es con Google.

---

## 🆘 Si algo falla al instalar

### Error `npm ERR! code UNKNOWN` / `mkdir ... .staging` (errno -4094)

Suele deberse a una **versión de Node.js demasiado antigua** (por ejemplo Node 12,
que ya no recibe soporte) o a que la carpeta está en un lugar problemático.

1. Comprueba la versión:

   ```bash
   node -v
   ```

   Debe decir **v20** o superior (recomendado **v22 LTS**). Si dice v12/v14/v16,
   instala la LTS desde <https://nodejs.org> y cierra todas las terminales.

2. Usa una ruta simple y en disco local, por ejemplo `C:\PISAC`. Evita unidades
   USB, carpetas sincronizadas con OneDrive y nombres con paréntesis
   (`pisac (3)`).

3. Vuelve a intentar:

   ```bash
   npm cache clean --force
   npm install
   ```

   En Windows, `REPARAR-PISAC.bat` hace esto automáticamente.

> Los avisos `EBADENGINE ... Unsupported engine` que aparecen con Node viejo son
> la señal de que hay que actualizar Node antes de instalar.

### Error `Cannot find module 'dotenv'` (o `express`, `better-sqlite3`…)

Faltan los componentes: la carpeta se copió incompleta o la instalación no
terminó. La app ahora lo detecta y muestra un mensaje claro en lugar de la traza
de Node.

**Solución rápida (Windows):** doble clic en `REPARAR-PISAC.bat`. Borra
`node_modules`, lo reinstala y vuelve a comprobar todo. **No borra la base de
datos** (está en `data/`).

**Solución manual:**

```bash
npm install
```

Si el mensaje dice que falta `package.json`, el ZIP no se extrajo completo:
extrae el archivo `.zip` en una carpeta normal (no lo ejecutes desde dentro del
ZIP) y abre la carpeta `pisac`.

> El lanzador `INICIAR-PISAC.bat` ahora revisa los seis paquetes necesarios cada
> vez que se abre; si falta alguno, instala automáticamente antes de arrancar.

### Error de `better-sqlite3` / `node-gyp` / `Could not find any Python installation`

Ocurre con **Node.js 24** y versiones antiguas de `better-sqlite3`, que intentan
compilarse y necesitan Python y Visual Studio. La solución es usar la **versión 13**,
que ya trae los binarios incluidos y **no necesita aprobar ningún permiso**:

```bash
npm install better-sqlite3@13
```

### Aviso `npm warn install-scripts ... not yet covered by allowScripts`

El npm 11 bloquea los scripts de instalación por seguridad. La versión 13 de
`better-sqlite3` no usa scripts, así que con este comando desaparece:

```bash
npm install better-sqlite3@13
```

Si sigue fallando, borra las dependencias y vuelve a instalar:

```bash
# Windows
rmdir /s /q node_modules
del package-lock.json
npm install
```

```bash
# Mac / Linux
rm -rf node_modules package-lock.json
npm install
```

### Error `'npm' no se reconoce como comando`

Falta Node.js. Instálalo desde https://nodejs.org (versión **LTS**) y **vuelve a
abrir** el terminal.

### Error `EADDRINUSE`

El puerto 3000 ya está ocupado. Cierra la otra aplicación o arranca en otro puerto:

```bash
PORT=3001 npm start
```

---

## 📊 Datos de demostración (opcional)

Para ver el sistema con información ya cargada (un estudiante de ejemplo con notas,
tareas, exámenes y asistencia):

```bash
npm run seed:demo
```

---

## 📥 Importar los datos del colegio (Excel o CSV)

No hace falta escribir estudiante por estudiante. Se puede cargar todo de una vez.

### 1. Descargar la plantilla

En el panel, entra a **Estudiantes → Importar estudiantes desde Excel o CSV →
⬇️ Descargar plantilla**. También está el botón equivalente en **Materias** y en
**Notas**.

### 2. Llenarla

| Hoja | Columnas |
|---|---|
| **Estudiantes** | Nombres · Apellidos · Curso · Nombre del tutor · Teléfono del tutor |
| **Materias** | Nombre de la materia · Docente |
| **Notas** *(opcional)* | Apellidos · Nombres · Materia · Periodo · Calificación · Observación · Fecha |

Reglas:

- No cambies los nombres de las columnas (la primera fila).
- El teléfono del tutor debe incluir el código de país: `+593999111222`.
- La calificación va **sobre 100** (aprobado desde 51).
- Borra las filas de ejemplo antes de subir el archivo.

### 3. Subirla

Pulsa **📥 Importar archivo** y elige el Excel (`.xlsx`) o el CSV. La app te dice
cuántos se importaron, cuántos se omitieron y qué filas tuvieron problemas.

> 💡 Se puede subir el mismo archivo varias veces: las filas que ya existen se
> **omiten** automáticamente, así que no se duplican datos.

### Detalles útiles

- Los encabezados son flexibles: `Nombre del tutor`, `Representante` o `Tutor`
  funcionan igual; `Teléfono`, `Celular` o `WhatsApp` también.
- Para importar **notas**, el estudiante y la materia deben existir antes, y los
  apellidos y nombres deben coincidir con la hoja *Estudiantes*.
- En un Excel con varias hojas, la app busca automáticamente la hoja llamada
  `Estudiantes`, `Materias` o `Notas`.

---

## 🔄 Flujo de uso

1. El profesor entra al panel con **su cuenta de Google**.
2. Registra **estudiantes** (con el teléfono del tutor, incluyendo código de país: `+593…`).
3. Carga **materias**, **notas**, **tareas**, **exámenes** y **asistencia**.
4. En **Ajustes → URL pública** pega la dirección desde la que se abrirá la app
   (Render o un túnel). Sin esto, el enlace solo funciona en tu computadora.
5. En la pestaña **Notificaciones**, elige al estudiante y pulsa
   *"Generar enlace y notificar"*.
6. Se genera un **enlace único** (`/s/<token>`) y botones para enviarlo:
   - **Enviar por WhatsApp** (`wa.me`): abre la app de WhatsApp con el mensaje listo.
   - **WhatsApp Web**: abre WhatsApp en el navegador.
   - **Copiar mensaje / Copiar enlace**: para pegarlo donde prefieras.
7. El tutor abre el enlace y ve el reporte completo.

> PISAC **no envía mensajes por sí sola**: prepara el texto y el enlace y abre
> WhatsApp. Así funciona con cualquier número, sin costo y sin configurar una API
> de pago. Solo hay que pulsar *Enviar* dentro de WhatsApp.

---

## 🌐 Enlaces que funcionan en el celular

La app elige la dirección de los enlaces **automáticamente**, en este orden:

1. La **URL pública guardada** (Render, túnel o dominio propio).
2. La **dirección con la que se abrió el panel** (si entras por el túnel, usa el túnel).
3. La **IP de la red local** (`http://192.168.x.x:3000`): los enlaces abren en
   celulares conectados al **mismo Wi-Fi** que la computadora.
4. `localhost` como último recurso.

No hay que configurar nada para el caso 3: al arrancar, la consola muestra la
dirección de red disponible. Para que abra con **datos móviles u otra red**, sí se
necesita una dirección pública: un túnel de Cloudflare o la app publicada en
Render, que se guarda en **Ajustes → Dirección pública** y ya no se vuelve a pedir.

> En Windows, la primera vez que arranca Node puede aparecer un aviso del
> Firewall: hay que permitir el acceso en **Redes privadas** para que el celular
> pueda abrir el enlace.

---

## 📁 Estructura del proyecto

```
pisac/
├── package.json
├── .env.example
├── src/
│   ├── server.js       # API REST + servidor Express
│   ├── db.js           # Conexión, esquema y datos iniciales
│   ├── config.js       # Configuración editable (Google y URL pública)
│   ├── auth.js         # JWT, Google y middleware de autenticación
│   ├── reporte.js      # Cálculo del reporte académico
│   └── seed-demo.js    # Datos de demostración
├── public/
│   ├── index.html          # Acceso con Google
│   ├── profesor.html       # Panel del profesor
│   ├── seguimiento.html    # Vista pública del tutor
│   ├── css/styles.css
│   └── js/
│       ├── profesor.js
│       └── seguimiento.js
└── data/
    ├── pisac.db        # Base de datos (se crea automáticamente)
    └── config.json     # Client ID y URL pública (se crea al configurar)
```

---

## 🔌 Endpoints principales de la API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicio de sesión con correo y contraseña (respaldo) |
| `POST` | `/api/auth/google` | **Inicio de sesión con Google** (crea la cuenta si es nueva) |
| `GET` | `/api/auth/me` | Datos del profesor con la sesión activa |
| `GET/POST/PUT/DELETE` | `/api/estudiantes` | Gestión de estudiantes |
| `GET/POST/PUT/DELETE` | `/api/materias` | Gestión de materias |
| `GET/POST/DELETE` | `/api/notas` | Gestión de notas |
| `GET/POST/PUT/DELETE` | `/api/tareas` | Gestión de tareas |
| `GET/POST/PUT/DELETE` | `/api/examenes` | Gestión de exámenes |
| `GET/POST/DELETE` | `/api/asistencia` | Gestión de asistencia |
| `POST` | `/api/importar/estudiantes` | Importación masiva de estudiantes |
| `POST` | `/api/importar/materias` | Importación masiva de materias |
| `POST` | `/api/importar/notas` | Importación masiva de notas |
| `GET/POST` | `/api/notificaciones` | Generar y listar notificaciones |
| `GET` | `/api/seguimiento/:token` | Reporte público del tutor |
| `GET` | `/api/reporte/:id` | Reporte interno del profesor |

---

## ✅ Comprobar que todo esté listo

Antes de arrancar (o si algo no funciona), ejecuta:

```bash
npm run verificar
```

Revisa Node.js, las dependencias, el archivo `.env`, el Client ID de Google, la
base de datos y la escala de calificación, y te dice **exactamente qué falta**.

---

## 🔐 Inicio de sesión con Google (cuentas de varios profesores)

Cada profesor entra con **su propia cuenta de Google**. Si es la primera vez, su
cuenta se **crea automáticamente**. Todos los profesores tienen los mismos
permisos, y la sesión se recuerda durante **30 días** (no vuelven a escribir nada).

### Paso 1 · Crear el Client ID en Google Cloud (gratis)

1. Entra a **https://console.cloud.google.com/** con tu cuenta de Google.
2. Arriba, pulsa **Seleccionar proyecto → Proyecto nuevo**, ponle `PISAC` y créalo.
3. Menú **☰ → APIs y servicios → Pantalla de consentimiento de OAuth**:
   - **Tipo de usuario:** Externo → **Crear**.
   - **Nombre de la aplicación:** `PISAC`
   - **Correo de asistencia** y **Correo del desarrollador:** tu correo.
   - Guarda y continúa (los pasos de permisos puedes dejarlos por defecto).
4. Menú **☰ → APIs y servicios → Credenciales → Crear credenciales →
   ID de cliente de OAuth**:
   - **Tipo de aplicación:** Aplicación web
   - **Nombre:** `PISAC Web`
   - **Orígenes de JavaScript autorizados** — agrega una línea por cada dirección
     desde donde se usará la app:
     ```
     http://localhost:3000
     https://tu-app.onrender.com
     ```
     (cambia la segunda por la URL real que te dé Render)
   - **No hace falta** URI de redireccionamiento ni clave secreta.
   - Pulsa **Crear** y copia el **Client ID** (termina en
     `.apps.googleusercontent.com`).

### Paso 2 · Conectar Google en la app

No hace falta editar archivos. Al abrir la app por primera vez aparece un
asistente que pide el **Client ID**; se pega ahí y se pulsa *Guardar y activar
Google*. El valor se guarda en `data/config.json`.

También se puede fijar por variable de entorno (útil en Render):

```
GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
```

> Si la variable de entorno existe, tiene prioridad y el panel no permitirá
> cambiarla desde la interfaz.

> ⚠️ **Importante:** el origen autorizado en Google Cloud debe coincidir
exactamente con la dirección del navegador. Si abres la app como
`http://127.0.0.1:3000`, agrega ese origen también (o usa siempre
`http://localhost:3000`).

### Paso 3 · Permitir quién puede entrar

En la **Pantalla de consentimiento de OAuth** tienes dos modos:

| Modo | Quién puede entrar | Advertencia |
|---|---|---|
| **Prueba** (recomendado para el colegio) | Solo los correos que agregues en **Usuarios de prueba** (hasta 100) | Ninguna |
| **En producción** (botón *Publicar aplicación*) | Cualquier persona con cuenta de Google | Google muestra un aviso de "app no verificada" hasta que la verifiquen |

> 💡 Para una entrega o demo, usa el modo **Prueba** y agrega ahí los correos de
> los profesores: entran sin ninguna advertencia.

---

## 🌐 Poner la app a funcionar de verdad

Hay tres escenarios. Elige según lo que necesites.

### Opción 1 · Solo en tu computadora (para probar o presentar)

```bash
npm install
npm start
```

Abre `http://localhost:3000` y ya funciona todo. **Limitación:** el enlace que
recibe el tutor (`http://localhost:3000/s/...`) solo abre en tu mismo computador.
Sirve para demostrar, no para que el tutor lo use desde su celular.

### Opción 2 · Demo rápido con túnel (el tutor lo abre desde su celular hoy)

Ejecuta la app en tu PC y expónla a internet con un túnel gratuito:

```bash
# Con cloudflared (recomendado, no requiere cuenta)
cloudflared tunnel --url http://localhost:3000

# o con ngrok
ngrok http 3000
```

Te dará una URL pública tipo `https://algo-random.trycloudflare.com`. Copia esa
URL en el archivo `.env` como `BASE_URL` y reinicia la app:

```
BASE_URL=https://algo-random.trycloudflare.com
```

Ahora el enlace de WhatsApp sí abrirá en el celular del tutor.

> ⚠️ La URL del túnel cambia cada vez que lo reinicias y solo funciona mientras
tu computadora esté encendida y el túnel activo. Ideal para una presentación.

### Opción 3 · Publicada en internet (definitiva)

Recomendado: **Render** (tiene plan gratuito).

1. Sube la carpeta `pisac` a un repositorio de **GitHub**.
   (Asegúrate de que `package.json` quede en la **raíz** del repositorio.)
2. Entra a https://render.com → **New** → **Web Service** → conecta tu repositorio.
3. Configura:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. En **Environment → Environment Variables**, agrega:

   | Variable | Valor |
   |---|---|
   | `BASE_URL` | `https://tu-app.onrender.com` (la URL que te dé Render) |
   | `JWT_SECRET` | una cadena larga y secreta |
   | `ADMIN_EMAIL` | tu correo de administrador |
   | `ADMIN_PASSWORD` | tu contraseña segura |
   | `NOTA_MAXIMA` | `100` |
   | `NOTA_APROBATORIA` | `51` |
   | `NIVEL_BUENO` | `71` |
   | `NIVEL_EXCELENTE` | `91` |

5. Pulsa **Create Web Service**. Al terminar, tu app estará en
   `https://tu-app.onrender.com` y los enlaces de WhatsApp apuntarán ahí.

> También incluimos un archivo **`render.yaml`** para desplegar más rápido con
> **New → Blueprint**.

#### ⚠️ Importante sobre la base de datos

La versión gratuita de Render **borra el archivo de la base de datos** cada vez
que la app se reinicia o se vuelve a desplegar. Para conservar los datos:

- **Opción A (recomendada):** agrega un **Disco persistente** en Render
  (Settings → Disks), móntalo en `/data` y define la variable
  `DB_PATH=/data/pisac.db`.
- **Opción B:** usa Railway o Fly.io, que también permiten volúmenes persistentes.

Con el disco persistente, los datos se conservan entre reinicios.
