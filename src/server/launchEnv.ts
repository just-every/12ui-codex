export const launchServerEnv = (
  entry: string,
  baseEnv: NodeJS.ProcessEnv,
  host: string,
  port: number,
): NodeJS.ProcessEnv => ({
  ...baseEnv,
  CODEX_12UI_HOST: host,
  CODEX_12UI_PORT: String(port),
  ...(entry.endsWith('.js') ? { NODE_ENV: 'production' } : {}),
});
