#!/usr/bin/env node
/**
 * README.md の技術スタックバッジを生成する。
 *
 *   node scripts/update-badges.mjs           バッジを書き換える
 *   node scripts/update-badges.mjs --check   ズレていたら異常終了する (CI 用)
 *
 * バージョンは以下から読むので、README には手でバージョンを書かないこと。
 *   - npm パッケージ: package-lock.json の解決済みバージョン
 *   - Node.js:        .nvmrc
 *   - Rust:           packages/solver-wasm/rust-toolchain.toml
 *
 * 並べるバッジそのものは「技術スタックとして何を見せるか」の判断なので BADGES で手で決める。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = join(root, 'README.md');
const START = '<!-- badges:start -->';
const END = '<!-- badges:end -->';

/**
 * @type {{ label: string, source: string, color: string, logo: string, logoColor?: string }[]}
 * source は 'npm:<パッケージ名>' | 'nvmrc' | 'rust-toolchain' | 'none'
 */
const BADGES = [
  { label: 'React', source: 'npm:react', color: '087EA4', logo: 'react' },
  { label: 'TypeScript', source: 'npm:typescript', color: '3178C6', logo: 'typescript' },
  { label: 'Vite', source: 'npm:vite', color: '646CFF', logo: 'vite' },
  { label: 'Tailwind CSS', source: 'npm:tailwindcss', color: '06B6D4', logo: 'tailwindcss' },
  { label: 'zustand', source: 'npm:zustand', color: '764ABC', logo: 'react' },
  { label: 'Rust', source: 'rust-toolchain', color: 'DEA584', logo: 'rust', logoColor: '000000' },
  { label: 'WebAssembly', source: 'none', color: '654FF0', logo: 'webassembly' },
  { label: 'Vitest', source: 'npm:vitest', color: '6E9F18', logo: 'vitest' },
  { label: 'Storybook', source: 'npm:storybook', color: 'FF4785', logo: 'storybook' },
  { label: 'Biome', source: 'npm:@biomejs/biome', color: '60A5FA', logo: 'biome' },
  { label: 'Node.js', source: 'nvmrc', color: '5FA04E', logo: 'nodedotjs' },
];

const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), 'utf8'));

const lock = readJson('package-lock.json');
const pkg = readJson('package.json');

/** package-lock.json の解決済みバージョンを引く。無ければ package.json の範囲指定から読む。 */
function npmVersion(name) {
  const resolved = lock.packages?.[`node_modules/${name}`]?.version;
  if (resolved) return resolved;
  // 巻き上げされずネストして入っている場合。実際のバージョンとズレうるので黙って使わない。
  const range = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (!range) throw new Error(`${name} が package.json にも package-lock.json にも見つからない`);
  const stripped = range.replace(/^[\^~>=<\s]+/, '');
  if (!/^\d/.test(stripped)) {
    throw new Error(`${name} のバージョン "${range}" からバージョン番号を読み取れない`);
  }
  console.warn(
    `警告: ${name} が package-lock.json の node_modules/${name} に無いため、` +
      `package.json の "${range}" から ${stripped} と推定した。実際の導入バージョンと異なる可能性がある。`
  );
  return stripped;
}

function nvmrcVersion() {
  return readFileSync(join(root, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
}

function rustToolchainVersion() {
  const toml = readFileSync(join(root, 'packages/solver-wasm/rust-toolchain.toml'), 'utf8');
  const matched = toml.match(/^\s*channel\s*=\s*"([^"]+)"/m);
  if (!matched) throw new Error('rust-toolchain.toml から channel を読み取れない');
  return matched[1];
}

function versionOf(source) {
  if (source === 'none') return null;
  if (source === 'nvmrc') return nvmrcVersion();
  if (source === 'rust-toolchain') return rustToolchainVersion();
  if (source.startsWith('npm:')) return npmVersion(source.slice(4));
  throw new Error(`未知の source: ${source}`);
}

/** shields.io のパス用エスケープ。'-' は '--'、'_' は '__'、空白は '_' に置く。 */
const escapeBadgeText = (text) => text.replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '_');

function badgeMarkdown({ label, source, color, logo, logoColor }) {
  const version = versionOf(source);
  const subject = version ? `${escapeBadgeText(label)}-${escapeBadgeText(version)}` : escapeBadgeText(label);
  const query = new URLSearchParams({ logo, logoColor: logoColor ?? 'white' });
  const alt = version ? `${label} ${version}` : label;
  return `![${alt}](https://img.shields.io/badge/${subject}-${color}?${query})`;
}

const block = `${START}\n${BADGES.map(badgeMarkdown).join('\n')}\n${END}`;

const readme = readFileSync(readmePath, 'utf8');
const startIndex = readme.indexOf(START);
const endIndex = readme.indexOf(END);
if (startIndex === -1 || endIndex === -1) {
  console.error(`README.md に ${START} / ${END} のマーカーが見つからない`);
  process.exit(1);
}
if (startIndex > endIndex) {
  // このまま slice すると既存ブロックを重複させて README を壊す。
  console.error(`README.md のマーカーの順序が逆になっている (${END} が ${START} より前にある)`);
  process.exit(1);
}

const updated = readme.slice(0, startIndex) + block + readme.slice(endIndex + END.length);

if (process.argv.includes('--check')) {
  if (updated !== readme) {
    console.error('README.md のバッジが古くなっている。`npm run badges` を実行して差分をコミットすること。');
    process.exit(1);
  }
  console.log('README.md のバッジは最新。');
} else if (updated === readme) {
  console.log('README.md のバッジは最新。変更なし。');
} else {
  writeFileSync(readmePath, updated);
  console.log('README.md のバッジを更新した。');
}
