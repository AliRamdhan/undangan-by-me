import type { ReactNode } from 'react'

const MARK = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[^`]+```)/g

/** Renders WhatsApp's *bold*, _italic_, ~strike~ and ```mono``` as the guest will see them. */
function formatLine(line: string): ReactNode[] {
  return line.split(MARK).map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```') && part.length > 6)
      return <code key={i} className="font-mono">{part.slice(3, -3)}</code>
    if (part.length > 2) {
      const inner = part.slice(1, -1)
      if (part[0] === '*' && part.at(-1) === '*') return <strong key={i}>{inner}</strong>
      if (part[0] === '_' && part.at(-1) === '_') return <em key={i}>{inner}</em>
      if (part[0] === '~' && part.at(-1) === '~') return <s key={i}>{inner}</s>
    }
    return part
  })
}

export function WhatsAppText({ text }: { text: string }) {
  return (
    <div className="text-[14px] leading-relaxed break-words">
      {text.split('\n').map((line, i) => (
        <div key={i} className="min-h-[1.4em]">
          {formatLine(line)}
        </div>
      ))}
    </div>
  )
}

/** A chat bubble so the operator sees the message the way the guest does. */
export function WhatsAppBubble({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-[#e7f7dc] p-4 dark:bg-[#0b3d2e]">
      <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        <WhatsAppText text={text} />
      </div>
    </div>
  )
}
