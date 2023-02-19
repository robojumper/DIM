import { readFile } from 'fs/promises';
import * as ts from 'typescript';

import { D2ManifestDefinitions } from 'app/destiny2/d2-definitions';
import { getTestDefinitions } from 'testing/test-utils';

let defs: D2ManifestDefinitions;
beforeAll(async () => {
  defs = await getTestDefinitions();
});

const tableRefRegex = /([A-Za-z]+) "([\w\s]+)"/;

function fail(reason = 'fail was called in a test.'): never {
  throw new Error(reason);
}

function lookupTable(
  defs: D2ManifestDefinitions,
  tableName: string,
  hash: number,
  expectedName: string
) {
  const table = defs[tableName];
  if (!table) {
    fail(`table ${tableName} doesn't exist`);
  }
  const def = table[hash] ?? table.get?.(hash);
  if (!def) {
    fail(`definition ${tableName}:${hash} does not exist (expected ${expectedName})`);
  }
  const name = def.displayProperties?.name;
  if (name !== expectedName && !(name === undefined && expectedName === '')) {
    fail(
      `def ${tableName}:${hash} has name ${def.displayProperties?.name} (expected ${expectedName})`
    );
  }
}

function delint(sourceFile: ts.SourceFile) {
  delintNode(sourceFile);

  function delintNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.VariableDeclaration: {
        const initText = (node as ts.VariableDeclaration).initializer?.getText(sourceFile);
        const hash = initText !== undefined && parseInt(initText, 10);
        if (Boolean(hash)) {
          const trailingCommentRanges = ts.getTrailingCommentRanges(
            sourceFile.getFullText(),
            node.parent!.parent!.getEnd()
          );
          const trailingComments = trailingCommentRanges?.map((range) =>
            sourceFile.getFullText().slice(range.pos, range.end)
          );
          if (!trailingComments) {
            fail(`hash ${hash} not documented`);
          }
          let matchingCommentFound = false;
          for (const comment of trailingComments) {
            const match = comment.match(tableRefRegex);
            if (match) {
              matchingCommentFound = true;
              const [, tableName, expectedName] = match;
              lookupTable(defs, tableName, hash as number, expectedName);
            }
          }
          if (!matchingCommentFound) {
            fail(`hash ${hash} not documented`);
          }
          break;
        }
      }
    }

    ts.forEachChild(node, delintNode);
  }
}

test('d2-known-values.ts', async () => {
  const node = ts.createSourceFile(
    'd2-known-values.ts',
    await readFile('./src/app/search/d2-known-values.ts', 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  delint(node);
});
