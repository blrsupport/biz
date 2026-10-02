// Makes the LAST line of a failed tool say what failed.
// Without this, Node prints the stack and then its own version, so anyone who reads only the end of the output
// (a tail, a truncated log) sees "Node.js v..." and nothing else, and takes a real error for a passing fault.
const say = (e) => {
  const stack = String(e?.stack ?? e).split("\n");
  const where = stack.slice(1, 4).join("\n");
  if (where) console.error(where);
  console.error(`FAILED: ${String(e?.message ?? e).split("\n")[0]}`);
  process.exit(1);
};
process.on("uncaughtException", say);
process.on("unhandledRejection", say);
