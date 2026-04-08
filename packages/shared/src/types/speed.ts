export type PageSpeedStrategy = 'mobile' | 'desktop'

export interface RunSpeedTestRequestDTO {
  url: string
  strategy: PageSpeedStrategy
}

export interface SpeedTestDTO {
  id: string
  projectId: string
  createdByUserId: string
  url: string
  strategy: PageSpeedStrategy
  fetchedAt: string
  performanceScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  seoScore: number | null
  pwaScore: number | null
  firstContentfulPaintMs: number | null
  largestContentfulPaintMs: number | null
  cumulativeLayoutShift: number | null
  interactionToNextPaintMs: number | null
  totalBlockingTimeMs: number | null
  speedIndexMs: number | null
  rawJson: unknown
  createdAt: string
}

export interface SpeedTestListDTO {
  items: SpeedTestDTO[]
}
