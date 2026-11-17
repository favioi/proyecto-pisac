# Conectar el acceso con Google (paso a paso)

PISAC entra **únicamente con una cuenta de Google**. Para que el botón funcione
necesitas crear un **Client ID** gratuito en Google Cloud. Se hace una sola vez y
toma unos 5 minutos.

> No necesitas tarjeta de crédito ni instalar nada.

---

## 1. Crear el proyecto

1. Abre <https://console.cloud.google.com/> e inicia sesión con la cuenta de
   Google que usarás para el colegio (o con la que presentarás el proyecto).
2. Arriba a la izquierda, pulsa el selector de proyecto → **Proyecto nuevo**.
3. Nombre: `PISAC` → **Crear**. Espera unos segundos y selecciona el proyecto.

## 2. Configurar la pantalla de consentimiento

1. Menú **☰ → APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** → **Crear**.
3. Completa:
   - **Nombre de la aplicación:** `PISAC`
   - **Correo de asistencia:** tu correo
   - **Correo del desarrollador:** tu correo
4. Guarda y continúa. En *Permisos* y *Usuarios de prueba* puedes dejar lo que
   viene por defecto.
5. En **Usuarios de prueba**, pulsa **Agregar usuarios** y escribe **tu propio
   correo de Gmail**. Sin este paso Google dirá "Acceso bloqueado".

> Con la app en modo **Prueba** solo pueden entrar los correos de esa lista
> (hasta 100). Para una demo o un colegio es lo recomendado: nadie más entra y no
> aparece ninguna advertencia.

## 3. Crear el Client ID

1. Menú **☰ → APIs y servicios → Credenciales**.
2. **Crear credenciales → ID de cliente de OAuth**.
3. Tipo de aplicación: **Aplicación web**.
4. Nombre: `PISAC Web`.
5. En **Orígenes de JavaScript autorizados**, pulsa **Agregar URI** y escribe
   exactamente:

   ```
   http://localhost:3000
   ```

   Si vas a publicar la app, agrega también tu dirección pública, por ejemplo:

   ```
   https://tu-app.onrender.com
   ```

6. **No** hace falta poner URI de redireccionamiento ni clave secreta.
7. **Crear** y copia el valor que empieza por números y termina en
   `.apps.googleusercontent.com`.

## 4. Pegarlo en PISAC

1. Abre la app: <http://localhost:3000>
2. Pega el Client ID en el campo y pulsa **Guardar y activar Google**.
3. La página se recarga y aparece el botón **Continuar con Google**.
4. Entra con tu cuenta. La primera vez se crea tu cuenta de profesor
   automáticamente.

El valor queda guardado en `pisac/data/config.json`, así que no tienes que
volver a escribirlo.

---

## Problemas frecuentes

| Mensaje | Causa y solución |
|---|---|
| **Error 400: origin_mismatch** | La dirección del navegador no está autorizada. Si abres `127.0.0.1:3000`, agrega ese origen en Google Cloud o usa `localhost:3000`. |
| **Acceso bloqueado / app no verificada** | Tu correo no está en *Usuarios de prueba*. Agrégalo en la pantalla de consentimiento. |
| **No aparece el botón** | No hay internet, o el Client ID está mal copiado. Recarga la página; el mensaje rojo indica el motivo. |
| **"El inicio con Google no está configurado"** | El Client ID se borró de `data/config.json`. Vuelve a pegarlo en la pantalla de acceso. |
| **Cambié de Client ID y no toma el nuevo** | Cierra sesión, o borra `data/config.json` y vuelve a pegarlo. |

---

## Si Google falla durante la presentación

El inicio con Google necesita internet. Si el lugar no tiene wifi estable:

1. Usa los datos móviles del celular como punto de acceso.
2. Como respaldo técnico, el inicio con correo y contraseña sigue disponible en
   la API (`POST /api/auth/login`) con `admin@pisac.edu` / `admin123`; no aparece
   en la interfaz porque el acceso normal es con Google.

---

## WhatsApp: qué es automático y qué no

PISAC **no** envía mensajes sola. Genera el enlace y el texto, y abre WhatsApp
con todo listo; tú pulsas **Enviar**. Eso permite usar cualquier número, sin
pagar una API y sin trámites.

Para que el enlace del tutor abra desde su celular, la app necesita una dirección
pública:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copia la dirección `https://algo.trycloudflare.com` y pégala en
**Panel → Ajustes → URL pública**. Desde ese momento los enlaces de WhatsApp
apuntan ahí.

> Un túnel gratuito cambia de dirección cada vez que lo reinicias; si cambia,
> vuelve a pegarla en Ajustes. Para una entrega definitiva, publica la app en
> Render y usa esa dirección fija.
