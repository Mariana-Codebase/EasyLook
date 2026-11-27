# Manual de instalación y demostración

Este manual cubre cómo levantar la API en un equipo local, cargar el catálogo ficticio y recorrer el flujo completo que pide la sección 19 del README: registrarse, consultar prendas, crear un outfit, agregar prendas de varias tiendas, ver el presupuesto, guardarlo en el look book y pedir propuestas a Look Match.

## Requisitos

- Node.js 20 o superior (probado con Node 22).
- PostgreSQL 16. Si no lo tienes instalado, el `docker-compose.yml` del repositorio levanta uno con la base `easylook` y la base de pruebas `easylook_test`.

## Instalación

```bash
git clone https://github.com/Mariana-Codebase/EasyLook.git
cd EasyLook
npm install
cp .env.example .env
```

En `.env` hay que revisar `DATABASE_URL` y cambiar `JWT_SECRET` por un valor aleatorio largo. Este comando genera uno:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Para usar el PostgreSQL de Docker basta con `docker compose up -d db`. La URL por defecto de `.env.example` ya apunta a ese contenedor.

Luego se aplican las migraciones y se carga el catálogo, y se arranca el servidor en modo desarrollo:

```bash
npm run db:reset   # migraciones + datos semilla
npm run dev        # http://localhost:3000
```

Para la interfaz web, en otra terminal:

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

En desarrollo, Vite redirige `/api`, `/docs` y `/openapi.json` a la API en el puerto 3000, así que no hace falta configurar nada más. Para compilar la interfaz contra una API publicada en otra dirección se define `VITE_API_URL` en `web/.env`.

La documentación interactiva queda en `http://localhost:3000/docs` y la especificación OpenAPI en `http://localhost:3000/openapi.json`. Una copia estática está en `docs/openapi.json`; Postman la importa directamente desde *Import > File* y genera la colección con todos los endpoints.

`npm run db:seed` borra y vuelve a cargar todas las tablas, así que solo debe usarse en desarrollo. El script se niega a correr con `NODE_ENV=production`.

## Datos semilla

El seed crea 7 tiendas ficticias, las 5 ocasiones del README (`date`, `office`, `brunch`, `party`, `casual`) y 54 prendas, una de ellas desactivada para mostrar el borrado lógico. Los identificadores son UUID v5 calculados a partir del nombre, de modo que no cambian entre reinicios de la base. La prenda *Blazer crema* conserva el id del ejemplo del README (`28a58b2a-c847-44d4-a2ca-ec1dc35b1001`).

También crea dos cuentas, configurables en `.env`:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@easylook.dev` | `Admin12345!` |
| Usuario | `demo@easylook.dev` | `Demo12345!` |

## Recorrido de demostración

El mismo recorrido se puede hacer desde la interfaz web, desde Postman (carpeta `postman/`) o desde Swagger, donde el botón *Authorize* recibe el token sin el prefijo `Bearer`. Los ejemplos de abajo usan `curl` y `jq`.

```bash
B=http://localhost:3000/api/v1

