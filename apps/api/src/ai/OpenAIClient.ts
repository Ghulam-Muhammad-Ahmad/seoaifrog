import OpenAI from 'openai'
import Bottleneck from 'bottleneck'
import { appendOpenAiAuditLog } from '../lib/openAiAuditLog.js'
import { loadSkillMarkdown } from './SkillLoader.js'
import { extractScoreFromMarkdown } from './ScoreExtractor.js'
import {
  AUDIT_TOOL_DEFINITIONS,
  dispatchAuditTool,
  type AuditToolContext,
  type AuditToolCallLog,
} from './tools/auditTools.js'

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
  maxConcurrent: Math.max(1, parseInt(process.env.OPENAI_MAX_CONCURRENT ?? '1', 10) || 1),
  minTime: Math.max(0, parseInt(process.env.OPENAI_MIN_TIME_MS ?? '750', 10) || 750),
})

function parseRetryAfterMs(err: unknown): number | null {
  const anyErr = err as { status?: number; message?: string; headers?: Record<string, string> }
  if (!anyErr) return null
  const msg = String(anyErr.message ?? '')
  const m = msg.match(/try again in ([0-9.]+)s/i)
  if (m) return Math.ceil(parseFloat(m[1]) * 1000)
  const h = anyErr.headers?.['retry-after']
  if (h) {
    const s = parseFloat(h)
    if (Number.isFinite(s)) return Math.ceil(s * 1000)
  }
  return null
}

function isRateLimit(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  if (!e) return false
  if (e.status === 429) return true
  return /rate limit|429/i.test(String(e.message ?? ''))
}

async function withRateLimitRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 4,
): Promise<T> {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (e) {
      if (!isRateLimit(e) || attempt >= maxRetries) throw e
      attempt++
      const retryAfter = parseRetryAfterMs(e)
      const backoff = Math.min(30_000, Math.max(retryAfter ?? 0, 1500 * 2 ** (attempt - 1)))
      console.warn(
        `[audit-tools] ${label} hit 429 (attempt ${attempt}/${maxRetries}); sleeping ${backoff}ms`,
      )
      await new Promise((r) => setTimeout(r, backoff))
    }
  }
}

export type SkillRunResult = {
  skillName: string
  rawResponse: string
  score: number | null
  tokensUsed: number
  durationMs: number
  toolCallCount: number
  turnCount: number
}

type ResponsesOutputItem =
  | {
      type: 'message'
      role?: string
      content?: Array<{ type: string; text?: string }>
    }
  | {
      type: 'function_call'
      id?: string
      call_id: string
      name: string
      arguments: string
    }
  | { type: string; [k: string]: unknown }

