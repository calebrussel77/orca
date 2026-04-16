type MonacoModelLike = {
  getLanguageId: () => string
}

type MonacoEditorLike<TModel extends MonacoModelLike = MonacoModelLike> = {
  getModel: () => TModel | null
}

type MonacoApiLike<TModel extends MonacoModelLike = MonacoModelLike> = {
  editor: {
    setModelLanguage: (model: TModel, languageId: string) => void
  }
}

export function syncMonacoModelLanguage<TModel extends MonacoModelLike>(
  editorInstance: MonacoEditorLike<TModel>,
  monacoApi: MonacoApiLike<TModel>,
  language: string
): void {
  const model = editorInstance.getModel()
  if (!model) {
    return
  }

  // Why: MonacoEditor uses keepCurrentModel so reopening the same file path can
  // reuse an existing model whose language was created earlier (for example
  // plaintext during a transient fallback path). The React `language` prop does
  // not reliably retag an already-kept model, so we must force the model to the
  // current file's detected language to restore syntax highlighting.
  if (model.getLanguageId() !== language) {
    monacoApi.editor.setModelLanguage(model, language)
  }
}
