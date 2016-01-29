/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

console.log(ts.createNode(ts.SyntaxKind.TypeParameter));
fs.writeFileSync('foo', 'bar\n');
