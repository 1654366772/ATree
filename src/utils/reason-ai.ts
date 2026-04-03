// eslint-disable-next-line import/no-unresolved, import/extensions
import { initDB } from './db';

/**
 * AI模型配置接口
 */
export interface AIModelConfig {
  id?: number;
  name: string;
  type: string;
  base_url?: string;
  api_key?: string;
  model_ids: string; // 注意：这里匹配 db.ts 中的定义
  specific_model_id?: string; // 手动指定的具体模型
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * AI响应接口
 */
export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

/**
 * 通用AI服务类
 */
export class AIService {
  private config: AIModelConfig;

  constructor(config: AIModelConfig) {
    this.config = config;
  }

  /**
   * 工厂方法：根据模型ID创建AIService实例
   */
  static async createFromId(
    modelId: number,
    specificModel?: string,
  ): Promise<AIService | null> {
    try {
      const db = await initDB();
      const model = await db.get('ai_model', modelId);
      if (!model) return null;
      return new AIService({
        ...model,
        specific_model_id: specificModel,
      });
    } catch (error) {
      console.error('加载AI模型配置失败:', error);
      return null;
    }
  }

  /**
   * 带超时和重试的 fetch 封装
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeoutMs: number = 300000,
    maxRetries: number = 2,
  ): Promise<Response> {
    let lastError: Error | null = null;
    for (let i = 0; i <= maxRetries; i++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // 如果是 429 或 5xx 错误，且未达到最大重试次数，则重试
        if (
          (response.status === 429 || (response.status >= 500 && response.status < 600)) &&
          i < maxRetries
        ) {
          const delay = Math.pow(2, i) * 1000;
          console.warn(`请求失败(${response.status})，正在进行第 ${i + 1} 次重试，延迟 ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;
        
        // 如果是超时或网络错误，重试
        if (i < maxRetries) {
          const delay = Math.pow(2, i) * 1000;
          console.warn(`请求异常(${error.message})，正在进行第 ${i + 1} 次重试...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }
    throw lastError || new Error('请求失败且达到最大重试次数');
  }

  /**
   * 通用聊天完成方法
   * 目前支持OpenAI兼容的API
   */
  async chat(
    messages: ChatMessage[],
    params: Record<string, any> = {},
    maxContinuations: number = 3,
  ): Promise<AIResponse> {
    if (!this.config.api_key) {
      throw new Error('此模型缺少API密钥。');
    }

    const baseUrl =
      this.config.base_url?.trim().replace(/\/+$/, '') || 'https://api.openai.com/v1';

    // 优先使用手动指定的具体模型，否则取 model_ids 中的第一个
    const activeModelId =
      this.config.specific_model_id ||
      this.config.model_ids?.split(/[，,]/)[0]?.trim();

    if (!activeModelId) {
      throw new Error('配置中未定义具体的模型ID。');
    }

    let fullContent = '';
    let currentMessages = [...messages];
    let totalUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    let continuations = 0;
    let lastFinishReason = '';

    try {
      while (continuations <= maxContinuations) {
        // 合并默认参数和用户自定义参数
        const body = {
          model: activeModelId,
          messages: currentMessages,
          stream: false,
          ...params,
        };

        const response = await this.fetchWithRetry(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.api_key}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `API请求失败: ${response.status} ${
              response.statusText
            } - ${JSON.stringify(errorData)}`,
          );
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
          throw new Error('无效的API响应：未返回任何选项。');
        }

        const choice = data.choices[0];
        const content = choice.message.content || '';
        fullContent += content;
        lastFinishReason = choice.finish_reason;

        // 累加使用量
        if (data.usage) {
          totalUsage.prompt_tokens += data.usage.prompt_tokens || 0;
          totalUsage.completion_tokens += data.usage.completion_tokens || 0;
          totalUsage.total_tokens += data.usage.total_tokens || 0;
        }

        // 如果不是因为长度截断，或者已经达到最大续写次数，则跳出循环
        if (lastFinishReason !== 'length' || continuations >= maxContinuations) {
          break;
        }

        // 准备续写：将之前的回复作为 assistant 消息加入上下文
        currentMessages.push({
          role: 'assistant',
          content: content,
        });

        // 有些模型可能需要明确提示 "继续" 或者保持上下文即可
        // 这里采用继续追加的方式，通常 OpenAI 兼容接口在截断时，
        // 下一次请求带上之前的回复，模型会自动从截断处继续（如果支持续写）
        // 或者我们可以尝试只发最后一条助理消息并提示继续，但最通用的做法是维护完整对话
        // 注意：如果模型不支持 native continuation，可能需要特殊提示词，
        // 但对于大多数指令遵循模型，保持上下文并再次请求是有效的。

        continuations++;
        console.log(`检测到输出截断，正在进行第 ${continuations} 次续写...`);
      }

      return {
        content: fullContent,
        usage: totalUsage,
        finish_reason: lastFinishReason,
      };
    } catch (error) {
      console.error('AI服务错误:', error);
      throw error;
    }
  }
}
