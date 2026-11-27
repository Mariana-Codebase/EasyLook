# Pruebas funcionales con Postman

`EasyLook.postman_collection.json` tiene 64 peticiones agrupadas en seis carpetas (servicio, autenticación, tiendas y ocasiones, prendas, outfits y Look Match). Cada petición trae sus pruebas en la pestaña *Tests*, y entre todas cubren los casos exitosos y los errores de negocio y de seguridad que define la API: 400, 401, 403, 404, 409 y 422, siempre con el cuerpo `{ error: { code, message, details } }`.

La colección está pensada para correrse completa y en orden, porque las peticiones dejan en variables de la colección el token de sesión, el token de administrador y los identificadores que usan las siguientes. El correo del usuario de prueba y el nombre de la tienda nueva llevan la hora en milisegundos, así que se puede repetir sin reiniciar la base.

## En Postman

1. Importa los dos archivos de esta carpeta (*Import > Files*).
2. Elige el entorno **EasyLook local** en la esquina superior derecha.
3. Con la API corriendo y los datos semilla cargados (`npm run db:reset`), abre la colección y usa *Run collection*.

## Desde la terminal

```bash
npm run test:postman
```

Ese script usa Newman, el ejecutor de línea de comandos de Postman. El último resultado guardado está en `docs/evidencias/newman-salida.txt` y el reporte navegable en `docs/evidencias/newman-reporte.html`.

El registro y el inicio de sesión comparten un límite de 20 solicitudes cada 15 minutos por IP. Cada corrida de la colección usa 6, así que caben tres corridas seguidas; para más, arranca la API con `RATE_LIMIT_ENABLED=false`.
