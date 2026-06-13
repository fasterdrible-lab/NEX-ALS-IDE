import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

// Configura Monaco para usar workers locais (funciona offline no Electron)
;(self as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    return new editorWorker()
  },
}

// Usa Monaco instalado localmente (não CDN)
loader.config({ monaco })

// TypeScript language service — acesso via cast (types marcados deprecated no Monaco 0.55)
type MonacoTsDefaults = {
  setCompilerOptions: (opts: Record<string, unknown>) => void
  setDiagnosticsOptions: (opts: Record<string, unknown>) => void
  setInlayHintsOptions?: (opts: Record<string, unknown>) => void
}
type MonacoTsLang = {
  typescriptDefaults: MonacoTsDefaults
  javascriptDefaults: MonacoTsDefaults
  ScriptTarget: Record<string, number>
  ModuleResolutionKind: Record<string, number>
  ModuleKind: Record<string, number>
  JsxEmit: Record<string, number>
}
const ts = (monaco.languages as unknown as { typescript: MonacoTsLang }).typescript

ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  module: ts.ModuleKind.CommonJS,
  noEmit: true,
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  checkJs: false,
  strict: false,
})

ts.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
})

// Inlay hints — dicas de tipo inline iguais ao VS Code
ts.typescriptDefaults.setInlayHintsOptions?.({
  includeInlayParameterNameHints: 'literals',
  includeInlayParameterNameHintsWhenArgumentMatchesName: false,
  includeInlayFunctionParameterTypeHints: true,
  includeInlayVariableTypeHints: false,
  includeInlayPropertyDeclarationTypeHints: true,
  includeInlayFunctionLikeReturnTypeHints: true,
  includeInlayEnumMemberValueHints: true,
})

ts.javascriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  allowJs: true,
  checkJs: false,
})
