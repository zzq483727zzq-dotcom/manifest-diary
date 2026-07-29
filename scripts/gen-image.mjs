#!/usr/bin/env node
/**
 * Project-local image generator for Clarity / Impeccable.
 * Reads:
 *   .impeccable/image-config.json  (base_url, model, size)
 *   .impeccable/image.local.env    (OPENAI_API_KEY) — gitignored
 * or process env OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_IMAGE_MODEL
 *
 * Usage:
 *   node scripts/gen-image.mjs --prompt "..." --out path.png
 *   node scripts/gen-image.mjs --prompt-file p.txt --out path.png [--size 1536x1024] [--quality medium]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : fallback;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(root, '.impeccable', 'image.local.env'));

const configPath = path.join(root, '.impeccable', 'image-config.json');
const config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : {};

const key = process.env.OPENAI_API_KEY;
const base = (process.env.OPENAI_BASE_URL || config.base_url || 'https://api.openai.com/v1').replace(/\/$/, '');
const model = process.env.OPENAI_IMAGE_MODEL || config.image_model || 'gpt-image-2';

if (!key) {
  console.error('gen-image: OPENAI_API_KEY missing. Set .impeccable/image.local.env or env var.');
  process.exit(1);
}

const promptFile = arg('prompt-file');
const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8') : arg('prompt');
const out = arg('out');
if (!prompt || !out) {
  console.error('gen-image: --prompt (or --prompt-file) and --out required');
  process.exit(1);
}

const size = arg('size', config.default_size || '1536x1024');
const quality = arg('quality', config.default_quality || 'medium');

const response = await fetch(`${base}/images/generations`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
});

if (!response.ok) {
  const text = await response.text();
  console.error(`gen-image: API ${response.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

const json = await response.json();
const item = json?.data?.[0];
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

if (item?.b64_json) {
  fs.writeFileSync(out, Buffer.from(item.b64_json, 'base64'));
  console.log(`IMAGE: ${out} (${size}, ${quality}, ${model}, ${base})`);
} else if (item?.url) {
  const img = await fetch(item.url);
  const buf = Buffer.from(await img.arrayBuffer());
  fs.writeFileSync(out, buf);
  console.log(`IMAGE: ${out} from url (${size}, ${model}, ${base})`);
} else {
  console.error('gen-image: no image in response', JSON.stringify(json).slice(0, 400));
  process.exit(1);
}
