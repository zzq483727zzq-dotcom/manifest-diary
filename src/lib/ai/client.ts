import OpenAI from 'openai';

export function createDeepSeekClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL,
  });
}

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'DeepSeek-V4-Flash';
