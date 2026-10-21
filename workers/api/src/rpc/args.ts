/**
 * A function's arguments checked and converted as Postgres converts them
 * when PostgREST passes the JSON body in: a bad uuid, enum value, integer or
 * date is refused with Postgres's own error before the function runs.
 * Values arrive as JSON and leave as what the ports work with: uuids
 * lowercase, booleans as booleans, timestamps in the stored form, jsonb as
 * the parsed value.
 */
import schema from '../../schema/user-tables.json' with { type: 'json' };
import { PgError, timestampInput } from '../pg.ts';

const enums = (schema as { enums: Record<string, string[]> }).enums;
const UUID = /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i;

const display = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));
const syntax = (type: string, value: unknown) => new PgError('22P02', `invalid input syntax for type ${type}: "${display(value)}"`);

export function convert(type: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (type.endsWith('[]')) {
    if (!Array.isArray(value)) throw new PgError('22P02', `malformed array literal: "${display(value)}"`, 400, 'Array value must start with "{" or dimension information.');
    return value.map((item) => convert(type.slice(0, -2), item));
  }
  switch (type) {
    case 'uuid': {
      const match = typeof value === 'string' ? value.match(UUID) : null;
      if (!match) throw syntax('uuid', value);
      return match.slice(1).join('-').toLowerCase();
    }
    case 'text': return typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const text = String(value).trim().toLowerCase();
      if (['t', 'true', 'y', 'yes', 'on', '1'].includes(text)) return true;
      if (['f', 'false', 'n', 'no', 'off', '0'].includes(text)) return false;
      throw syntax('boolean', value);
    }
    case 'integer': case 'bigint': case 'smallint': {
      const number = typeof value === 'number' ? value : typeof value === 'string' && /^\s*[+-]?\d+\s*$/.test(value) ? Number(value) : Number.NaN;
      if (!Number.isInteger(number)) throw syntax(type, value);
      return number;
    }
    case 'real': case 'double precision': case 'numeric': {
      const number = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(number)) throw syntax(type, value);
      return number;
    }
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new PgError('22007', `invalid input syntax for type date: "${display(value)}"`);
      return value;
    case 'timestamp with time zone': return timestampInput(value, 'argument');
    case 'jsonb': case 'json': return value;
    default: {
      const [schemaName, typeName] = type.split('.');
      const values = typeName ? enums[typeName] : undefined;
      if (values) {
        if (typeof value !== 'string' || !values.includes(value)) throw new PgError('22P02', `invalid input value for enum ${schemaName}.${typeName}: "${display(value)}"`);
        return value;
      }
      return value;
    }
  }
}