type ResponsesResult = {
  output?: ResponsesOutputItem[]
  output_text?: string
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

function extractAssistantText(resp: ResponsesResult): string {
  if (typeof resp.output_text === 'string' && resp.output_text) return resp.output_text
  if (!Array.isArray(resp.output)) return ''
  const chunks: string[] = []
  for (const item of resp.output) {
    if (item && item.type === 'message' && Array.isArray((item as { content?: unknown[] }).content)) {
      for (const c of (item as { content: Array<{ type: string; text?: string }> }).content) {
        if (c && typeof c.text === 'string') chunks.push(c.text)
      }
    }
  }
  return chunks.join('')
}

export class OpenAIClient {
  private openai: OpenAI
  private apiKey: string

  constructor(apiKey: string) {
    const key = apiKey.trim()
    if (!key) throw new Error('OpenAI API key is required')
    this.apiKey = key
    this.openai = new OpenAI({ apiKey: key })
  }

  /**
   * Tool-calling audit runner. Uses the OpenAI Responses API with a function-call
   * loop so the model can pull crawl data on demand. `web_search_preview` is kept
   * alongside the custom audit tools unless OPENAI_AUDIT_WEB_SEARCH=false.
   *
   * Falls back to plain chat.completions if the Responses API rejects the request
   * (older account / model that doesn't support it).
   */
  async completeWithSkill(
    skillName: string,
    userContent: string,
    websiteUrl: string | null | undefined,
    toolCtx: AuditToolContext,
  ): Promise<SkillRunResult> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
    const timeoutMs = Math.max(5_000, parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? '180000', 10) || 180_000)
    const maxTurns = Math.max(1, parseInt(process.env.OPENAI_AUDIT_MAX_TURNS ?? '12', 10) || 12)
    const useWebSearch = (process.env.OPENAI_AUDIT_WEB_SEARCH ?? 'true').toLowerCase() !== 'false'
    const useTools = (process.env.OPENAI_AUDIT_TOOLS ?? 'true').toLowerCase() !== 'false'

    const skillMd = await loadSkillMarkdown(skillName)
    const toolPreamble = useTools
      ? `\n\n---\n\n## AUDIT MODE OVERRIDE — tool-calling\n\n**Important:** ignore any "Input data" section above that describes fields like \`pages[]\`, \`schemaJson\`, \`speedTests[]\` as pre-populated arrays. In this audit the user payload is minimal (project meta + crawl summary only). You must fetch everything else via tools.\n\nAvailable tools:\n- **search_pages(query, limit)** — semantic search over crawled page text (returns URL + text chunks).\n- **get_page(url)** — full crawl row for one URL: title, meta, headings, schema JSON-LD, links, images, CWV.\n- **list_pages(filter, limit)** — filter ∈ {all, missing_title, missing_meta_description, thin_content, broken, redirects, non_indexable, no_schema, slow_lcp}.\n- **get_crawl_stats()** — totals, status histogram, schema coverage, thin/missing counts.\n- **get_speed_tests(url?, limit)** — PageSpeed Insights (lab) results stored for this project.\n- **list_page_issues(category?, severity?, limit)** — structured issues the crawler already captured.\n- **fetch_live_page(url)** — live HTTP fetch, project domain only. Use for robots.txt, sitemap.xml, llms.txt, homepage checks.\n${useWebSearch ? '- **web_search_preview** — live web search for external context (SERPs, Google docs, schema.org spec, PageSpeed reports).\n' : ''}\n### Rules of engagement\n1. Call tools FIRST. Do not narrate "I will fetch X" — just fetch it. Each turn you emit only tool calls OR a final answer.\n2. You MUST make at least 2 tool calls before producing the final report (a one-shot answer with zero tool calls will be rejected as speculative).\n3. Cite specific URLs, counts, and numeric values from tool results in your findings.\n4. Produce the scored markdown report only after evidence is gathered. Start it with \`Score: N/100\` on its own line.`
      : ''
    const systemPrompt = skillMd + toolPreamble
    const payloadWithUrl = websiteUrl
      ? `Website URL for this audit: ${websiteUrl}\nUse this URL as the primary source of truth for any live checks.\n\n${userContent}`
      : userContent

    const t0 = Date.now()
    let rawResponse = ''
    let tokensUsed = 0
    let promptTokens: number | undefined
    let completionTokens: number | undefined
    let toolCallCount = 0
    let turnCount = 0
    const toolLogs: AuditToolCallLog[] = []
    let deliveryMode: 'responses_tools' | 'responses_web_only' | 'chat_fallback' = useTools
      ? 'responses_tools'
      : useWebSearch
        ? 'responses_web_only'
        : 'chat_fallback'

    let loopError: string | null = null

    if (useTools || useWebSearch) {
      const tools: unknown[] = []
      if (useTools) tools.push(...AUDIT_TOOL_DEFINITIONS)
      if (useWebSearch) tools.push({ type: 'web_search_preview' })

      const input: unknown[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: payloadWithUrl },
      ]

      const runTurn = async (
        label: string,
        withTools: boolean,
      ): Promise<ResponsesResult> => {
        return (await withRateLimitRetry(label, () =>
          limiter.schedule(() =>
            this.openai.responses.create(
              {
                model,
                max_output_tokens: 8192,
                ...(withTools ? { tools } : {}),
                input,
              } as never,
              { timeout: timeoutMs },
            ),
          ),
        )) as unknown as ResponsesResult
      }

      try {
        for (turnCount = 1; turnCount <= maxTurns; turnCount++) {
          const tTurn = Date.now()
          console.info(
            `[audit-tools] skill=${skillName} turn=${turnCount}/${maxTurns} tools=${useTools} web=${useWebSearch} inputItems=${input.length}`,
          )
          const response = await runTurn(`${skillName} turn ${turnCount}`, true)

          if (response.usage) {
            promptTokens = (promptTokens ?? 0) + (response.usage.input_tokens ?? 0)
            completionTokens = (completionTokens ?? 0) + (response.usage.output_tokens ?? 0)
            tokensUsed += response.usage.total_tokens ?? 0
          }

          const outputItems = Array.isArray(response.output) ? response.output : []
          const fnCalls = outputItems.filter(
            (o): o is Extract<ResponsesOutputItem, { type: 'function_call' }> =>
              !!o && (o as { type?: string }).type === 'function_call',
          )

          // Only echo back function_call items (reconstructed, no `id`/`status` fields).
          // Echoing `message` / `reasoning` / `web_search_call` items causes the
          // Responses API to reject subsequent turns with 400 unknown_parameter.
          for (const call of fnCalls) {
            input.push({
              type: 'function_call',
              call_id: call.call_id,
              name: call.name,
              arguments: call.arguments,
            })
          }

          if (fnCalls.length === 0) {
            rawResponse = extractAssistantText(response)
            console.info(
              `[audit-tools] skill=${skillName} turn=${turnCount} done (no tool calls) in ${Date.now() - tTurn}ms`,
            )
            break
          }

          console.info(
            `[audit-tools] skill=${skillName} turn=${turnCount} tool_calls=${fnCalls
              .map((f) => f.name)
              .join(',')}`,
          )

          for (const call of fnCalls) {
            toolCallCount++
            const { output, log } = await dispatchAuditTool(toolCtx, call.name, call.arguments ?? '{}')
            toolLogs.push(log)
            console.info(
              `[audit-tools] skill=${skillName} call=${log.name} ok=${log.ok} ms=${log.durationMs} args=${log.argsJson.slice(0, 160)}`,
            )
            input.push({
              type: 'function_call_output',
              call_id: call.call_id,
              output,
            })
          }

          if (turnCount === maxTurns) {
            console.warn(
              `[audit-tools] skill=${skillName} hit max turns (${maxTurns}); forcing final answer`,
            )
            input.push({
              role: 'user',
              content:
                'Tool-call budget exhausted. Produce your final scored markdown report now using evidence gathered so far. Do not call any more tools. Start with "Score: N/100" on its own line.',
            })
            const final = await runTurn(`${skillName} final`, false)
            rawResponse = extractAssistantText(final)
            if (final.usage) {
              promptTokens = (promptTokens ?? 0) + (final.usage.input_tokens ?? 0)
              completionTokens = (completionTokens ?? 0) + (final.usage.output_tokens ?? 0)
              tokensUsed += final.usage.total_tokens ?? 0
            }
            break
          }
        }
      } catch (e) {
        loopError = e instanceof Error ? e.message : String(e)
        console.warn(
          `[audit-tools] skill=${skillName} loop error at turn=${turnCount} toolCalls=${toolCallCount}: ${loopError}`,
        )

        // Graceful finalization: if we gathered ANY tool evidence, force a final
        // answer using the same input (no tools) instead of restarting fresh
        // in chat.completions (which would lose all gathered context).
        if (toolCallCount > 0) {
          try {
            input.push({
              role: 'user',
              content:
                'The tool-use session hit an error. Finalize your audit report NOW using whatever evidence has been gathered so far from prior tool calls. Do not request more tools. Start with "Score: N/100" on its own line, then produce the markdown report.',
            })
            const final = await runTurn(`${skillName} graceful-final`, false)
            rawResponse = extractAssistantText(final)
            if (final.usage) {
              promptTokens = (promptTokens ?? 0) + (final.usage.input_tokens ?? 0)
              completionTokens = (completionTokens ?? 0) + (final.usage.output_tokens ?? 0)
              tokensUsed += final.usage.total_tokens ?? 0
            }
            deliveryMode = 'responses_tools'
            console.info(
              `[audit-tools] skill=${skillName} graceful finalize succeeded (tokens=${tokensUsed})`,
            )
          } catch (e2) {
            const msg2 = e2 instanceof Error ? e2.message : String(e2)
            console.warn(
              `[audit-tools] skill=${skillName} graceful finalize also failed: ${msg2}`,
            )
            loopError = `${loopError} | finalize: ${msg2}`
            rawResponse = ''
            deliveryMode = 'chat_fallback'
          }
        } else {
          rawResponse = ''
          deliveryMode = 'chat_fallback'
        }
      }
    }

    if (!rawResponse) {
      // Inject gathered tool evidence (if any) so the fallback isn't blind.
      const gathered = toolLogs.length
        ? '\n\n---\n\n## Tool evidence gathered before fallback\n\n' +
          toolLogs
            .map(
              (t) =>
                `### ${t.name} ${t.ok ? '(ok)' : '(failed)'}\nargs: ${t.argsJson}\nresult: ${t.resultPreview}`,
            )
            .join('\n\n')
        : ''
      const fallbackUser = payloadWithUrl + gathered + (
        gathered
          ? '\n\n(No more tools available. Produce the final scored markdown report using evidence above. Start with "Score: N/100".)'
          : ''
      )
      const completion = await withRateLimitRetry(`${skillName} chat-fallback`, () =>
        limiter.schedule(() =>
          this.openai.chat.completions.create(
            {
              model,
              max_tokens: 8192,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: fallbackUser },
              ],
            },
            { timeout: timeoutMs },
          ),
        ),
      )
      const content = completion.choices[0]?.message?.content
      rawResponse =
        typeof content === 'string' ? content : normalizeOpenAIMessageContent(content as unknown)
      promptTokens = completion.usage?.prompt_tokens
      completionTokens = completion.usage?.completion_tokens
      tokensUsed = (promptTokens ?? 0) + (completionTokens ?? 0)
    }

    const score = extractScoreFromMarkdown(rawResponse)
    const durationMs = Date.now() - t0
    console.info(
      `[audit-tools] skill=${skillName} completed mode=${deliveryMode} turns=${turnCount} tool_calls=${toolCallCount} tokens=${tokensUsed} score=${score ?? 'n/a'} in ${durationMs}ms`,
    )

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
      toolCallCount,
      turnCount,
      toolCalls: toolLogs,
      deliveryMode,
      loopError: loopError ?? undefined,
    })

    return { skillName, rawResponse, score, tokensUsed, durationMs, toolCallCount, turnCount }
  }
}
