# svnet-cli

Librería TypeScript y CLI **no oficial** para consultar disponibilidad y fichas WHOIS públicas de SVNet. Requiere Bun >= 1.3.

## Instalar y ejecutar

```sh
bun install
# Registrar el comando global en esta máquina
bun link
svnet search mi.sv
svnet whois mi.sv
```

Para crear un ejecutable independiente, sin necesitar Bun en la máquina de destino:

```sh
bun run build
./dist/svnet --help
```

El ejecutable se compila para la plataforma actual; `bun link` instala el comando basado en Bun, no este binario.

## Comandos

```sh
svnet search mi                         # Todas las extensiones que devuelve SVNet
svnet search mi.com.sv                  # Solo ese dominio
svnet whois mi.sv                       # Resuelve el ID antes de consultar WHOIS
svnet whois mi                         # Equivale a mi.sv
svnet whois 36876 --json                # Consulta directa por ID
svnet -s mi                             # Atajo para search
svnet -w mi.sv                          # Atajo para whois
svnet search mi --json --timeout 10000
svnet search mi --no-color
svnet --help
```

La búsqueda devuelve un arreglo de `{ domain, status, id }`. `status` es `available` o `registered`; los disponibles tienen `id: null`. Un nombre numérico en `whois` se interpreta como ID: para consultar el dominio usa, por ejemplo, `123.sv`.

Los errores se escriben en stderr y devuelven código de salida `1`. Una consulta válida devuelve `0`, tanto para dominios disponibles como registrados. `--json` deja stdout listo para procesarlo con otras herramientas.

En una terminal interactiva muestra un indicador animado durante la consulta, estados en verde (disponible) o amarillo (registrado) y errores en rojo. La búsqueda incluye un resumen y un comando sugerido para consultar WHOIS. `Ctrl+C` cancela la consulta y limpia el indicador.

Los colores se desactivan con `--no-color` o la variable `NO_COLOR`. `--json`, los pipes y `TERM=dumb` no muestran animaciones ni colores; la salida JSON no incluye mensajes de progreso.

## Librería

Desde este proyecto, o después de instalarlo como dependencia local con `bun add /ruta/a/svnet-cli`:

```js
import { search, whois } from "svnet-cli";

const domains = await search("mi");
// [{ domain: "mi.org.sv", status: "available", id: null }, ...]

const record = await whois("mi.sv", { timeout: 10000 });
// { domain, status, id, administrativeContact, email, phone,
//   registeredAt, expiresAt, deletionAt }

const byId = await whois(36876);
```

Los campos WHOIS opcionales ausentes son `null`. Las fechas conservan el formato `DD-MM-AAAA` del sitio. Si el dominio está disponible, `whois` devuelve únicamente `{ domain, status: "available", id: null }`. Ambas funciones aceptan `{ timeout }` en milisegundos por petición (por defecto 15000) y lanzan errores ante fallos de red, HTTP o HTML no reconocido. WHOIS por dominio puede hacer dos peticiones.

## Pruebas

```sh
bun test
bun run typecheck
```

Las pruebas usan respuestas simuladas, sin consultar SVNet ni almacenar datos personales reales.

## Alcance

Usa POST a `https://svnet.sv/accion/procesos.php` con `URLSearchParams`: `key=Buscar&ID=1&nombre=...` y `key=Whois&ID=...`. Analiza HTML con `HTMLRewriter` nativo de Bun; `entities` decodifica las entidades HTML.

No registra, renueva ni modifica dominios, ni consulta registros DNS. Depende del HTML público del sitio, no de una API oficial: cambios en SVNet pueden requerir actualizar el parser. No tiene caché ni reintentos automáticos. Consulta con moderación y trata responsablemente los datos de contacto públicos.
