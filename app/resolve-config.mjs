import { readConfig } from './configuration.mjs';
try {
  const config = await readConfig();
  if (!config) throw new Error('Add an Anthropic Connector in the Sprites dashboard and grant this Sprite access.');
  process.stdout.write(JSON.stringify(config));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
