const progName = 'node ./scripts/coords_to_cell_addrs.mjs';
const args = process.argv.slice(2);
const firstArg = args[0];

const usage = () => {
  console.log(`Usage: ${progName} [coords]`);
  console.log(
    `Example: ${progName} '[{"x":3,"y":0},{"x":4,"y":0},{"x":2,"y":1}]'`
  );
};

if (!firstArg) {
  usage();
  process.exit(1);
}

const coords = JSON.parse(firstArg);
const cellAddrs = coords.map((coord) => {
  const col = String.fromCharCode('A'.charCodeAt(0) + coord.x);
  const row = String(coord.y + 1);
  return `${col}${row}`;
});
console.log(cellAddrs.join(','));