# 1. Registro (o login con la cuenta demo)
TOKEN=$(curl -s -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Laura Gómez","email":"laura@correo.com","password":"MiClave2026!"}' | jq -r .token)

# 2. Catálogo público: zapatos para una cita por menos de 180.000, del más barato al más caro
curl -s "$B/garments?category=shoes&occasion=date&maxPriceCop=180000&sort=price_asc" | jq '.data[] | {name, priceCop, store: .store.name}'

# 3. Outfit vacío con presupuesto
OUTFIT=$(curl -s -X POST $B/outfits -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Brunch de domingo","occasionCode":"brunch","budgetCop":350000,"currency":"COP"}' | jq -r .id)

# 4. Agregar prendas de distintas tiendas; cada respuesta trae total, saldo y qué falta para un look completo
curl -s -X POST $B/outfits/$OUTFIT/items -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"garmentId":"28a58b2a-c847-44d4-a2ca-ec1dc35b1001"}' | jq '{totalCop, remainingCop, budgetStatus, missingCategories}'

# 5. Pedir propuestas a Look Match (funciona también sin token)
curl -s -X POST $B/recommendations/look-match -H 'Content-Type: application/json' \
  -d '{"occasionCode":"brunch","budgetCop":350000}' | jq '.recommendations[] | {label, score, totalCop, garmentIds, explanation}'

# 6. Copiar una propuesta al outfit, validarlo y guardarlo en el look book
IDS=$(curl -s -X POST $B/recommendations/look-match -H 'Content-Type: application/json' \
  -d '{"occasionCode":"brunch","budgetCop":350000}' | jq -c '.recommendations[0].garmentIds')
curl -s -X POST $B/outfits/$OUTFIT/apply-recommendation -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"garmentIds\":$IDS}" | jq '{totalCop, isComplete}'
curl -s -X POST $B/outfits/$OUTFIT/finalize -H "Authorization: Bearer $TOKEN" | jq '{status, savedAt}'

# 7. Look book: solo los outfits guardados
curl -s "$B/outfits?status=saved" -H "Authorization: Bearer $TOKEN" | jq '.data[] | {name, totalCop, remainingCop}'
```

Algunos casos que vale la pena mostrar porque ejercitan las reglas de negocio:

- Agregar dos veces la misma prenda responde `409 GARMENT_ALREADY_ADDED`.
- Finalizar un outfit sin zapatos responde `400 OUTFIT_INCOMPLETE` con `missingCategories`.
- Finalizar por encima del presupuesto responde `400 BUDGET_EXCEEDED`; con `{"allowOverBudget": true}` en el cuerpo sí se guarda.
- Look Match con `{"occasionCode":"office","budgetCop":100000}` responde `422 NO_MATCH_FOUND` e informa cuánto cuesta el look completo más económico. Con `"allowOverBudget": true` devuelve esa opción marcada como `over_budget`.
- Consultar el outfit de otra persona responde `403 FORBIDDEN_RESOURCE`.

## Pruebas

Las pruebas unitarias cubren las reglas de presupuesto, la completitud del outfit y el motor de Look Match, y no necesitan base de datos. Las de integración recorren los endpoints con Supertest contra una base PostgreSQL real, `easylook_test` por defecto, y aplican las migraciones antes de empezar.

```bash
npm test                 # unitarias + integración
npm run test:unit        # solo reglas de negocio
npm run lint && npm run typecheck
```

Si la base de pruebas está en otra dirección, se indica con `TEST_DATABASE_URL`. El flujo de GitHub Actions en `.github/workflows/ci.yml` corre lint, typecheck, pruebas y build contra un PostgreSQL de servicio en cada push a `main`.

## Docker

`docker compose up --build` levanta PostgreSQL y la API compilada; la API aplica las migraciones al arrancar. El catálogo se carga aparte, una sola vez:

```bash
docker compose run --rm -e NODE_ENV=development api node dist/db/seed.js
```

## Estructura del código

```
web/                       interfaz React + Vite que consume la API
postman/                   colección y entorno de Postman
src/
  config/env.ts            variables de entorno validadas con Zod
  db/                      esquema Drizzle, cliente, migración y datos semilla
  lib/                     errores uniformes, paginación, esquemas comunes
  middleware/              JWT y roles, límites de peticiones, manejo de errores
  modules/
    auth/                  registro, login, perfil y preferencias
    catalog/               tiendas, ocasiones y prendas
    outfits/               outfits, ítems, reglas de presupuesto y completitud
    look-match/            motor de recomendación, configuración y endpoint
  docs/openapi.ts          especificación OpenAPI generada desde los esquemas Zod
drizzle/                   migraciones SQL
tests/unit/                reglas de negocio y Look Match
tests/integration/         endpoints contra PostgreSQL
```

Las validaciones de entrada y la documentación OpenAPI salen de los mismos esquemas Zod, así que Swagger no se desincroniza del código.

## Cómo funciona Look Match

El motor está en `src/modules/look-match/look-match.engine.ts` y es una función pura: no consulta la base de datos, de modo que el mismo catálogo y la misma solicitud siempre dan el mismo resultado. Los pesos y umbrales están en `look-match.config.ts`.

1. Toma las prendas activas, de tiendas activas, marcadas para la ocasión. Si se piden tallas, el filtro se aplica por categoría: una talla de zapato como `37` filtra solo zapatos y una talla de ropa como `M` filtra solo ropa, para que pedir una no deje sin opciones a la otra. Los accesorios no tienen talla y siempre pasan.
2. Por cada categoría base (top, bottom, vestido, zapatos) conserva las 12 prendas que mejor encajan y las 12 más baratas, y con eso arma todas las combinaciones `top + bottom + zapatos` y `vestido + zapatos`.
3. Descarta las que superan el presupuesto. Si no queda ninguna responde `422`, salvo que la solicitud traiga `allowOverBudget=true`, en cuyo caso devuelve solo la combinación más cercana.
4. Puntúa cada combinación de 0 a 100: ocasión 40 % (una prenda en un estilo recomendado para la ocasión suma completo y una que solo está marcada para la ocasión suma la mitad), estilo 30 % (coincidencia con los estilos preferidos o, si no hay, coherencia de estilo del look), presupuesto 20 % (el máximo se alcanza al usar el 90 % del presupuesto) y variedad de tiendas 10 %. La respuesta incluye `scoreBreakdown` con cada criterio.
5. Elige hasta tres propuestas distintas entre sí: `balanced` es la de mayor puntaje; `budget` es la más barata que queda a 20 puntos o menos de la mejor; `statement` es la más costosa dentro de ese mismo margen, y si el presupuesto lo permite le suma un complemento (chaqueta o accesorio).

Cuando hay sesión iniciada y la solicitud no trae `preferredStyles` o `sizes`, se usan las preferencias guardadas con `PATCH /auth/me`. El campo `appliedPreferences` de la respuesta indica de dónde salieron.

## Decisiones de implementación

El README sugiere Prisma como ORM. La implementación usa Drizzle ORM, que cumple el mismo papel (esquema tipado en TypeScript y migraciones SQL versionadas en `drizzle/`) sin depender de binarios externos. El resto del stack sigue la tabla de la sección 16: Node.js, Express, TypeScript, PostgreSQL, OpenAPI y Jest con Supertest.

Algunos puntos que el README dejaba abiertos y cómo quedaron:

- Las prendas no se borran: `DELETE /garments/{id}` las desactiva, porque los outfits guardados las siguen referenciando. Un outfit con una prenda desactivada se puede consultar, pero no finalizar.
- Cambiar la ocasión, el presupuesto o las prendas de un outfit guardado lo devuelve a `draft`, porque hay que validarlo otra vez. Cambiar solo el nombre no.
- Los administradores mantienen el catálogo, pero no ven ni editan outfits ajenos.
- Las propuestas de Look Match devuelven cada prenda como objeto (id, nombre, precio, tienda) y además `garmentIds`, que es lo que recibe `apply-recommendation`. El ejemplo del README mostraba solo los nombres.
- Además de los endpoints del README hay `PATCH /auth/me` para guardar preferencias, `POST` y `PATCH /occasions` para que el administrador mantenga las ocasiones (RF-10), y el parámetro `q` en tiendas y prendas para la búsqueda por texto.
- Cada outfit admite hasta 12 prendas.
- Registro e inicio de sesión comparten un límite de 20 solicitudes cada 15 minutos por IP. Look Match admite 30 por minuto.
