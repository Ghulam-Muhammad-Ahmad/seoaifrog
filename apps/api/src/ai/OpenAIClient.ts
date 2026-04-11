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
  async completeWithSkill(
    skillName: string,
    userContent: string,
    websiteUrl?: string | null,
  ): Promise<SkillRunResult> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
    const timeoutMs = Math.max(5_000, parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? '90000', 10) || 90_000)
    const systemPrompt = await loadSkillMarkdown(skillName)
    const payloadWithUrl = websiteUrl
      ? `Website URL for this audit: ${websiteUrl}\nUse this URL as the primary source of truth for any live checks.\n\n${userContent}`
      : userContent
    const t0 = Date.now()
    const shouldTryWebSearch = (process.env.OPENAI_AUDIT_WEB_SEARCH ?? 'true').toLowerCase() !== 'false'

    let rawResponse = ''
    let tokensUsed = 0
    let promptTokens: number | undefined
    let completionTokens: number | undefined

    if (shouldTryWebSearch) {
      try {
        const response = await limiter.schedule(() =>
          this.openai.responses.create(
            {
              model,
              max_output_tokens: 8192,
              tools: [{ type: 'web_search_preview' }],
              input: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: payloadWithUrl },
              ],
            } as never,
            { timeout: timeoutMs },
          ),
        )
        const r = response as unknown as {
          output_text?: string
          usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
        }
        rawResponse = r.output_text ?? ''
        promptTokens = r.usage?.input_tokens
        completionTokens = r.usage?.output_tokens
        tokensUsed =
          r.usage?.total_tokens ??
          (typeof promptTokens === 'number' && typeof completionTokens === 'number'
            ? promptTokens + completionTokens
            : 0)
      } catch {
        // Fall back to standard chat completion if web-search tool isn't available for the model/account.
      }
    }

    if (!rawResponse) {
      const completion = await limiter.schedule(() =>
        this.openai.chat.completions.create(
          {
            model,
            max_tokens: 8192,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: payloadWithUrl },
            ],
          },
          { timeout: timeoutMs },
        ),
      )
      const content = completion.choices[0]?.message?.content
      rawResponse =
        typeof content === 'string'
          ? content
          : normalizeOpenAIMessageContent(content as unknown)
      promptTokens = completion.usage?.prompt_tokens
      completionTokens = completion.usage?.completion_tokens
      tokensUsed = (promptTokens ?? 0) + (completionTokens ?? 0)
    }

    const score = extractScoreFromMarkdown(rawResponse)
    const durationMs = Date.now() - t0

    await appendOpenAiAuditLog({
      skillName,
      model,
      systemPrompt,
      userPayload: payloadWithUrl,
      rawResponse,
      score,
      tokensUsed,
      durationMs,
      promptTokens,
      completionTokens,
      payloadDelivery: 'inline',
    })

    return { skillName, rawResponse, score, tokensUsed, durationMs }
  }
}
