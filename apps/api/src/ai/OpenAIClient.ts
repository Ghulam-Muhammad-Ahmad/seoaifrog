import OpenAI from 'openai'
import Bottleneck from 'bottleneck'
import { appendOpenAiAuditLog } from '../lib/openAiAuditLog.js'
import { loadSkillMarkdown } from './SkillLoader.js'
import { extractScoreFromMarkdown } from './ScoreExtractor.js'

function normalizeOpenAIMessageContent(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === 'object' && p !== null && 'text' in p)
          return String((p as { text?: string }).text ?? '')
        return ''
      })
      .join('')
  }
  return ''
}

const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
})

export type SkillRunResult = {
  skillName: string
  rawResponse: string
  score: number | null
  tokensUsed: number
  durationMs: number
}

export class OpenAIClient {
  private openai: OpenAI

  constructor(apiKey: string) {
    const key = apiKey.trim()
    if (!key) throw new Error('OpenAI API key is required')
    this.openai = new OpenAI({ apiKey: key })
  }

  /**
   * Sends crawl/audit data as the user message string (JSON text).
   * Chat Completions `file` attachments for gpt-4o expect PDF, not JSON — do not use Files API for this payload.
   */
  async completeWithSkill(skillName: string, userContent: string): Promise<SkillRunResult> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
    const timeoutMs = Math.max(5_000, parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? '90000', 10) || 90_000)
    const systemPrompt = await loadSkillMarkdown(skillName)
    const t0 = Date.now()

    const completion = await limiter.schedule(() =>
      this.openai.chat.completions.create(
        {
          model,
          max_tokens: 8192,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        },
        { timeout: timeoutMs },
      ),
    )

    const content = completion.choices[0]?.message?.content
    const rawResponse =
      typeof content === 'string'
        ? content
        : normalizeOpenAIMessageContent(content as unknown)
    const score = extractScoreFromMarkdown(rawResponse)
    const usage = completion.usage
    const tokensUsed = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)
    const durationMs = Date.now() - t0

    await appendOpenAiAuditLog({
      skillName,
      model,
      systemPrompt,
      userPayload: userContent,
      rawResponse,
      score,
      tokensUsed,
      durationMs,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      payloadDelivery: 'inline',
    })

    return { skillName, rawResponse, score, tokensUsed, durationMs }
  }
}
