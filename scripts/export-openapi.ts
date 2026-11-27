import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildOpenApiDocument } from '../src/docs/openapi';

const target = path.resolve(__dirname, '../docs/openapi.json');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`OpenAPI document written to ${path.relative(process.cwd(), target)}`);
