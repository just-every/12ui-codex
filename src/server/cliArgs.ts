export type CliArgs = {
  command: string;
  flags: Record<string, string | boolean>;
};

export const parseCliArgs = (argv: string[]): CliArgs => {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]!;
    if (!arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    const key = arg.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { command, flags };
};

export const stringFlag = (
  flags: Record<string, string | boolean>,
  ...names: string[]
): string | undefined => {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};
