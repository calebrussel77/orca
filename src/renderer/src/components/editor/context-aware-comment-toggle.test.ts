import { describe, expect, it } from 'vitest'
import { __test__ } from './context-aware-comment-toggle'

describe('context-aware-comment-toggle', () => {
  it('uses line comments for ts files', () => {
    const style = __test__.resolveCommentStyle('src/example.ts', ['const answer = 42'], {
      startLineNumber: 1,
      endLineNumber: 1
    })

    expect(style).toEqual({ kind: 'line', prefix: '//' })
  })

  it('uses jsx comments for tsx child elements', () => {
    const style = __test__.resolveCommentStyle(
      'src/example.tsx',
      ['return (', '  <div>', '    <Widget />', '  </div>', ')'],
      {
        startLineNumber: 3,
        endLineNumber: 3
      }
    )

    expect(style).toEqual({ kind: 'wrapped', open: '{/*', close: '*/}' })
  })

  it('uses block comments for tsx attribute lines inside a jsx tag', () => {
    const style = __test__.resolveCommentStyle(
      'src/example.tsx',
      ['return (', '  <Widget', '    size="lg"', '  />', ')'],
      {
        startLineNumber: 3,
        endLineNumber: 3
      }
    )

    expect(style).toEqual({ kind: 'wrapped', open: '/*', close: '*/' })
  })

  it('uses jsx comments for jsx text children', () => {
    const style = __test__.resolveCommentStyle(
      'src/example.jsx',
      ['export function View() {', '  return <div>', '    hello', '  </div>', '}'],
      {
        startLineNumber: 3,
        endLineNumber: 3
      }
    )

    expect(style).toEqual({ kind: 'wrapped', open: '{/*', close: '*/}' })
  })

  it('uses wrapped comments for css files', () => {
    const style = __test__.resolveCommentStyle(
      'src/example.css',
      ['.card {', '  color: red;', '}'],
      {
        startLineNumber: 2,
        endLineNumber: 2
      }
    )

    expect(style).toEqual({ kind: 'wrapped', open: '/*', close: '*/' })
  })

  it('toggles line comments across selected lines', () => {
    const commented = __test__.toggleLineComments(['const a = 1', 'const b = 2'], '//', '\n')
    const uncommented = __test__.toggleLineComments(commented.split('\n'), '//', '\n')

    expect(commented).toBe('// const a = 1\n// const b = 2')
    expect(uncommented).toBe('const a = 1\nconst b = 2')
  })

  it('toggles wrapped jsx comments for a single line', () => {
    const commented = __test__.toggleWrappedComments(['    <Widget />'], '{/*', '*/}', '\n')
    const uncommented = __test__.toggleWrappedComments(commented.split('\n'), '{/*', '*/}', '\n')

    expect(commented).toBe('    {/* <Widget /> */}')
    expect(uncommented).toBe('    <Widget />')
  })

  it('normalizes multi-line selections that end at column 1', () => {
    expect(
      __test__.normalizeLineRange({
        startLineNumber: 2,
        endLineNumber: 4,
        endColumn: 1
      })
    ).toEqual({
      startLineNumber: 2,
      endLineNumber: 3
    })
  })
})
