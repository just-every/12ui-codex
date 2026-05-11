import {
  ensembleRequest,
  ensembleResult,
  type AgentDefinition,
  type ResponseInput,
} from '@just-every/ensemble';
import { serverConfig } from './config.js';

const uniqueTextModels = (): string[] => (
  [serverConfig.textModel, serverConfig.textFallbackModel]
    .map((model) => model.trim())
    .filter((model, index, models): model is string => model.length > 0 && models.indexOf(model) === index)
);

export const textModelLabel = (): string => uniqueTextModels().join(' -> ');

export const requestTextModelWithFallback = async <T>(args: {
  agent: AgentDefinition;
  label: string;
  messages: ResponseInput;
  parse: (message: string) => T;
}): Promise<T> => {
  const errors: string[] = [];
  for (const model of uniqueTextModels()) {
    try {
      const result = await ensembleResult(ensembleRequest(args.messages, {
        ...args.agent,
        model,
      }));
      if (result.error) throw new Error(result.error);
      return args.parse(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
    }
  }

  throw new Error(`${args.label} failed on every configured text model.\n${errors.join('\n')}`);
};
