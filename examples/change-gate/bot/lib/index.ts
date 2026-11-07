// Shared imports. Agent SDK does not discover bot/lib.
export function reviewLine(file: string, note: string): string {
  return `${file}: ${note}`;
}
