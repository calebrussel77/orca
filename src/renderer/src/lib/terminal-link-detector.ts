/**
 * Detects URLs in terminal output by tracking PTY data and maintaining
 * a simplified screen buffer. Supports Ctrl+Click to open links.
 */

// Matches http(s) URLs and bare domain-style URLs (e.g. github.com/foo)
const URL_RE =
  /https?:\/\/[^\s<>"'`)\]},;]+|(?:[\w-]+\.)+(?:com|org|net|io|dev|app|co|me|sh|cc|info|xyz|ai)(?:\/[^\s<>"'`)\]},;]*)*/g

// Strips most common ANSI escape sequences (SGR, cursor, erase, OSC, etc.)
const ANSI_RE =
  // eslint-disable-next-line no-control-regex
  /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][AB012]|\x1b[>=<]|\x1b\x1b|\x1b./g

export type TerminalLink = { url: string; col: number; len: number }

export class TerminalLinkDetector {
  private lines: string[] = []
  private cols = 80
  private rows = 24
  private cursorRow = 0

  /** Update grid dimensions (call on terminal resize). */
  setGridSize(cols: number, rows: number): void {
    this.cols = cols
    this.rows = rows
    // Resize line buffer to match visible rows
    while (this.lines.length < rows) this.lines.push('')
    if (this.lines.length > rows) this.lines.length = rows
    if (this.cursorRow >= rows) this.cursorRow = rows - 1
  }

  /** Feed a chunk of raw PTY output. */
  feed(data: string): void {
    // Strip ANSI escape sequences to get visible text
    const clean = data.replace(ANSI_RE, '')

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i]

      if (ch === '\n') {
        this.cursorRow++
        if (this.cursorRow >= this.rows) {
          // Scroll: shift lines up
          this.lines.shift()
          this.lines.push('')
          this.cursorRow = this.rows - 1
        }
        continue
      }

      if (ch === '\r') {
        // Carriage return: overwrite current line from start
        this.lines[this.cursorRow] = ''
        continue
      }

      // eslint-disable-next-line no-control-regex
      if (ch.charCodeAt(0) < 0x20) continue // skip other control chars

      // Append character to current line
      this.lines[this.cursorRow] = (this.lines[this.cursorRow] ?? '') + ch
    }
  }

  /** Clear the screen buffer (e.g. on Ctrl+L / clear). */
  clear(): void {
    this.lines = Array.from({ length: this.rows }, () => '')
    this.cursorRow = 0
  }

  /** Find all URLs in the line at the given row. */
  getLinksAtRow(row: number): TerminalLink[] {
    const line = this.lines[row]
    if (!line) return []

    const links: TerminalLink[] = []
    let match: RegExpExecArray | null
    URL_RE.lastIndex = 0
    while ((match = URL_RE.exec(line)) !== null) {
      let url = match[0]
      // Strip trailing punctuation that's unlikely part of the URL
      url = url.replace(/[.,;:!?)]+$/, '')
      // Ensure http(s) prefix for bare domains
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      links.push({ url, col: match.index, len: match[0].length })
    }
    return links
  }

  /** Find the URL at a specific row/col, or null. */
  getLinkAt(row: number, col: number): string | null {
    for (const link of this.getLinksAtRow(row)) {
      if (col >= link.col && col < link.col + link.len) {
        return link.url
      }
    }
    return null
  }

  /** Check if there is any URL at the given row/col. */
  hasLinkAt(row: number, col: number): boolean {
    return this.getLinkAt(row, col) !== null
  }
}
