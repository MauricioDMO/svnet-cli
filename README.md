<div align="center">

# svnet-cli

**Consulta la disponibilidad y el WHOIS de dominios `.sv` desde tu terminal.**

![Bun >= 1.3](https://img.shields.io/badge/Bun-%E2%89%A5%201.3-f9f1e1?logo=bun&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)
[![Licencia MIT](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE)

</div>

> [!IMPORTANT]
> Herramienta **no oficial**, sin afiliación con SVNet. Solo consulta información pública: no registra ni modifica dominios.

## ¿Qué puedes hacer?

- **Buscar** si un nombre de dominio está disponible o ya registrado.
- **Consultar el WHOIS** de un dominio registrado.
- **Usarla en tus proyectos** de TypeScript o JavaScript como librería.

## Instalación

Necesitas [Bun](https://bun.sh) 1.3 o superior. Desde la carpeta del proyecto:

```sh
bun install
bun link
```

`bun link` registra el comando `svnet` en tu máquina, así que podrás usarlo desde cualquier carpeta.

¿Prefieres un ejecutable independiente? Compílalo con:

```sh
bun run build
./dist/svnet --help
```

## Uso

| Comando                  | Qué hace                                         |
| ------------------------ | ------------------------------------------------ |
| `svnet search mi`        | Busca `mi` en todas las extensiones disponibles. |
| `svnet search mi.com.sv` | Consulta solo ese dominio.                       |
| `svnet whois mi.sv`      | Muestra la ficha WHOIS del dominio.              |
| `svnet whois 36876`      | Consulta WHOIS usando el ID del dominio.         |
| `svnet --help`           | Muestra la ayuda.                                |

Atajos: `-s` para `search` y `-w` para `whois`.

> **Tip:** en `whois`, un número solo se interpreta como ID. Para consultar un dominio que empieza con números, escribe el dominio completo, por ejemplo `123.sv`.

### Opciones

| Opción           | Descripción                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `--json`         | Muestra el resultado en formato JSON, ideal para scripts.          |
| `--timeout <ms>` | Tiempo máximo de espera por consulta. Por defecto: `15000`.        |
| `--no-color`     | Desactiva los colores. También puedes usar la variable `NO_COLOR`. |

```sh
svnet search mi --json --timeout 10000
```

## Uso como librería

```ts
import { search, whois } from "svnet-cli";

const dominios = await search("mi");
// [{ domain: "mi.org.sv", status: "available", id: null }, ...]

const ficha = await whois("mi.sv", { timeout: 10000 });
```

- `status` puede ser `available` (disponible) o `registered` (registrado).
- Los campos sin información aparecen como `null`.
- Las fechas usan el formato `DD-MM-AAAA`.
- Ambas funciones aceptan `timeout` para personalizar el tiempo de espera.

## Desarrollo

```sh
bun test
bun run typecheck
```

## Aviso

Esta herramienta obtiene la información desde el sitio público de SVNet. Si ese sitio cambia, es posible que algunas consultas dejen de funcionar hasta que se actualice el proyecto. Consulta con moderación y trata con responsabilidad los datos de contacto que aparezcan.

## Licencia

Distribuido bajo licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
