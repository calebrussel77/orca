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
//
// Why JSX is configured here: this Monaco build only registers the base
// `typescript` / `javascript` language ids. TSX/JSX parsing is enabled by the
// model URI extension plus the worker compiler option `jsx`, not by separate
// `typescriptreact` / `javascriptreact` language ids. Without this flag Monaco
// tokenizes the file but the TS worker reports every JSX tag as a syntax error.
monacoTS.typescriptDefaults.setCompilerOptions({
  allowNonTsExtensions: true,
  target: monacoTS.ScriptTarget.Latest,
  jsx: monacoTS.JsxEmit.ReactJSX
})
monacoTS.javascriptDefaults.setCompilerOptions({
  allowNonTsExtensions: true,
  allowJs: true,
  target: monacoTS.ScriptTarget.Latest,
  jsx: monacoTS.JsxEmit.ReactJSX
})

monacoTS.typescriptDefaults.setDiagnosticsOptions({
  diagnosticCodesToIgnore: [2307, 2792]
})
monacoTS.javascriptDefaults.setDiagnosticsOptions({
  diagnosticCodesToIgnore: [2307, 2792]
})

// Configure Monaco to use the locally bundled editor instead of CDN
loader.config({ monaco })

const BEARDED_EDITOR_THEME_DARK = 'orca-bearded-black-emerald'
const PIERRE_DIFF_THEME_DARK = 'orca-pierre-dark'
const PIERRE_DIFF_THEME_LIGHT = 'orca-pierre-light'

const beardedBlackEmeraldTokenRules: monaco.editor.ITokenThemeRule[] = [
  { token: 'comment', foreground: '475262', fontStyle: 'italic' },
  { token: 'string', foreground: '00A884' },
  { token: 'string.escape', foreground: '38C7BD' },
  { token: 'number', foreground: 'D4770C' },
  { token: 'constant', foreground: 'E35535' },
  { token: 'constant.numeric', foreground: 'D4770C' },
  { token: 'keyword', foreground: 'C7910C' },
  { token: 'keyword.control', foreground: 'C7910C' },
  { token: 'keyword.operator', foreground: 'C7910C' },
  { token: 'type', foreground: 'A85FF1' },
  { token: 'type.identifier', foreground: 'A85FF1' },
  { token: 'class', foreground: 'A85FF1' },
  { token: 'class.identifier', foreground: 'A85FF1' },
  { token: 'namespace', foreground: '11B7D4' },
  { token: 'function', foreground: '11B7D4' },
  { token: 'function.call', foreground: '11B7D4' },
  { token: 'parameter', foreground: 'D46EC0' },
  { token: 'property', foreground: 'D4770C' },
  { token: 'property.declaration', foreground: 'BEC6D0' },
  { token: 'variable', foreground: 'C62F52' },
  { token: 'variable.predefined', foreground: '38C7BD' },
  { token: 'tag', foreground: '11B7D4' },
  { token: 'attribute.name', foreground: 'C7910C' },
  { token: 'attribute.value', foreground: '00A884' },
  { token: 'delimiter', foreground: 'BEC6D066' },
  { token: 'delimiter.bracket', foreground: 'BEC6D066' },
  { token: 'regexp', foreground: '11B7D4' }
]

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

// Why: the file editor should visually match the user's installed VS Code
// Bearded Theme Black & Emerald so switching between VS Code and Orca keeps the
// same syntax-color landmarks. We define the palette locally in Monaco because
// Monaco cannot load VS Code theme extensions directly.
monaco.editor.defineTheme(BEARDED_EDITOR_THEME_DARK, {
  base: 'vs-dark',
  inherit: true,
  rules: beardedBlackEmeraldTokenRules,
  colors: {
    'editor.background': '#111418',
    'editor.foreground': '#BEC6D0',
    'editor.selectionBackground': '#38C7BD4D',
    'editor.inactiveSelectionBackground': '#38C7BD4D',
    'editor.selectionHighlightBackground': '#38C7BD14',
    'editor.lineHighlightBackground': '#38C7BD0F',
    'editor.lineHighlightBorder': '#38C7BD26',
    'editorCursor.foreground': '#C7910C',
    'editorCursor.background': '#38C7BD',
    'editorLineNumber.foreground': '#343A43',
    'editorLineNumber.activeForeground': '#85929E',
    'editorIndentGuide.background1': '#47526233',
    'editorIndentGuide.activeBackground1': '#475262CC',
    'editorWhitespace.foreground': '#47526260',
    'editor.findMatchBackground': '#38C7BD30',
    'editor.findMatchBorder': '#38C7BD61',
    'editor.findMatchHighlightBackground': '#38C7BD3D',
    'editor.findMatchHighlightBorder': '#38C7BD5C',
    'editor.wordHighlightBackground': '#38C7BD73',
    'editor.wordHighlightBorder': '#38C7BD8A',
    'editor.wordHighlightStrongBackground': '#38C7BD4D',
    'editorBracketHighlight.foreground1': '#C7910C',
    'editorBracketHighlight.foreground2': '#D46EC0',
    'editorBracketHighlight.foreground3': '#11B7D4',
    'editorBracketHighlight.foreground4': '#A85FF1',
    'editorBracketHighlight.foreground5': '#38C7BD',
    'editorBracketHighlight.foreground6': '#C62F52',
    'editorBracketHighlight.unexpectedBracket.foreground': '#E35535',
    'editorBracketMatch.background': '#38C7BD4D',
    'editorBracketMatch.border': '#38C7BD73',
    'editorOverviewRuler.border': '#040506',
    'editorSuggestWidget.highlightForeground': '#C7910C',
    'minimap.background': '#111418'
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

export function resolveEditorMonacoTheme(mode: 'dark' | 'light'): string {
  return mode === 'dark' ? BEARDED_EDITOR_THEME_DARK : 'vs'
}

// Re-export for convenience
export { monaco }
