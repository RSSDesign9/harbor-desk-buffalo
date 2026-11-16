import type { Provenance } from './types.ts';
import { PROVENANCE_VALUES } from './types.ts';

/** Plain-language definitions shown in tooltips and About / Sources (PRD §8). */
export const PROVENANCE_DEFINITIONS: Readonly<Record<Provenance, { label: string; definition: string }>> = {
  DOC: { label: 'Documented source', definition: 'Linked and dated evidence. Not a guarantee of current accuracy.' },
  ASSUME: { label: 'Design assumption', definition: 'Generated slips, numbering, model dimensions or inferred site placement.' },
  SIM: { label: 'Simulated', definition: 'Fictional vessels, records, staff actions, evidence and observations, including “verified” demo decisions.' },
  FIELD: { label: 'Field validation needed', definition: 'An operational capability or current service location nobody has confirmed.' },
};

export function isProvenance(value: unknown): value is Provenance {
  return typeof value === 'string' && (PROVENANCE_VALUES as readonly string[]).includes(value);
}
