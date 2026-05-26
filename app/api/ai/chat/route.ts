import { NextRequest } from 'next/server';
import { createApiResponse } from '@/lib/api-middleware';
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = chatSchema.safeParse(body);

    if (!validation.success) {
      return createApiResponse(null, {
        status: 400,
        message: validation.error.issues.map(i => i.message).join(', '),
      });
    }

    const { messages, model, temperature } = validation.data;

    const response = await aiService.chat(messages, { model, temperature });

    return createApiResponse(response, { status: 200, message: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI服务调用失败';
    return createApiResponse(null, { status: 500, message });
  }
}
