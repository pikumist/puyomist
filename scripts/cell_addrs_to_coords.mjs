const progName = 'node ./scripts/cell_addrs_to_coords.mjs';
const args = process.argv.slice(2);
const firstArg = args[0];

const usage = () => {
  console.log(`Usage: ${progName} [cellAddrs]`);
  console.log(`Example: ${progName} D1,E1,C2`);
};

if (!firstArg) {
  usage();
  process.exit(1);
}

const cellAddrs = firstArg.split(',').map((s) => s.trim());
const coords = cellAddrs.map((cellAddr) => {
  const col = cellAddr[0];
  const row = cellAddr[1];
  const x = col.charCodeAt(0) - 'A'.charCodeAt(0);
  const y = Number.parseInt(row, 10) - 1;
  return {
    x,
    y
  };
});
console.log(JSON.stringify(coords));
