import { NextRequest } from 'next/server';
import { createApiResponse, withApiHandler } from '@/lib/api-middleware';
import { aiService } from '@/lib/ai-service';
import { z } from 'zod';

export const runtime = 'nodejs';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(4000),
  })).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const chatHandler = async (_req: NextRequest, data: z.infer<typeof chatSchema>) => {
  try {
    const response = await aiService.chat(data.messages, {
      model: data.model,
      temperature: data.temperature,
    });
    return createApiResponse(response, { status: 200, message: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI服务调用失败';
    return createApiResponse(null, { status: 500, message });
  }
};

export const POST = withApiHandler(chatHandler, {
  schema: chatSchema,
  method: 'POST',
  requireAuth: true,
  validateCsrf: true,
});
