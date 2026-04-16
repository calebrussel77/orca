import vscodeIconsManifest from './vscode-icons-manifest.json'
import languageAssociationsData from './vscode-icons-language-associations.json'

const VSCODE_ICONS_VERSION = 'v12.17.0'
const VSCODE_ICONS_BASE_URL = `https://cdn.jsdelivr.net/gh/vscode-icons/vscode-icons@${VSCODE_ICONS_VERSION}/icons`

type IconDefinition = {
  iconPath: string
}

type IconLookupSection = {
  file?: string
  folder?: string
  fileNames: Record<string, string>
  fileExtensions: Record<string, string>
  folderNames: Record<string, string>
  languageIds?: Record<string, string>
}

type VscodeIconsManifest = IconLookupSection & {
  iconDefinitions: Record<string, IconDefinition>
  light: IconLookupSection
}

type LanguageAssociations = {
  version: string
  extensionToLanguageId: Record<string, string>
  fileNameToLanguageId: Record<string, string>
}

const manifest = vscodeIconsManifest as VscodeIconsManifest
const languageAssociations = languageAssociationsData as LanguageAssociations
const iconDefinitions = manifest.iconDefinitions

const darkFileNames = toLowercaseLookup(manifest.fileNames)
const lightFileNames = toLowercaseLookup(manifest.light.fileNames)
const darkFileExtensions = toLowercaseLookup(manifest.fileExtensions)
const lightFileExtensions = toLowercaseLookup(manifest.light.fileExtensions)
const darkFolderNames = toLowercaseLookup(manifest.folderNames)
const lightFolderNames = toLowercaseLookup(manifest.light.folderNames)
const darkLanguageIds = toLowercaseLookup(manifest.languageIds ?? {})
const lightLanguageIds = toLowercaseLookup(manifest.light.languageIds ?? {})
const languageIdByExtension = toLowercaseLookup(languageAssociations.extensionToLanguageId)
const languageIdByFileName = toLowercaseLookup(languageAssociations.fileNameToLanguageId)

const localLanguageIdByExtensionOverrides = {
  // Why: Cursor rules files are effectively markdown in the editors Orca users
  // compare against, so treating them as plain data looks noticeably worse.
  mdc: 'markdown',
  // Why: the upstream manifest can prefer specialized HTML/YAML variants that
  // feel random in a general-purpose diff/file tree. Mirror t3code's
  // normalization so common web config files get the expected base icon.
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml'
} as const

const defaultDarkFileIconDefinition = manifest.file ?? '_file'
const defaultLightFileIconDefinition = manifest.light.file ?? defaultDarkFileIconDefinition
const defaultDarkFolderIconDefinition = manifest.folder ?? '_folder'
const defaultLightFolderIconDefinition = manifest.light.folder ?? defaultDarkFolderIconDefinition

function toLowercaseLookup(source: Record<string, string>): Record<string, string> {
  const lookup: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    lookup[key.toLowerCase()] = value
  }
  return lookup
}

export function basenameOfPath(pathValue: string): string {
  const normalizedPath = pathValue.replace(/[\\/]+$/, '')
  const lastSeparatorIndex = Math.max(
    normalizedPath.lastIndexOf('/'),
    normalizedPath.lastIndexOf('\\')
  )

  return lastSeparatorIndex === -1 ? normalizedPath : normalizedPath.slice(lastSeparatorIndex + 1)
}

function extensionCandidates(fileName: string): string[] {
  const candidates = new Set<string>()
  if (fileName.includes('.')) {
    candidates.add(fileName)
  }

  let dotIndex = fileName.indexOf('.')
  while (dotIndex !== -1 && dotIndex < fileName.length - 1) {
    const candidate = fileName.slice(dotIndex + 1)
    if (candidate.length > 0) {
      candidates.add(candidate)
    }
    dotIndex = fileName.indexOf('.', dotIndex + 1)
  }

  return [...candidates]
}

function resolveLanguageFallbackDefinition(
  pathValue: string,
  theme: 'light' | 'dark'
): string | null {
  const baseName = basenameOfPath(pathValue).toLowerCase()
  const languageIds = theme === 'light' ? lightLanguageIds : darkLanguageIds

  const fromBasenameLanguage = languageIdByFileName[baseName]
  if (fromBasenameLanguage) {
    return languageIds[fromBasenameLanguage] ?? darkLanguageIds[fromBasenameLanguage] ?? null
  }

  for (const candidate of extensionCandidates(baseName)) {
    const override =
      localLanguageIdByExtensionOverrides[
        candidate as keyof typeof localLanguageIdByExtensionOverrides
      ]
    const languageId = override ?? languageIdByExtension[candidate]
    if (!languageId) {
      continue
    }
    return languageIds[languageId] ?? darkLanguageIds[languageId] ?? null
  }

  return null
}

function iconFilenameForDefinitionKey(definitionKey: string | undefined): string | null {
  if (!definitionKey) {
    return null
  }

  const iconPath = iconDefinitions[definitionKey]?.iconPath
  if (!iconPath) {
    return null
  }

  const slashIndex = iconPath.lastIndexOf('/')
  return slashIndex === -1 ? iconPath : iconPath.slice(slashIndex + 1)
}

function resolveFileDefinition(pathValue: string, theme: 'light' | 'dark'): string {
  const baseName = basenameOfPath(pathValue).toLowerCase()
  const fileNames = theme === 'light' ? lightFileNames : darkFileNames
  const fileExtensions = theme === 'light' ? lightFileExtensions : darkFileExtensions

  const fromFileName = fileNames[baseName] ?? darkFileNames[baseName]
  if (fromFileName) {
    return fromFileName
  }

  // Why: exact filename and multi-part extension matches (for example
  // `tsconfig.tsbuildinfo`) are the highest-signal mappings in vscode-icons.
  // Falling back to language ids only after those checks preserves the same
  // specificity t3code uses in its diff/file trees.
  for (const candidate of extensionCandidates(baseName)) {
    const fromExtension = fileExtensions[candidate] ?? darkFileExtensions[candidate]
    if (fromExtension) {
      return fromExtension
    }
  }

  const fromLanguage = resolveLanguageFallbackDefinition(pathValue, theme)
  if (fromLanguage) {
    return fromLanguage
  }

  return theme === 'light' ? defaultLightFileIconDefinition : defaultDarkFileIconDefinition
}

function resolveFolderDefinition(pathValue: string, theme: 'light' | 'dark'): string {
  const baseName = basenameOfPath(pathValue).toLowerCase()
  const folderNames = theme === 'light' ? lightFolderNames : darkFolderNames

  return (
    folderNames[baseName] ??
    darkFolderNames[baseName] ??
    (theme === 'light' ? defaultLightFolderIconDefinition : defaultDarkFolderIconDefinition)
  )
}

export function getVscodeIconUrlForEntry(
  pathValue: string,
  kind: 'file' | 'directory',
  theme: 'light' | 'dark'
): string {
  const definitionKey =
    kind === 'directory'
      ? resolveFolderDefinition(pathValue, theme)
      : resolveFileDefinition(pathValue, theme)

  const iconFilename =
    iconFilenameForDefinitionKey(definitionKey) ??
    (kind === 'directory' ? 'default_folder.svg' : 'default_file.svg')

  return `${VSCODE_ICONS_BASE_URL}/${iconFilename}`
}
