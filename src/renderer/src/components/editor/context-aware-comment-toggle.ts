/* eslint-disable max-lines -- Why: the comment-toggle behavior is shared across
Monaco edit and diff surfaces, so keeping the extension routing, JSX heuristics,
and text transforms together prevents those paths from drifting apart. */
import type { editor, IRange } from 'monaco-editor'

type SelectionLike = {
  startLineNumber: number
  endLineNumber: number
  endColumn: number
}

type TextModelLike = Pick<
  editor.ITextModel,
  'getLineContent' | 'getLineMaxColumn' | 'getLineCount' | 'getEOL'
>
type EditOperation = {
  range: IRange
  text: string
  forceMoveMarkers?: boolean
}
type StandaloneEditorLike = Pick<
  editor.IStandaloneCodeEditor,
  'getModel' | 'getSelections' | 'executeEdits' | 'trigger' | 'addCommand'
>

type MonacoLike = {
  KeyMod: {
    CtrlCmd: number
  }
  KeyCode: {
    Slash: number
  }
  Range: new (
    startLineNumber: number,
    startColumn: number,
    endLineNumber: number,
    endColumn: number
  ) => IRange
}

type CommentStyle =
  | {
      kind: 'line'
      prefix: string
    }
  | {
      kind: 'wrapped'
      open: string
      close: string
    }

type LineRange = {
  startLineNumber: number
  endLineNumber: number
}

function extname(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (lastDot <= lastSep) {
    return ''
  }
  return filePath.slice(lastDot).toLowerCase()
}

function leadingWhitespace(value: string): string {
  return value.match(/^\s*/)?.[0] ?? ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeLineRange(selection: SelectionLike): LineRange {
  let endLineNumber = selection.endLineNumber
  if (selection.endColumn === 1 && endLineNumber > selection.startLineNumber) {
    endLineNumber -= 1
  }

  return {
    startLineNumber: selection.startLineNumber,
    endLineNumber: Math.max(selection.startLineNumber, endLineNumber)
  }
}

function getLines(model: TextModelLike, range: LineRange): string[] {
  const result: string[] = []
  for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber += 1) {
    result.push(model.getLineContent(lineNumber))
  }
  return result
}

function findFirstNonEmptyLineIndex(lines: string[]): number {
  return lines.findIndex((line) => line.trim().length > 0)
}

function findLastNonEmptyLineIndex(lines: string[]): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index]?.trim().length) {
      return index
    }
  }
  return -1
}

function isWrappedSingleLine(trimmedLine: string, open: string, close: string): boolean {
  return trimmedLine.startsWith(open) && trimmedLine.endsWith(close)
}

function unwrapSingleLine(trimmedLine: string, open: string, close: string): string {
  return trimmedLine.slice(open.length, trimmedLine.length - close.length).trim()
}

function toggleLineComments(lines: string[], prefix: string, eol: string): string {
  const commentMatcher = new RegExp(`^(\\s*)${escapeRegExp(prefix)}(?:\\s)?`)
  const shouldUncomment = lines.every(
    (line) => line.trim().length === 0 || commentMatcher.test(line)
  )

  const nextLines = lines.map((line) => {
    if (line.trim().length === 0) {
      return line
    }

    if (shouldUncomment) {
      return line.replace(commentMatcher, '$1')
    }

    const indent = leadingWhitespace(line)
    return `${indent}${prefix} ${line.slice(indent.length)}`
  })

  return nextLines.join(eol)
}

function toggleWrappedComments(lines: string[], open: string, close: string, eol: string): string {
  const firstNonEmptyIndex = findFirstNonEmptyLineIndex(lines)
  const lastNonEmptyIndex = findLastNonEmptyLineIndex(lines)

  if (firstNonEmptyIndex === -1 || lastNonEmptyIndex === -1) {
    return lines.join(eol)
  }

  const firstTrimmed = lines[firstNonEmptyIndex]!.trim()
  const lastTrimmed = lines[lastNonEmptyIndex]!.trim()

  if (firstNonEmptyIndex === lastNonEmptyIndex && isWrappedSingleLine(firstTrimmed, open, close)) {
    const nextLines = [...lines]
    const indent = leadingWhitespace(lines[firstNonEmptyIndex]!)
    const inner = unwrapSingleLine(firstTrimmed, open, close)
    nextLines[firstNonEmptyIndex] = inner.length > 0 ? `${indent}${inner}` : indent
    return nextLines.join(eol)
  }

  if (firstTrimmed === open && lastTrimmed === close) {
    const nextLines = lines.filter(
      (_line, index) => index !== firstNonEmptyIndex && index !== lastNonEmptyIndex
    )
    return nextLines.join(eol)
  }

  if (firstNonEmptyIndex === lastNonEmptyIndex) {
    const nextLines = [...lines]
    const indent = leadingWhitespace(lines[firstNonEmptyIndex]!)
    const body = lines[firstNonEmptyIndex]!.slice(indent.length).trim()
    nextLines[firstNonEmptyIndex] =
      body.length > 0 ? `${indent}${open} ${body} ${close}` : `${indent}${open} ${close}`
    return nextLines.join(eol)
  }

  const indent = leadingWhitespace(lines[firstNonEmptyIndex]!)
  const nextLines = [...lines]
  nextLines.splice(firstNonEmptyIndex, 0, `${indent}${open}`)
  nextLines.splice(lastNonEmptyIndex + 2, 0, `${indent}${close}`)
  return nextLines.join(eol)
}

function looksLikeJsxAttributeLine(trimmedLine: string): boolean {
  return /^(?:[A-Za-z_:][\w:.-]*|{\.\.\.[^}]+})\s*(?:=|$)/.test(trimmedLine)
}

