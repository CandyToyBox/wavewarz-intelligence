// Shared building blocks for the API docs pages (/api-docs and /api-docs/games).

export function Code({ children }: { children: string }) {
  return (
    <pre className="rounded-lg border border-border bg-[#0c121c] p-4 overflow-x-auto text-xs leading-relaxed">
      <code className="text-[#95fe7c] font-mono whitespace-pre">{children}</code>
    </pre>
  )
}

export function Param({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-4 font-mono text-xs text-[#7ec1fb] whitespace-nowrap">{name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground whitespace-nowrap">{type}</td>
      <td className="py-2 text-xs text-gray-300">{desc}</td>
    </tr>
  )
}

export function Endpoint({
  id, method, path, summary, params, example, response,
}: {
  id: string
  method: string
  path: string
  summary: string
  params?: { name: string; type: string; desc: string }[]
  example: string
  response: string
}) {
  return (
    <section id={id} className="space-y-4 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-3">
        <span className="px-2 py-0.5 rounded bg-actiongreen/20 text-actiongreen text-[10px] font-bold tracking-widest border border-actiongreen/40">
          {method}
        </span>
        <code className="font-mono text-sm text-white">{path}</code>
      </div>
      <p className="text-sm text-gray-300">{summary}</p>

      {params && params.length > 0 && (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 text-[10px] uppercase tracking-widest text-muted-foreground">Param</th>
              <th className="py-2 pr-4 text-[10px] uppercase tracking-widest text-muted-foreground">Type</th>
              <th className="py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => <Param key={p.name} {...p} />)}
          </tbody>
        </table>
      )}

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Example request</p>
        <Code>{example}</Code>
      </div>
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Example response (trimmed)</p>
        <Code>{response}</Code>
      </div>
    </section>
  )
}
