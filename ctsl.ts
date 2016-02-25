/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

const langver : string = "1.2.2";
const modname : string = "simple";
const modver : string = "1.0.0";
const program : ts.Program = ts.createProgram([`${modname}.ts`], {});
const sourceFiles : ts.SourceFile[] = program.getSourceFiles();
const sourceFile : ts.SourceFile = sourceFiles[sourceFiles.length - 1];
const checker : ts.TypeChecker = program.getTypeChecker();
const fd_js : number = fs.openSync(`modules/${modname}/${modver}/${modname}-${modver}.js`, "w");
const fd_model : number = fs.openSync(`modules/${modname}/${modver}/${modname}-${modver}-model.js`, "w");

function write(fd: number, text: string): void {
    (<any>fs).writeSync(fd, text); // the DefinitelyTyped file is missing most of the writeSync overloads, so remove type info
}

function writeJs(text: string = ""): void {
    write(fd_js, text);
}

function writeJsLine(line: string = ""): void {
    writeJs(line + "\n");
}

function writeModel(text: string = ""): void {
    write(fd_model, text);
}

function error(line: string): void {
    write(2, `ctsl: ${line}\n`);
}

function emitType(type: ts.TypeNode): void {
    switch (type.kind) {
    case (ts.SyntaxKind.StringKeyword): {
        writeModel('{md:"$",pk:"$",nm:"String"}');
        break;
    }
    case (ts.SyntaxKind.NumberKeyword): {
        writeModel('{comp:"u",l:[{md:"$",pk:"$",nm:"Integer"},{md:"$",pk:"$",nm:"Float"}]}');
        break;
    }
    default: {
        error("unknown type kind " + type.kind);
        break;
    }
    }
}

function emitParameters(params: ts.NodeArray<ts.ParameterDeclaration>, mpl: boolean): void {
    if (params.length > 0) {
        writeModel(",ps:[");
        if (mpl) writeModel("[");
        let comma: boolean = false;
        for (let param of params) {
            if (comma) writeModel(",");
            comma = true;
            writeModel("{$t:");
            emitType(param.type);
            writeModel(`,mt:"prm",nm:"${(<ts.Identifier>param.name).text}"}`);
        }
        if (mpl) writeModel("]");
        writeModel("]");
    }
}

function emitDeclaration(decl: ts.Declaration): void {
    switch (decl.kind) {
    case (ts.SyntaxKind.FunctionDeclaration): {
        const fdecl = <ts.FunctionDeclaration>decl;
        const name = fdecl.name.text;
        writeModel(`${name}:{$t:`);
        emitType(fdecl.type);
        writeModel(",pa:1");
        emitParameters(fdecl.parameters, true);
        writeModel(`,mt:"m",nm:"${name}"}`);
        break;
    }
    default: {
        error("unknown declaration kind " + decl.kind);
        break;
    }
    }
}

writeModel(`(function(define) { define(function(require, ex$, module) {
ex$.$CCMM$={"$mod-version":"${modver}","$mod-deps":["ceylon.language\/${langver}"],${modname}:{"$pkg-pa":1`);

for (const declName in sourceFile.locals) {
    writeModel(",");
    const decl = sourceFile.locals[declName];
    emitDeclaration(decl.declarations[0]);
}

writeModel(`},"$mod-bin":"9.0","$mod-name":"${modname}"};
});
}(typeof define==='function' && define.amd ? define : function (factory) {
if (typeof exports!=='undefined') { factory(require, exports, module);
} else { throw 'no module loader'; }
}));
`);

writeJs(`(function(define) { define(function(require, ex$, module) {

var _CTM$;function $CCMM$(){if (_CTM$===undefined)_CTM$=require('${modname}/${modver}/${modname}-${modver}-model').$CCMM$;return _CTM$;}
ex$.$CCMM$=$CCMM$;
var m$1=require('ceylon/language/${langver}/ceylon.language-${langver}');
m$1.$addmod$(m$1,'ceylon.language/${langver}');
m$1.$addmod$(ex$,'${modname}/${modver}');
ex$.$mod$ans$=[];
ex$.$pkg$ans$${modname}=function(){return[m$1.shared()];};
`);

program.emit(sourceFile, function(fileName: string, data: string, writeByteOrderMark: boolean, onError: (message: string) => void): void {
    writeJs(data);
});

for (const declName in sourceFile.locals) {
    // TODO only declarations that actually appear in source code! not interfaces!
    writeJs(`ex$.${declName}=${declName};\n`);
}

writeJs(`});
}(typeof define==='function' && define.amd ? define : function (factory) {
if (typeof exports!=='undefined') { factory(require, exports, module);
} else { throw 'no module loader'; }
}));
`);