function findNearestNonEmptyLine(lines: string[], startIndex: number, step: -1 | 1): number {
  for (let index = startIndex + step; index >= 0 && index < lines.length; index += step) {
    if (lines[index]?.trim().length) {
      return index
    }
  }
  return -1
}

function isLikelyInsideJsxOpeningTag(lines: string[], lineIndex: number): boolean {
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const trimmed = lines[index]!.trim()
    if (!trimmed) {
      continue
    }
    if (trimmed.startsWith('</') || trimmed.includes('>') || trimmed.includes('/>')) {
      return false
    }
    if (trimmed.startsWith('<')) {
      return true
    }
  }
  return false
}

function containsLikelyJsxOpeningTag(trimmedLine: string): boolean {
  return (trimmedLine.includes('<') && !trimmedLine.includes('</')) || trimmedLine.includes('<>')
}

function containsLikelyJsxClosingTag(trimmedLine: string): boolean {
  return trimmedLine.includes('</') || trimmedLine.includes('</>')
}

function isLikelyInsideJsxChildren(lines: string[], lineIndex: number): boolean {
  const previousIndex = findNearestNonEmptyLine(lines, lineIndex, -1)
  const nextIndex = findNearestNonEmptyLine(lines, lineIndex, 1)
  if (previousIndex === -1 || nextIndex === -1) {
    return false
  }

  const previous = lines[previousIndex]!.trim()
  const next = lines[nextIndex]!.trim()
  return containsLikelyJsxOpeningTag(previous) && containsLikelyJsxClosingTag(next)
}

function resolveTsxCommentStyle(lines: string[], lineRange: LineRange): CommentStyle {
  const lineIndex = Math.max(0, lineRange.startLineNumber - 1)
  const trimmedLine = lines[lineIndex]?.trim() ?? ''

  if (trimmedLine.startsWith('{/*') || trimmedLine.endsWith('*/}')) {
    return { kind: 'wrapped', open: '{/*', close: '*/}' }
  }

  if (trimmedLine.startsWith('<') || trimmedLine.startsWith('</')) {
    return { kind: 'wrapped', open: '{/*', close: '*/}' }
  }

  if (looksLikeJsxAttributeLine(trimmedLine) && isLikelyInsideJsxOpeningTag(lines, lineIndex)) {
    return { kind: 'wrapped', open: '/*', close: '*/' }
  }

  if (isLikelyInsideJsxOpeningTag(lines, lineIndex)) {
    return { kind: 'wrapped', open: '/*', close: '*/' }
  }

  if (isLikelyInsideJsxChildren(lines, lineIndex)) {
    return { kind: 'wrapped', open: '{/*', close: '*/}' }
  }

  return { kind: 'line', prefix: '//' }
}

function resolveCommentStyle(
  filePath: string,
  allLines: string[],
  lineRange: LineRange
): CommentStyle | null {
  switch (extname(filePath)) {
    case '.ts':
    case '.js':
    case '.mjs':
    case '.cjs':
    case '.json':
    case '.jsonc':
      return { kind: 'line', prefix: '//' }
    case '.tsx':
    case '.jsx':
      return resolveTsxCommentStyle(allLines, lineRange)
    case '.css':
    case '.scss':
    case '.less':
      return { kind: 'wrapped', open: '/*', close: '*/' }
    case '.html':
    case '.htm':
    case '.xml':
    case '.svg':
      return { kind: 'wrapped', open: '<!--', close: '-->' }
    default:
      return null
  }
}

export function registerContextAwareCommentToggle(
  editorInstance: StandaloneEditorLike,
  monaco: MonacoLike,
  filePath: string
): void {
  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
    const model = editorInstance.getModel()
    const selections = editorInstance.getSelections()
    if (!model || !selections || selections.length === 0) {
      return
    }

    const allLines = getLines(model, {
      startLineNumber: 1,
      endLineNumber: model.getLineCount()
    })
    const eol = model.getEOL()
    const dedupedRanges = new Map<string, LineRange>()

    for (const selection of selections) {
      const range = normalizeLineRange(selection)
      dedupedRanges.set(`${range.startLineNumber}:${range.endLineNumber}`, range)
    }

    const edits: EditOperation[] = []

    for (const range of dedupedRanges.values()) {
      const style = resolveCommentStyle(filePath, allLines, range)
      if (!style) {
        editorInstance.trigger('orca.contextAwareComment', 'editor.action.commentLine', null)
        return
      }

      const selectedLines = getLines(model, range)
      const text =
        style.kind === 'line'
          ? toggleLineComments(selectedLines, style.prefix, eol)
          : toggleWrappedComments(selectedLines, style.open, style.close, eol)

      edits.push({
        range: new monaco.Range(
          range.startLineNumber,
          1,
          range.endLineNumber,
          model.getLineMaxColumn(range.endLineNumber)
        ),
        text,
        forceMoveMarkers: true
      })
    }

    // Why: Monaco's generic toggle-comment action only sees the base JS/TS
    // language config, so TSX/JSX lines inside JSX markup get `//` instead of
    // JSX-safe comments. Orca overrides Ctrl/Cmd+/ here so the active file's
    // extension and local JSX context decide whether to use `//`, `/* */`, or
    // `{/* */}` without breaking the built-in behavior for other languages.
    editorInstance.executeEdits('orca.contextAwareComment', edits)
  })
}

export const __test__ = {
  normalizeLineRange,
  resolveCommentStyle,
  toggleLineComments,
  toggleWrappedComments
}
