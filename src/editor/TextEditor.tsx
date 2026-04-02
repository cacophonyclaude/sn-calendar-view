import {
  useState,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useEffect,
} from 'react'
import styles from './TextEditor.module.css'

export interface TextEditorHandle {
  scrollToLine: (lineIndex: number) => void
  setText: (text: string) => void
}

interface Props {
  onInput: (value: string) => void
  placeholder?: string
  verifyMode?: boolean
  verifyLineIndices?: number[]
}

interface HighlightState {
  top: number
  height: number
}

/** Returns the pixel top of logical line `lineIndex` within the textarea content,
 *  accounting for lines that wrap to multiple visual lines. */
function measureLineTop(
  ta: HTMLTextAreaElement,
  lineIndex: number,
  lineHeight: number,
  paddingTop: number,
): number {
  const style = window.getComputedStyle(ta)
  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingRight = parseFloat(style.paddingRight) || 0
  const availableWidth = ta.clientWidth - paddingLeft - paddingRight

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return paddingTop + lineIndex * lineHeight

  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

  const lines = ta.value.split('\n')
  let visualLines = 0
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    const w = ctx.measureText(lines[i]).width
    visualLines += Math.max(1, Math.ceil(w / availableWidth))
  }
  return paddingTop + visualLines * lineHeight
}

const TextEditor = forwardRef<TextEditorHandle, Props>(function TextEditor(
  { onInput, placeholder, verifyMode, verifyLineIndices },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [highlight, setHighlight] = useState<HighlightState | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [accentTops, setAccentTops] = useState<number[]>([])
  const accentContainerRef = useRef<HTMLDivElement>(null)
  const lineHeightRef = useRef(0)

  const scrollToLine = useCallback((lineIndex: number) => {
    const ta = textareaRef.current
    if (!ta) return

    const style = window.getComputedStyle(ta)
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6
    const paddingTop = parseFloat(style.paddingTop) || 16

    const targetScrollTop = Math.max(0, paddingTop + lineIndex * lineHeight - ta.clientHeight / 2)
    ta.scrollTop = targetScrollTop

    const lines = ta.value.split('\n')
    let charOffset = 0
    for (let i = 0; i < lineIndex && i < lines.length; i++) {
      charOffset += lines[i].length + 1
    }
    ta.focus()
    ta.selectionStart = charOffset
    ta.selectionEnd = charOffset

    // Delay highlight until after the mobile keyboard has finished animating (~300ms).
    // Read ta.scrollTop at that point rather than using targetScrollTop, because the
    // browser may have adjusted scroll to keep the cursor visible as the keyboard appeared.
    // Use canvas measurement to account for wrapped lines before the target line.
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => {
      const currentTa = textareaRef.current
      if (!currentTa) return
      const lineTop = measureLineTop(currentTa, lineIndex, lineHeight, paddingTop)
      const visibleTop = lineTop - currentTa.scrollTop
      setHighlight({ top: visibleTop, height: lineHeight })
      highlightTimer.current = setTimeout(() => setHighlight(null), 900)
    }, 350)
  }, [])

  const setText = useCallback((text: string) => {
    const ta = textareaRef.current
    if (ta) ta.value = text
  }, [])

  useImperativeHandle(ref, () => ({ scrollToLine, setText }), [scrollToLine, setText])

  const computeAccents = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !verifyLineIndices?.length) { setAccentTops([]); return }

    const style = window.getComputedStyle(ta)
    const lh = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6
    lineHeightRef.current = lh
    const paddingTop = parseFloat(style.paddingTop) || 16
    const paddingLeft = parseFloat(style.paddingLeft) || 0
    const paddingRight = parseFloat(style.paddingRight) || 0
    const availableWidth = ta.clientWidth - paddingLeft - paddingRight

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) { setAccentTops([]); return }
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`

    const lines = ta.value.split('\n')
    const indexSet = new Set(verifyLineIndices)
    const tops: number[] = []
    let visualLines = 0

    for (let i = 0; i < lines.length; i++) {
      if (indexSet.has(i)) tops.push(paddingTop + visualLines * lh)
      const w = ctx.measureText(lines[i]).width
      visualLines += Math.max(1, Math.ceil(w / availableWidth))
    }

    // Sync container offset with current scroll position immediately after recompute
    if (accentContainerRef.current && ta) {
      accentContainerRef.current.style.transform = `translateY(${-ta.scrollTop}px)`
    }

    setAccentTops(tops)
  }, [verifyLineIndices])

  useEffect(() => {
    if (verifyMode) computeAccents()
    else setAccentTops([])
  }, [verifyMode, computeAccents])

  // Directly mutate the container's transform on scroll — no React state involved,
  // so the accent strips track the textarea scroll with zero render-cycle lag.
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current
    const container = accentContainerRef.current
    if (ta && container) {
      container.style.transform = `translateY(${-ta.scrollTop}px)`
    }
  }, [])

  const handleInput = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    onInput(ta.value)
    if (verifyMode) computeAccents()
  }, [onInput, verifyMode, computeAccents])

  const lh = lineHeightRef.current || 24

  return (
    <div className={styles.wrapper}>
      <textarea
        ref={textareaRef}
        className={styles.editor}
        onInput={handleInput}
        onScroll={handleScroll}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={placeholder}
      />
      {verifyMode && (
        <div ref={accentContainerRef} className={styles.accentContainer}>
          {accentTops.map((top, i) => (
            <div
              key={i}
              className={styles.lineAccent}
              style={{ top, height: lh }}
            />
          ))}
        </div>
      )}
      {highlight && (
        <div
          className={styles.lineHighlight}
          style={{ top: highlight.top, height: highlight.height }}
        />
      )}
    </div>
  )
})

export default TextEditor
