/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

const langver : string = "1.2.3";
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

/*
 * Heuristic that attempts to guess
 * whether a type name refers to a real type or a type parameter.
 * This is necessary because we don’t operate on a typechecked AST.
 * It’s also obviously horrible,
 * and the second iteration will definitely do this properly.
 */
function isTypeParameter(typeName: string): boolean {
    // make this as hacky as needed for the first iteration
    // for now: assume all type parameters are a single uppercase letter
    return typeName.length === 1 && typeName.toUpperCase() === typeName;
}

function emitType(type: ts.TypeNode): void {
    switch (type.kind) {
    case ts.SyntaxKind.StringKeyword: {
        writeModel('{md:"$",pk:"$",nm:"String"}');
        break;
    }
    case ts.SyntaxKind.NumberKeyword: {
        writeModel('{comp:"u",l:[{md:"$",pk:"$",nm:"Integer"},{md:"$",pk:"$",nm:"Float"}]}');
        break;
    }
    case ts.SyntaxKind.TypeReference: {
        const ref = <ts.TypeReferenceNode>type;
        // TODO deal with qualified names
        const typeName: string = (<ts.Identifier>ref.typeName).text;
        writeModel("{");
        if (!isTypeParameter(typeName)) {
            writeModel('pk:".",');
        }
        writeModel(`nm:"${typeName}"}`);
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

function emitHeritage(clauses: ts.NodeArray<ts.HeritageClause>): void {
    let superClass: string = null;
    let interfaces: Array<string> = [];
    for (let clause of clauses || []) {
        switch (clause.token) {
        case ts.SyntaxKind.ExtendsKeyword: {
            if (clause.types.length !== 1 || superClass !== null) {
                error("multiple inheritance not yet supported");
                continue;
            }
            let sup = clause.types[0];
            if (sup.typeArguments) {
                error("type arguments not yet supported");
                continue;
            }
            switch (sup.expression.kind) {
            case ts.SyntaxKind.Identifier: {
                let ident = <ts.Identifier>sup.expression;
                superClass = ident.text;
                break;
            }
            default: {
                error("unknown superclass expression kind " + sup.expression.kind);
                break;
            }
            }
            break;
        }
        case ts.SyntaxKind.ImplementsKeyword: {
            for (let type of clause.types) {
                const expr = type.expression;
                switch (expr.kind) {
                case ts.SyntaxKind.Identifier: {
                    let ident = <ts.Identifier>expr;
                    interfaces.push(ident.text);
                    break;
                }
                default: {
                    error("unknown superinterface expression kind " + expr.kind);
                    break;
                }
                }
            }
            break;
        }
        default: {
            error("unknown inheritance kind " + clause.token);
            break;
        }
        }
    }
    if (superClass) {
        writeModel(`,super:{pk:".",nm:${superClass}}`);
    } else {
        writeModel(',super:{md:"$",pk:"$",nm:"Basic"}');
    }
    if (interfaces.length > 0) {
        writeModel(`,sts:[{pk:".",nm:"${interfaces[0]}"}`);
        for (let i = 1; i < interfaces.length; i++) {
            writeModel(`,{pk:".",nm:"${interfaces[i]}"}`);
        }
        writeModel(']');
    }
}

function emitTypeParameters(tparams?: ts.NodeArray<ts.TypeParameterDeclaration>): void {
    if (tparams && tparams.length > 0) {
        writeModel(",tp:[");
        let comma: boolean = false;
        for (let tparam of tparams) {
            if (comma) writeModel(",");
            comma = true;
            writeModel("{");
            if (tparam.constraint) {
                writeModel("sts:[");
                emitType(tparam.constraint);
                writeModel("],");
            }
            writeModel(`nm:"${tparam.name.text}"}`);
        }
        writeModel("]");
    }
}

function findConstructor(cdecl: ts.ClassDeclaration): ts.ConstructorDeclaration {
    for (let member of cdecl.members)
        if (member.kind === ts.SyntaxKind.Constructor)
            return <ts.ConstructorDeclaration>member;
}

function emitDeclaration(decl: ts.Declaration): void {
    switch (decl.kind) {
    case ts.SyntaxKind.FunctionDeclaration: {
        const fdecl = <ts.FunctionDeclaration>decl;
        const name = fdecl.name.text;
        writeModel(`${name}:{$t:`);
        emitType(fdecl.type);
        writeModel(",pa:1");
        emitParameters(fdecl.parameters, true);
        emitTypeParameters(fdecl.typeParameters);
        writeModel(`,mt:"m",nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.ClassDeclaration: {
        const cdecl = <ts.ClassDeclaration>decl;
        const name = cdecl.name.text;
        writeModel(`${name}:{pa:1`);
        emitHeritage(cdecl.heritageClauses);
        const constdecl = findConstructor(cdecl);
        emitParameters(constdecl.parameters, false);
        writeModel(`,mt:"c",$at:{`);
        let comma: boolean = false;
        for (const declName in cdecl.members) {
            const decl = cdecl.members[declName];
            if (decl.kind === ts.SyntaxKind.Constructor || decl.kind === undefined) continue;
            if (comma) writeModel(",");
            comma = true;
            emitDeclaration(decl);
        }
        writeModel('}');
        emitTypeParameters(cdecl.typeParameters);
        writeModel(`,nm:"${name}",$cn:{$def:{pa:1,$new:true`);
        emitParameters(constdecl.parameters, false);
        writeModel("}}}");
        break;
    }
    case ts.SyntaxKind.InterfaceDeclaration: {
        const idecl = <ts.InterfaceDeclaration>decl;
        const name = idecl.name.text;
        writeModel(`${name}:{pa:1,mt:"i",$at:{`);
        let comma: boolean = false;
        for (const declName in idecl.members) {
            const decl = idecl.members[declName];
            if (decl.kind === undefined) continue;
            if (comma) writeModel(",");
            comma = true;
            emitDeclaration(decl);
        }
        writeModel(`},nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.PropertyDeclaration: {
        const pdecl = <ts.PropertyDeclaration>decl;
        const name = (<ts.Identifier>pdecl.name).text;
        writeModel(`${name}:{$t:`);
        emitType(pdecl.type);
        writeModel(`,pa:1,mt:"a",nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.PropertySignature: {
        const pdecl = <ts.PropertySignature>decl;
        const name = (<ts.Identifier>pdecl.name).text;
        writeModel(`${name}:{$t:`);
        emitType(pdecl.type);
        writeModel(`,pa:5,mt:"a",nm:"${name}"}`);
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
    const decl = sourceFile.locals[declName].declarations[0];
    switch (decl.kind) {
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.ClassDeclaration: {
        writeJsLine(`ex$.${declName}=${declName};`);
        break;
    }
    case ts.SyntaxKind.InterfaceDeclaration: {
        // does not appear in source code
        break;
    }
    default: {
        error("unknown toplevel declaration kind " + decl.kind);
        break;
    }
    }
}

writeJs(`});
}(typeof define==='function' && define.amd ? define : function (factory) {
if (typeof exports!=='undefined') { factory(require, exports, module);
} else { throw 'no module loader'; }
}));
`);
