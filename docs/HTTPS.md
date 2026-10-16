# HTTPS y configuración de producción

FastAPI sirve la interfaz y la API desde el mismo origen. En desarrollo se utiliza
HTTP exclusivamente en localhost. Para producción, colocar un proxy TLS delante
de Uvicorn y configurar estas variables en `backend/.env`:

```dotenv
APP_ENV=production
CORS_ORIGINS=https://incidentes.ejemplo.com
```

Sustituir el dominio por el real. La aplicación rechaza orígenes CORS con comodines,
rutas, credenciales o HTTP en producción. CORS controla qué orígenes pueden leer
respuestas en el navegador; la autorización siempre depende del JWT y del rol.

Ejemplo de Nginx en el servidor de despliegue:

```nginx
server {
    listen 80;
    server_name incidentes.ejemplo.com;
    return 308 https://incidentes.ejemplo.com$request_uri;
}

server {
    listen 443 ssl;
    server_name incidentes.ejemplo.com;

    ssl_certificate /etc/letsencrypt/live/incidentes.ejemplo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/incidentes.ejemplo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Incluye el envoltorio multipart; la aplicación limita el archivo a 5 MiB.
    client_max_body_size 6m;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

Los certificados deben corresponder al dominio, ser válidos y renovarse antes de
vencer. Las rutas de certificados del ejemplo se ajustan al servidor. La
configuración no instala Nginx ni emite certificados automáticamente.

Ejecutar Uvicorn desde la raíz del proyecto, sin `--reload`:

```bash
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1
```

El puerto interno solo debe recibir tráfico del proxy. Si el proxy está en otra
máquina, ajustar la IP de confianza y las reglas de red; no confiar en encabezados
reenviados desde cualquier dirección. Así FastAPI reconoce el esquema HTTPS y
evita bucles de redirección. `APP_ENV=production` activa la redirección HTTPS y HSTS
en respuestas seguras; el proxy añade HSTS también a sus propias respuestas.

Acceder directamente a la URL HTTPS para introducir credenciales. La redirección
no protege una contraseña que ya se haya enviado mediante HTTP. Conservar
`JWT_SECRET_KEY`, contraseñas de PostgreSQL y la clave de Supabase únicamente en
el servidor. Crear el bucket `evidencias` como privado; las descargas utilizan
URLs firmadas de diez minutos y no deben publicarse en logs o capturas.

Las firmas iniciales de PNG, JPEG y PDF se comprueban antes de subirlos. Esta
comprobación detecta tipos falsificados simples; no reemplaza un antivirus ni una
validación completa del formato. El proxy limita la solicitud multipart completa,
y la aplicación limita la lectura y el tamaño del archivo a cinco MiB.

El cierre de sesión borra el token del navegador; un token copiado antes del cierre
puede seguir válido hasta su expiración de treinta minutos. Para bloquear el
acceso de un usuario antes de ese plazo se puede desactivar su cuenta en la base:
las rutas verifican su estado actual en cada petición. La limitación de intentos
de login puede configurarse en el proxy del despliegue; no se implementó un
contador distribuido en esta aplicación.
