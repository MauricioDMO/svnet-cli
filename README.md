<div align="center">

# svnet-cli

**Disponibilidad y WHOIS de dominios .sv, desde tu terminal.**

![Bun >= 1.3](https://img.shields.io/badge/Bun-%E2%89%A5%201.3-f9f1e1?logo=bun&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

</div>

> [!IMPORTANT]
> CLI y librería TypeScript **no oficiales**, sin afiliación con SVNet. Solo consulta información pública; no registra ni modifica dominios.

## Inicio rápido

Requiere **Bun >= 1.3**. Desde el directorio del proyecto:

```sh
bun install
bun link # Registrar el comando global en esta máquina

svnet search mi.sv
svnet whois mi.sv
```

Para compilar un ejecutable independiente de Bun, para la plataforma actual:

```sh
bun run build
./dist/svnet --help
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `svnet search mi` | Busca todas las extensiones que devuelve SVNet. |
| `svnet search mi.com.sv` | Consulta solo ese dominio. |
| `svnet whois mi.sv` | Resuelve el ID y consulta la ficha WHOIS. |
| `svnet whois 36876 --json` | Consulta WHOIS directamente por ID, en JSON. |
| `svnet --help` | Muestra la ayuda. |

Atajos: `-s` para `search` y `-w` para `whois`. Un nombre numérico en `whois` es un ID; usa `123.sv` para consultar el dominio.

**Opciones:** `--json`, `--timeout <ms>` (por defecto `15000`) y `--no-color` o `NO_COLOR`.

```sh
svnet search mi --json --timeout 10000
```

Salida con colores e indicador animado en terminal; sin ambos con `--json`, pipes o `TERM=dumb`. Las consultas válidas devuelven código `0`; los errores, `1` y un mensaje en `stderr`.

## Librería

Úsala desde el proyecto o instálala con `bun add /ruta/a/svnet-cli`:

```ts
import { search, whois } from "svnet-cli";

const domains = await search("mi");
// [{ domain: "mi.org.sv", status: "available", id: null }, ...]

const record = await whois("mi.sv", { timeout: 10000 });
```

Los estados son `available` o `registered`. Los disponibles tienen `id: null`; WHOIS devuelve solo dominio, estado e ID si están disponibles. Los campos opcionales ausentes son `null` y las fechas usan `DD-MM-AAAA`.

Ambas funciones aceptan `{ timeout }` por petición y lanzan errores de red, HTTP o HTML no reconocido. WHOIS acepta dominio o ID numérico; por dominio puede hacer dos peticiones.

## Desarrollo

```sh
bun test
bun run typecheck
```

Las pruebas usan respuestas simuladas, sin consultar SVNet ni almacenar datos personales reales.

## Alcance

Depende del HTML público de SVNet: cambios en el sitio pueden requerir actualizar el parser. Sin consultas DNS, caché ni reintentos automáticos. Consulta con moderación y trata responsablemente los datos de contacto públicos.
