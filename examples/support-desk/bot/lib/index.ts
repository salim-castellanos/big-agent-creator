// Shared imports. Agent SDK does not discover bot/lib.
export function cite(document: string, passage: string): string {
  return `${passage}\n\nSource: ${document}`;
}
