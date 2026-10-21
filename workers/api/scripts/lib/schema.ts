import { readFileSync } from 'node:fs';
import type { UserSchema } from '../gen-schema.ts';

export const userSchema: UserSchema = JSON.parse(readFileSync(new URL('../../schema/user-tables.json', import.meta.url), 'utf8'));
