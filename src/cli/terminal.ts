let noColor = "NO_COLOR" in process.env || process.env.TERM === "dumb";
export const color = (text: string | number, code: string | number, stream: NodeJS.WriteStream = process.stdout) =>
  stream.isTTY && !noColor ? `\x1b[${code}m${text}\x1b[0m` : String(text);
export const statusLabel = (status: string) => color(status === "available" ? "Disponible" : "Registrado", status === "available" ? 32 : 33);

export function progress(message: string, quiet?: boolean) {
  if (quiet || !process.stdout.isTTY || !process.stderr.isTTY || process.env.TERM === "dumb") return () => {};
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;
  const draw = () => process.stderr.write(`\r\x1b[2K${color(frames[frame++ % frames.length], 36, process.stderr)} ${message.slice(0, Math.max(0, (process.stderr.columns || 80) - 3))}`);
  const timer = setInterval(draw, 80);
  const cancel = () => {
    stop();
    process.stderr.write("Consulta cancelada.\n");
    process.exit(130);
  };
  process.once("SIGINT", cancel);
  draw();
  function stop() {
    clearInterval(timer);
    process.removeListener("SIGINT", cancel);
    process.stderr.write("\r\x1b[2K");
  }
  return stop;
}

export function disableColor(disable: boolean) { noColor ||= disable; }
