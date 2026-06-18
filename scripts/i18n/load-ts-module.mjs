import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export async function importTsModule(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      removeComments: false,
    },
    reportDiagnostics: true,
  });

  const diagnostics = result.diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  ) ?? [];
  if (diagnostics.length > 0) {
    const host = {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    };
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openoffer-i18n-'));
  const tempModule = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}.mjs`);
  fs.writeFileSync(tempModule, result.outputText);
  return import(`${pathToFileURL(tempModule).href}?v=${Date.now()}`);
}
