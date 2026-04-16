import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { typescript as monacoTS } from 'monaco-editor'
import 'monaco-editor/min/vs/editor/editor.main.css'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

globalThis.MonacoEnvironment = {
  getWorker(_workerId, label) {
    switch (label) {
      case 'json':
        return new jsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new cssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new htmlWorker()
      case 'typescript':
      case 'typescriptreact':
      case 'javascript':
      case 'javascriptreact':
        return new tsWorker()
      default:
        return new editorWorker()
    }
  }
}

// Why: Monaco's built-in TypeScript worker runs in isolation without filesystem
// access, so it cannot resolve imports to project files that aren't open as
// editor models. This produces false "Cannot find module" diagnostics for every
// import statement. Ignoring specific TS diagnostic codes (e.g., 2307, 2792)
// removes this noise while keeping type checking, auto-complete, and basic
// validation fully functional for local symbols.
monacoTS.typescriptDefaults.setDiagnosticsOptions({
  diagnosticCodesToIgnore: [2307, 2792]
})
monacoTS.javascriptDefaults.setDiagnosticsOptions({
  diagnosticCodesToIgnore: [2307, 2792]
})

// Configure Monaco to use the locally bundled editor instead of CDN
loader.config({ monaco })

const PIERRE_DIFF_THEME_DARK = 'orca-pierre-dark'
const PIERRE_DIFF_THEME_LIGHT = 'orca-pierre-light'

const pierreSharedTokenRules = [
  { token: 'comment', foreground: '84848A' },
  { token: 'string', foreground: '5ECC71' },
  { token: 'string.escape', foreground: 'FFA359' },
  { token: 'number', foreground: '68CDF2' },
  { token: 'keyword', foreground: 'FF678D' },
  { token: 'keyword.flow', foreground: 'FF678D' },
  { token: 'keyword.operator', foreground: '08C0EF' },
  { token: 'type', foreground: 'D568EA' },
  { token: 'type.identifier', foreground: 'D568EA' },
  { token: 'class', foreground: 'D568EA' },
  { token: 'class.identifier', foreground: 'D568EA' },
  { token: 'function', foreground: '9D6AFB' },
  { token: 'function.call', foreground: '9D6AFB' },
  { token: 'parameter', foreground: 'ADADB1' },
  { token: 'variable', foreground: 'FFA359' },
  { token: 'variable.predefined', foreground: 'FFCA00' },
  { token: 'constant', foreground: 'FFD452' },
  { token: 'regexp', foreground: '08C0EF' },
  { token: 'tag', foreground: 'FF678D' },
  { token: 'attribute.name', foreground: 'FFA359' },
  { token: 'attribute.value', foreground: '5ECC71' },
  { token: 'delimiter', foreground: '79797F' },
  { token: 'delimiter.bracket', foreground: '79797F' },
  { token: 'namespace', foreground: 'FFCA00' }
]

const pierreLightTokenRules = pierreSharedTokenRules.map((rule) => {
  switch (rule.token) {
    case 'string':
      return { ...rule, foreground: '199F43' }
    case 'number':
      return { ...rule, foreground: '1CA1C7' }
    case 'keyword':
    case 'keyword.flow':
    case 'tag':
      return { ...rule, foreground: 'FC2B73' }
    case 'type':
    case 'type.identifier':
    case 'class':
    case 'class.identifier':
      return { ...rule, foreground: 'C635E4' }
    case 'function':
    case 'function.call':
      return { ...rule, foreground: '7B43F8' }
    case 'parameter':
      return { ...rule, foreground: '79797F' }
    case 'variable':
    case 'attribute.name':
    case 'string.escape':
      return { ...rule, foreground: 'D47628' }
    case 'constant':
    case 'variable.predefined':
    case 'namespace':
      return { ...rule, foreground: 'D5A910' }
    default:
      return rule
  }
})

// Why: t3code renders diff syntax through @pierre/diffs and its Pierre themes.
// Orca still relies on Monaco for editable diffs, so we mirror the Pierre color
// system here instead of swapping out Monaco and losing inline-edit behavior.
monaco.editor.defineTheme(PIERRE_DIFF_THEME_DARK, {
  base: 'vs-dark',
  inherit: true,
  rules: pierreSharedTokenRules,
  colors: {
    'editor.background': '#070707',
    'editor.foreground': '#FBFBFB',
    'editor.selectionBackground': '#009FFF4D',
    'editor.lineHighlightBackground': '#19283C8C',
    'editorCursor.foreground': '#009FFF',
    'editorLineNumber.foreground': '#84848A',
    'editorLineNumber.activeForeground': '#ADADB1',
    'editorIndentGuide.background': '#1F1F21',
    'editorIndentGuide.activeBackground': '#2E2E30',
    'diffEditor.insertedTextBackground': '#00CAB11A',
    'diffEditor.insertedLineBackground': '#00CAB10F',
    'diffEditor.removedTextBackground': '#FF2E3F1A',
    'diffEditor.removedLineBackground': '#FF2E3F0F',
    'editorGutter.addedBackground': '#00CAB1',
    'editorGutter.modifiedBackground': '#009FFF',
    'editorGutter.deletedBackground': '#FF2E3F'
  }
})

monaco.editor.defineTheme(PIERRE_DIFF_THEME_LIGHT, {
  base: 'vs',
  inherit: true,
  rules: pierreLightTokenRules,
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#070707',
    'editor.selectionBackground': '#009FFF2E',
    'editor.lineHighlightBackground': '#DFEBFF8C',
    'editorCursor.foreground': '#009FFF',
    'editorLineNumber.foreground': '#84848A',
    'editorLineNumber.activeForeground': '#6C6C71',
    'editorIndentGuide.background': '#EEEEEF',
    'editorIndentGuide.activeBackground': '#DBDBDD',
    'diffEditor.insertedTextBackground': '#00CAB133',
    'diffEditor.insertedLineBackground': '#00CAB118',
    'diffEditor.removedTextBackground': '#FF2E3F33',
    'diffEditor.removedLineBackground': '#FF2E3F18',
    'editorGutter.addedBackground': '#00CAB1',
    'editorGutter.modifiedBackground': '#009FFF',
    'editorGutter.deletedBackground': '#FF2E3F'
  }
})

export function resolveDiffMonacoTheme(mode: 'dark' | 'light'): string {
  return mode === 'dark' ? PIERRE_DIFF_THEME_DARK : PIERRE_DIFF_THEME_LIGHT
}

// Re-export for convenience
export { monaco }
