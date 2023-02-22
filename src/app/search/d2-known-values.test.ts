import { readFile } from 'fs/promises';
import * as ts from 'typescript';

import { D2ManifestDefinitions } from '../../app/destiny2/d2-definitions';
import { getTestDefinitions } from '../../testing/test-utils';

let defs: D2ManifestDefinitions;
beforeAll(async () => {
  defs = await getTestDefinitions();
});

const tableRefRegex = /([A-Za-z]+) "([\w\s]+)"/;

interface LookupRef {
  tableName: string;
  expectedName: string;
}

function fail(reason = 'fail was called in a test.'): never {
  throw new Error(reason);
}

function lookupTable(
  defs: D2ManifestDefinitions,
  hash: number,
  { expectedName, tableName }: LookupRef
) {
  const table = defs[tableName];
  if (!table) {
    fail(`table ${tableName} doesn't exist`);
  }
  const def = table[hash] ?? table.get?.(hash);
  if (!def) {
    fail(`definition ${tableName}:${hash} does not exist (expected ${expectedName})`);
  }
  const name = def.displayProperties?.name || def.progressDescription;
  if (name !== expectedName && !(name === undefined && expectedName === '')) {
    fail(`def ${tableName}:${hash} has name ${name} (expected ${expectedName})`);
  }
}

function delint(sourceFile: ts.SourceFile) {
  delintNode(sourceFile, undefined);

  function delintNode(node: ts.Node, parentLookup: LookupRef | undefined) {
    const trailingCommentRanges =
      ts.getTrailingCommentRanges(sourceFile.getFullText(), node.getEnd()) ?? [];
    let thisLookup: LookupRef | undefined = undefined;
    for (const range of trailingCommentRanges) {
      const text = sourceFile.getFullText().slice(range.pos, range.end);
      const match = text.match(tableRefRegex);
      if (match) {
        const [, tableName, expectedName] = match;
        thisLookup = { tableName, expectedName };
        break;
      }
    }

    const relevantLookup = thisLookup ?? parentLookup;

    switch (node.kind) {
      case ts.SyntaxKind.NumericLiteral: {
        const initText = (node as ts.NumericLiteral).text;
        const hash = initText !== undefined && parseInt(initText, 10);
        if (hash && relevantLookup) {
          lookupTable(defs, hash, relevantLookup);
        }
        break;
      }
    }

    ts.forEachChild(node, (node) => delintNode(node, relevantLookup));
  }
}

async function testFile(path: string, name: string) {
  const node = ts.createSourceFile(
    name,
    await readFile(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );

  delint(node);
}

test('d2-known-values.ts', async () => {
  await testFile('./src/app/search/d2-known-values.ts', 'd2-known-values.ts');
});

test('engrams.ts', async () => {
  await testFile('./src/app/progress/engrams.ts', 'engrams.ts');
});
