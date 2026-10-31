export const HELP = `svnet — disponibilidad y WHOIS de dominios .sv

Uso:
  svnet search <dominio>       [--json] [--timeout <ms>]
  svnet whois <dominio|id>      [--json] [--timeout <ms>]
  svnet -s <dominio>            [--json] [--timeout <ms>]
  svnet -w <dominio|id>         [--json] [--timeout <ms>]

Ejemplos:
  svnet search mi
  svnet search mi.com.sv --json
  svnet whois mi.sv
  svnet whois 36876 --json

Opciones:
  --json          Salida JSON (estados: available, registered)
  --no-color      Desactivar colores (también respeta NO_COLOR)
  --timeout <ms>  Tiempo máximo por petición (15000 por defecto)
  -h, --help      Mostrar esta ayuda

WHOIS sin extensión consulta .sv. Un dominio disponible no tiene ficha WHOIS.`;

