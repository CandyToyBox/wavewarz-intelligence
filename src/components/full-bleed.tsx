// Breaks an embed out of the page's max-w column so it spans the whole
// viewport width. The matching `overflow-x: clip` lives on <body> in
// layout.tsx so the scrollbar gutter never causes a horizontal scrollbar.
export function FullBleed({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative left-1/2 -ml-[50vw] w-screen overflow-hidden border-y border-border bg-black ${className}`}>
      {children}
    </div>
  )
}
