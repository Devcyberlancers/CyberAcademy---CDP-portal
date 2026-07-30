import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const backendRoot = path.resolve(import.meta.dirname, '..');

function files(root, extension) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? files(target, extension) : entry.name.endsWith(extension) ? [target] : [];
  });
}

function normalized(method, route) {
  const value = (`/${route}`).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return `${method.toUpperCase()} ${value.replace(/:([A-Za-z_]\w*)/g, '{param}').replace(/\{[A-Za-z_]\w*\}/g, '{param}')}`;
}

function decoratorCall(node, name) {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  for (const decorator of decorators) {
    if (!ts.isCallExpression(decorator.expression)) continue;
    if (decorator.expression.expression.getText() === name) return decorator.expression;
  }
  return undefined;
}

function stringArgument(call) {
  const argument = call?.arguments[0];
  return argument && ts.isStringLiteralLike(argument) ? argument.text : '';
}

function nestRoutes() {
  const routes = [];
  for (const file of files(path.join(backendRoot, 'src'), '.ts')) {
    const sourceText = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node)) return;
      const controller = decoratorCall(node, 'Controller');
      if (!controller) return;
      const prefix = stringArgument(controller);
      for (const member of node.members) {
        for (const method of ['Get', 'Post', 'Put', 'Patch', 'Delete']) {
          const route = decoratorCall(member, method);
          if (route) routes.push({ key: normalized(method, `${prefix}/${stringArgument(route)}`), file: path.relative(backendRoot, file) });
        }
      }
    });
  }
  return routes;
}

const nest = nestRoutes();
const actual = new Set(nest.map((row) => row.key));
const grouped = Map.groupBy(nest, (row) => row.key);
const collisionRoutes = [...grouped.entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([key, rows]) => ({ route: key, declarations: rows.map((row) => row.file) }));

console.log(JSON.stringify({
  nestRouteDeclarations: nest.length,
  nestUniqueRoutes: actual.size,
  duplicateRoutes: collisionRoutes,
}, null, 2));

if (collisionRoutes.length) process.exitCode = 1;
