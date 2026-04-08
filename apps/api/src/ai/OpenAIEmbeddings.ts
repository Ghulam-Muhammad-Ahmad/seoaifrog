import OpenAI from 'openai'

export class OpenAIEmbeddings {
  constructor(private readonly openai: OpenAI) {}

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'
    const res = await this.openai.embeddings.create({ model, input: texts })
    const sorted = [...res.data].sort((a, b) => a.index - b.index)
    return sorted.map((d) => d.embedding)
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.embedBatch([text])
    return v
  }
}
