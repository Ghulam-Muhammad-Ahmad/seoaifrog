import ReactMarkdown from 'react-markdown'

export function ReportMarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div
      className="report-markdown max-h-[min(70vh,640px)] overflow-y-auto rounded-lg border border-line bg-surface-muted/30 p-5 text-ink-primary [&_a]:break-all [&_a]:text-brand-primary [&_a:hover]:underline [&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:font-display [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-line [&_h2]:pb-1 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-line [&_pre]:bg-surface-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_strong]:text-ink-primary [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
      data-testid="report-markdown-preview"
    >
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  )
}
