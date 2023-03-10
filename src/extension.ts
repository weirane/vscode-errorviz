import * as vscode from "vscode";
import { languages } from "vscode";
import * as errorviz from "./errorviz";
import { log } from "./util";

export function activate(context: vscode.ExtensionContext) {
  languages.onDidChangeDiagnostics((e: vscode.DiagnosticChangeEvent) => {
    log.info(
      "diag change",
      e.uris.map((u) => u.toString())
    );
  });
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(saveDiagnostics));
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "errorviz.toggleVisualization",
      toggleVisualization,
      "Toggle Visualization"
    )
  );
}

function saveDiagnostics(doc: vscode.TextDocument) {
  if (doc.languageId !== "rust") {
    // only supports rust
    return;
  }
  const diagnostics = languages
    .getDiagnostics(doc.uri)
    // TODO: hack to extract main errors (not related info)
    .filter((d) => (<any>d)?.data !== undefined);
  const newdiags = new Map<string, errorviz.DiagnosticInfo>();
  const torefresh: string[] = [];
  for (const diag of diagnostics) {
    if (diag.source !== "rustc") {
      // only supports rust errors
      continue;
    }
    if (diag.code === undefined || typeof diag.code === "number" || typeof diag.code === "string") {
      log.error("unexpected diag.code type", typeof diag.code);
      return;
    }
    const erridx = diag.range.start.line.toString() + "_" + diag.code.value;
    newdiags.set(erridx, {
      diagnostics: diag,
      displayed: false,
      dectype: null,
      svg: null,
    });
    const odiag = errorviz.G.diags.get(erridx);
    if (odiag?.displayed) {
      // this is a displayed old diagnostics
      torefresh.push(erridx);
    }
  }
  errorviz.G.showTriangles(newdiags);
  for (const d of torefresh) {
    errorviz.G.hideDiag(d);
    errorviz.G.showDiag(d, newdiags);
  }
  errorviz.G.diags = newdiags;
  // TODO: refresh diagnostics
}

function toggleVisualization() {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    log.error("no editor");
    return;
  }
  const currline = editor.selection.active.line;
  const lines = [...errorviz.G.diags.keys()];
  const ontheline = lines.filter((i) => parseInt(i) === currline);
  if (!ontheline) {
    log.info("nothing to toggle");
    return;
  }
  if (ontheline.length > 1) {
    // TODO: use quick picks https://code.visualstudio.com/api/ux-guidelines/quick-picks
    log.error(`too many errors on line ${ontheline}`);
    return;
  }
  const totoggle = errorviz.G.diags.get(ontheline[0]);
  if (totoggle === undefined) {
    log.info("nothing to toggle");
    return;
  }
  if (totoggle.displayed) {
    errorviz.G.hideDiag(ontheline[0]);
  } else {
    errorviz.G.showDiag(ontheline[0]);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
