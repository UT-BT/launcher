import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

export function MarkdownBody({ children, className }: { children: string; className?: string }) {
    return (
        <div className={cn('text-muted-foreground', className)}>
            <ReactMarkdown
                components={{
                    strong: ({ node: _node, ...props }) => <span className="font-bold text-foreground" {...props} />,
                    p: ({ node: _node, ...props }) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
                    ul: ({ node: _node, ...props }) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                    ol: ({ node: _node, ...props }) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                    li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
                    h1: ({ node: _node, ...props }) => <h3 className="text-lg font-semibold text-foreground mb-2 mt-4" {...props} />,
                    h2: ({ node: _node, ...props }) => <h4 className="text-base font-semibold text-foreground mb-2 mt-4" {...props} />,
                    h3: ({ node: _node, ...props }) => <h5 className="text-sm font-semibold text-foreground mb-2 mt-3" {...props} />,
                    a: ({ node: _node, ...props }) => <a className="text-accent-300 underline-offset-4 hover:underline" target="_blank" rel="noreferrer" {...props} />,
                    code: ({ node: _node, ...props }) => <code className="px-1 py-0.5 rounded bg-muted text-foreground text-xs" {...props} />,
                    blockquote: ({ node: _node, ...props }) => <blockquote className="border-l-2 border-hairline/20 pl-3 italic my-3" {...props} />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    )
}
