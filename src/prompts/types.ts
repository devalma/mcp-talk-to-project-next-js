/**
 * Prompt System Types
 */

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

export interface PromptMessage {
  role: 'user' | 'assistant' | 'system';
  content: {
    type: 'text';
    text: string;
  };
}

export interface PromptResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface PromptResponse {
  description: string;
  messages: PromptMessage[];
  resources?: PromptResource[];
}

export interface PromptGenerator {
  generate(args: Record<string, any>): Promise<PromptResponse>;
}

export interface PromptModule {
  definition: PromptDefinition;
  generator: PromptGenerator;
}
