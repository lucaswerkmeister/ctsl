/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

const langver: string = "1.2.3";
const dirname: string = "TypeScript/src/compiler/";
const modname: string = "tsc";
const units: string[] = ["binder", "checker", "commandLineParser", "core", "declarationEmitter", "diagnosticInformationMap.generated", "emitter", "parser", "program", "scanner", "sourcemap", "sys", "types", "utilities"];
const modver: string = "1.0.0";
const options: ts.CompilerOptions = {};
const host: ts.CompilerHost = ts.createCompilerHost(options);
const filenames: string[] = [];
for (const unit of units) { filenames.push(`${dirname}${unit}.ts`); }
const program: ts.Program = ts.createProgram(filenames, options, host);
const sourceFiles: ts.SourceFile[] = program.getSourceFiles();
const checker: ts.TypeChecker = program.getTypeChecker();
const fd_js: number = fs.openSync(`modules/${modname}/${modver}/${modname}-${modver}.js`, "w");
const fd_model: number = fs.openSync(`modules/${modname}/${modver}/${modname}-${modver}-model.js`, "w");

function write(fd: number, text: string): number {
    return (<any>fs).writeSync(fd, text); // the DefinitelyTyped file is missing most of the writeSync overloads, so remove type info
}

function writeJs(text: string = ""): void {
    write(fd_js, text);
}

function writeJsLine(line: string = ""): void {
    writeJs(line + "\n");
}

let modelPosition: number = 0;
function writeModel(text: string = ""): void {
    modelPosition += write(fd_model, text);
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
    return typeName.length === 1 && typeName.toUpperCase() === typeName ||
        typeName.length === 2 && typeName[0].toUpperCase() === typeName[0] && parseInt(typeName[1]) >= 0;
}

function emitType(type: ts.TypeNode): void {
    if (!type) type = <ts.TypeNode>{ kind: ts.SyntaxKind.AnyKeyword };
    switch (type.kind) {
    case ts.SyntaxKind.StringKeyword: {
        writeModel('{md:"$",pk:"$",nm:"String"}');
        break;
    }
    case ts.SyntaxKind.NumberKeyword: {
        writeModel('{comp:"u",l:[{md:"$",pk:"$",nm:"Integer"},{md:"$",pk:"$",nm:"Float"}]}');
        break;
    }
    case ts.SyntaxKind.BooleanKeyword: {
        writeModel('{md:"$",pk:"$",nm:"Boolean"}');
        break;
    }
    case ts.SyntaxKind.VoidKeyword: {
        writeModel('{md:"$",pk:"$",nm:"Anything"}');
        break;
    }
    case ts.SyntaxKind.StringLiteralType: {
        // map all string literal types to String for now
        writeModel('{md:"$",pk:"$",nm:"String"}');
        break;
    }
    case ts.SyntaxKind.AnyKeyword: {
        // map to Anything for now
        writeModel('{md:"$",pk:"$",nm:"Anything"}');
        break;
    }
    case ts.SyntaxKind.ParenthesizedType: {
        emitType((<ts.ParenthesizedTypeNode>type).type);
        break;
    }
    case ts.SyntaxKind.TypeReference: {
        const ref = <ts.TypeReferenceNode>type;
        // TODO deal with qualified names
        const typeName: string = (<ts.Identifier>ref.typeName).text;
        writeModel("{");
        if (ref.typeArguments && ref.typeArguments.length > 0) {
            writeModel('ta:{');
            let comma: boolean = false;
            let index: number = 0;
            for (const ta of ref.typeArguments) {
                if (comma) writeModel(",");
                comma = true;
                let paramName: string;
                switch (typeName) {
                case "SomeAlias": {
                    switch (index) {
                    case 0: paramName = "A"; break;
                    case 1: paramName = "B"; break;
                    }
                    break;
                }
                case "Array": {
                    if (index == 0)
                        paramName = "Element";
                    break;
                }
                case "NodeArray":
                case "Map":
                case "FileMap": {
                    if (index == 0)
                        paramName = "T";
                    break;
                }
                }
                if (!paramName) {
                    error(`cannot guess type parameter name for ${index}th type argument to ${typeName}`);
                    paramName = "UNKNOWN";
                }
                writeModel(`"${typeName}.${paramName}":`);
                emitType(ta);
                index++;
            }
            writeModel('},');
        }
        if (typeName === "Array" || typeName === "String") {
            writeModel('md:"$",pk:"$",');
        } else if (!isTypeParameter(typeName)) {
            writeModel('pk:".",');
        }
        writeModel(`nm:"${typeName}"}`);
        break;
    }
    case ts.SyntaxKind.UnionType:
    case ts.SyntaxKind.IntersectionType: {
        const uit = <ts.UnionOrIntersectionTypeNode>type;
        const comp = type.kind == ts.SyntaxKind.UnionType ? "u" : "i";
        writeModel(`{comp:"${comp}",l:[`);
        let comma: boolean = false;
        for (let t of uit.types) {
            if (comma) writeModel(",");
            comma = true;
            emitType(t);
        }
        writeModel(']}');
        break;
    }
    case ts.SyntaxKind.FunctionType: {
        const ft = <ts.FunctionTypeNode>type;
        if (ft.parameters.length == 0) {
            writeModel('{md:"$",pk:"$",nm:"Callable",ta:{"Callable.Arguments":{md:"$",pk:"$",nm:"Empty"},"Callable.Return":');
        } else {
            writeModel('{md:"$",pk:"$",nm:"Callable",ta:{"Callable.Arguments":{pk:"$",nm:"Tuple",l:[');
            let comma: boolean = false;
            for (let p of ft.parameters) {
                if (comma) writeModel(",");
                comma = true;
                emitType(p.type);
            }
            writeModel(']},"Callable.Return":');
        }
        emitType(ft.type);
        writeModel('}}');
        break;
    }
    case ts.SyntaxKind.ArrayType: {
        const at = <ts.ArrayTypeNode>type;
        writeModel('{md:"$",pk:"$",nm:"Array",ta:{"Array.Element":');
        emitType(at.elementType);
        writeModel('}}');
        break;
    }
    case ts.SyntaxKind.TypeLiteral: {
        // there’s only a single type literal in the TypeScript compiler, which we don’t care about.
        // as it’s used in an intersection type, we emit Anything here,
        // so that the intersection with the type literal is a noop.
        writeModel('{md:"$",pk:"$",nm:"Anything"}');
        break;
    }
    case ts.SyntaxKind.TypePredicate: {
        // map to boolean for now
        writeModel('{md:"$",pk:"$",nm:"Boolean"}');
        break;
    }
    case ts.SyntaxKind.ConstructorType: {
        // proper handling requires changes to backend, map to Anything for now
        writeModel('{md:"$",pk:"$",nm:"Anything"}');
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
            if (param.questionToken) {
                writeModel(',def:1');
            }
            writeModel(`,mt:"prm",nm:"${(<ts.Identifier>param.name).text}"}`);
        }
        if (mpl) writeModel("]");
        writeModel("]");
    }
}

function emitHeritage(clauses: ts.NodeArray<ts.HeritageClause>, isInterface: boolean, indexSignature: ts.IndexSignatureDeclaration, callSignature: ts.CallSignatureDeclaration): void {
    let superClass: string = null;
    let interfaces: Array<string> = [];
    for (let clause of clauses || []) {
        let token = clause.token;
        if (isInterface) {
            // rewrite extends to implements: in Ceylon, interfaces satisfy interfaces, they don’t extend them
            if (token == ts.SyntaxKind.ExtendsKeyword)
                token = ts.SyntaxKind.ImplementsKeyword;
        }
        switch (token) {
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
                if (type.typeArguments) {
                    let taName = (<any>type.typeArguments[0]).typeName.text;
                    switch (taName) {
                    case "T": {
                        // extends Array<T>
                        interfaces.push('Array",ta:{"Array.Element":{nm:"T"}},dummy:"');
                        break;
                    }
                    case "Modifier": {
                        // extends NodeArray<Modifier>
                        interfaces.push('NodeArray",ta:{"NodeArray.T":{pk:".",nm:"Modifier"}},dummy:"');
                        break;
                    }
                    default: {
                        error("type arguments not supported");
                        break;
                    }
                    }
                    continue;
                }
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
    if (indexSignature || callSignature || interfaces.length > 0) {
        writeModel(',sts:[');
        let comma: boolean = false;
        if (indexSignature) {
            if (comma) writeModel(",");
            comma = true;
            writeModel(`{md:"$",pk:"$",nm:"Correspondence",ta:{"Correspondence.Key":`);
            emitType(indexSignature.parameters[0].type);
            writeModel(',"Correspondence.Item":');
            emitType(indexSignature.type);
            writeModel('}}');
        }
        if (callSignature) {
            if (comma) writeModel(",");
            comma = true;
            if (callSignature.parameters.length == 0) {
                writeModel('{md:"$",pk:"$",nm:"Callable",ta:{"Callable.Arguments":{md:"$",pk:"$",nm:"Empty"},"Callable.Return":');
            } else {
                writeModel('{md:"$",pk:"$",nm:"Callable",ta:{"Callable.Arguments":{pk:"$",nm:"Tuple",l:[');
                let comma2: boolean = false;
                for (let p of callSignature.parameters) {
                    if (comma2) writeModel(",");
                    comma2 = true;
                    emitType(p.type);
                }
            }
            writeModel(']},"Callable.Return":');
            emitType(callSignature.type);
            writeModel('}}');
        }
        for (let i = 0; i < interfaces.length; i++) {
            if (comma) writeModel(",");
            comma = true;
            let pk: string;
            if (interfaces[i].indexOf('Array"') == 0) {
                pk = 'md:"$",pk:"$"';
            } else {
                pk = 'pk:"."';
            }
            writeModel(`{${pk},nm:"${interfaces[i]}"}`);
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

function emitDeclaration(decl: ts.Declaration): boolean {
    switch (decl.kind) {
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.MethodSignature: {
        const fdecl = <ts.FunctionDeclaration|ts.MethodDeclaration|ts.MethodSignature>decl;
        const name = (<ts.Identifier>fdecl.name).text;
        writeModel(`${name}:{$t:`);
        emitType(fdecl.type);
        let pa: number = 1; // shared
        if (decl.kind == ts.SyntaxKind.MethodSignature)
            pa |= 4; // formal
        writeModel(`,pa:${pa}`);
        emitParameters(fdecl.parameters, true);
        emitTypeParameters(fdecl.typeParameters);
        if (fdecl.type && fdecl.type.kind == ts.SyntaxKind.VoidKeyword) {
            writeModel(',$ff:1'); // flags: 1 = void, 2 = deferred
        }
        writeModel(`,mt:"m",nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.ClassDeclaration: {
        const cdecl = <ts.ClassDeclaration>decl;
        const name = cdecl.name.text;
        writeModel(`${name}:{pa:1`);
        const constdecl = findConstructor(cdecl);
        if (constdecl)
            emitParameters(constdecl.parameters, false);
        writeModel(`,mt:"c"`);
        const at: Array<ts.PropertyDeclaration> = [];
        const m: Array<ts.MethodDeclaration> = [];
        let indexSignature: ts.IndexSignatureDeclaration = null;
        for (const declName in cdecl.members) {
            const decl = cdecl.members[declName];
            switch (decl.kind) {
            case ts.SyntaxKind.Constructor:
            case undefined:
                continue;
            case ts.SyntaxKind.PropertyDeclaration:
                at.push(<ts.PropertyDeclaration>decl);
                break;
            case ts.SyntaxKind.MethodDeclaration:
                m.push(<ts.MethodDeclaration>decl);
                break;
            case ts.SyntaxKind.IndexSignature:
                indexSignature = <ts.IndexSignatureDeclaration>decl;
                break;
            default:
                error(`unknown member kind ${decl.kind}`);
                break;
            }
        }
        emitHeritage(cdecl.heritageClauses, false, indexSignature, null);
        if (at.length > 0) {
            writeModel(`,$at:{`);
            let comma: boolean = false;
            for (const decl of at) {
                if (emitDeclaration(decl)) {
                    writeModel(',');
                    comma = true;
                }
            }
            if (comma) {
                // write '}' overwriting the last comma
                (<any>fs).writeSync(fd_model, '}', modelPosition - 1);
            } else {
                writeModel('}');
            }
        }
        if (m.length > 0) {
            writeModel(`,$m:{`);
            let comma: boolean = false;
            for (const decl of m) {
                if (emitDeclaration(decl)) {
                    writeModel(',');
                    comma = true;
                }
            }
            if (comma) {
                // write '}' overwriting the last comma
                (<any>fs).writeSync(fd_model, '}', modelPosition - 1);
            } else {
                writeModel('}');
            }
        }
        emitTypeParameters(cdecl.typeParameters);
        writeModel(`,nm:"${name}"`);
        if (constdecl && constdecl.parameters.length > 0) {
            writeModel(',$cn:{$def:{pa:1,$new:true');
            emitParameters(constdecl.parameters, false);
            writeModel('}}');
        }
        writeModel("}");
        break;
    }
    case ts.SyntaxKind.InterfaceDeclaration: {
        const idecl = <ts.InterfaceDeclaration>decl;
        const name = idecl.name.text;
        writeModel(`${name}:{pa:1,mt:"i",dyn:1`);
        const at: Array<ts.PropertySignature> = [];
        const m: Array<ts.MethodSignature> = [];
        let indexSignature: ts.IndexSignatureDeclaration = null;
        let callSignature: ts.CallSignatureDeclaration = null;
        for (const declName in idecl.members) {
            const decl = idecl.members[declName];
            switch (decl.kind) {
            case undefined:
                continue;
            case ts.SyntaxKind.PropertySignature:
                at.push(<ts.PropertySignature>decl);
                break;
            case ts.SyntaxKind.MethodSignature:
                m.push(<ts.MethodSignature>decl);
                break;
            case ts.SyntaxKind.IndexSignature:
                indexSignature = <ts.IndexSignatureDeclaration>decl;
                break;
            case ts.SyntaxKind.CallSignature:
                callSignature = <ts.CallSignatureDeclaration>decl;
                break;
            default:
                error(`unknown member kind ${decl.kind}`);
                break;
            }
        }
        emitHeritage(idecl.heritageClauses, true, indexSignature, callSignature);
        if (at.length > 0) {
            writeModel(`,$at:{`);
            let comma: boolean = false;
            for (const decl of at) {
                if (emitDeclaration(decl)) {
                    writeModel(',');
                    comma = true;
                }
            }
            if (comma) {
                // write '}' overwriting the last comma
                (<any>fs).writeSync(fd_model, '}', modelPosition - 1);
            } else {
                writeModel('}');
            }
        }
        if (m.length > 0) {
            writeModel(`,$m:{`);
            let comma: boolean = false;
            for (const decl of m) {
                if (emitDeclaration(decl)) {
                    writeModel(',');
                    comma = true;
                }
            }
            if (comma) {
                // write '}' overwriting the last comma
                (<any>fs).writeSync(fd_model, '}', modelPosition - 1);
            } else {
                writeModel('}');
            }
        }
        emitTypeParameters(idecl.typeParameters);
        writeModel(`,nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.EnumDeclaration: {
        const edecl = <ts.EnumDeclaration>decl;
        const name = edecl.name.text;
        writeModel(`${name}:{pa:1,super:{md:"$",pk:"$",nm:"Basic"},mt:"c",nm:"${name}",of:[`);
        let comma: boolean = false;
        for (const member of edecl.members) {
            if (comma) writeModel(",");
            comma = true;
            const mname: string = (<ts.Identifier>member.name).text;
            writeModel(`{pk:".",nm:"${name}.${mname}"}`);
        }
        writeModel("],$cn:{");
        comma = false;
        for (const member of edecl.members) {
            if (comma) writeModel(",");
            comma = true;
            const mname: string = (<ts.Identifier>member.name).text;
            writeModel(`${mname}:{pa:1,nm:"${mname}"}`);
        }
        writeModel(`}}`);
        break;
    }
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.PropertySignature:
    case ts.SyntaxKind.VariableDeclaration: {
        const pdecl = <ts.PropertySignature>decl;
        if (pdecl.questionToken) {
            // discard optional members for now
            return false;
        }
        const name = (<ts.Identifier>pdecl.name).text;
        writeModel(`${name}:{$t:`);
        emitType(pdecl.type);
        writeModel(`,pa:1,mt:"a",nm:"${name}"}`);
        break;
    }
    case ts.SyntaxKind.IndexSignature: {
        // nothing to emit
        break;
    }
    case ts.SyntaxKind.TypeAliasDeclaration: {
        const tadecl = <ts.TypeAliasDeclaration>decl;
        const name = tadecl.name.text;
        writeModel(`${name}:{nm:"${name}",pa:1,mt:"als",$alias:`);
        emitType(tadecl.type);
        emitTypeParameters(tadecl.typeParameters);
        writeModel('}');
        break;
    }
    case ts.SyntaxKind.ModuleDeclaration: {
        // ignore for now
        return false;
    }
    default: {
        error("unknown declaration kind " + decl.kind);
        return false;
    }
    }
    return true;
}

writeModel(`(function(define) { define(function(require, ex$, module) {
ex$.$CCMM$={"$mod-version":"${modver}","$mod-deps":["ceylon.language\/${langver}"],${modname}:{"$pkg-pa":1,`);

let names: Array<string> = [];
let namespace: string = "";
for (const sourceFile of sourceFiles) {
    let locals = sourceFile.locals;
    // search for module declaration
    for (const localName in locals) {
        const local = locals[localName];
        if (local.valueDeclaration && local.valueDeclaration.kind == ts.SyntaxKind.ModuleDeclaration) {
            locals = local.exports;
            namespace = `${(<ts.Identifier>local.valueDeclaration.name).text}.`;
            break;
        }
        // TODO warn if there is a module declaration but also other toplevel declarations
    }
    
    for (const declName in locals) {
        if (names.indexOf(declName) >= 0) continue;
        const decl = locals[declName];
        if (emitDeclaration(decl.declarations[0]))
            writeModel(",");
        names.push(declName);
    }
}

writeModel('Date:{pa:1,mt:"i",nm:"Date"}');
writeModel(`},"$mod-bin":"9.1","$mod-name":"${modname}"};
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
if (!Array.prototype.iterator) Array.prototype.iterator = function() { return m$1.natc$(this,{t:m$1.Anything},'').iterator(); };
`);

for (const sourceFile of sourceFiles) {
    program.emit(sourceFile, function(fileName: string, data: string, writeByteOrderMark: boolean, onError: (message: string) => void): void {
        writeJs(data);
    });
    
    let locals = sourceFile.locals;
    // search for module declaration
    for (const localName in locals) {
        const local = locals[localName];
        if (local.valueDeclaration && local.valueDeclaration.kind == ts.SyntaxKind.ModuleDeclaration) {
            locals = local.exports;
            break;
        }
        // TODO warn if there is a module declaration but also other toplevel declarations
    }
    
    
    for (const declName in locals) {
        const decl = locals[declName].declarations[0];
        switch (decl.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.ClassDeclaration: {
            writeJsLine(`ex$.${declName}=${namespace}${declName};`);
            break;
        }
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration: {
            // does not appear in source code
            break;
        }
        case ts.SyntaxKind.ModuleDeclaration: {
            // ignore for now
            break;
        }
        case ts.SyntaxKind.EnumDeclaration: {
            const isConst: boolean = decl.modifiers && decl.modifiers.some(modifier => modifier.kind == ts.SyntaxKind.ConstKeyword);
            let value: number = -1;
            for (const member of (<ts.EnumDeclaration>decl).members) {
                const memberName: string = (<ts.Identifier>member.name).text;
                if (isConst) {
                    const initializer: ts.Expression = member.initializer;
                    if (initializer) {
                        value = parseInt((<ts.LiteralExpression>initializer).text);
                    } else {
                        value++;
                    }
                    writeJsLine(`ex$.${declName}$c_${memberName}=function(){return ${value};}`);
                } else {
                    writeJsLine(`ex$.${declName}$c_${memberName}=function(){return ${declName}.${memberName};}`);
                }
            }
            break;
        }
        case ts.SyntaxKind.VariableDeclaration: {
            writeJsLine(`ex$.${declName}=function(){return ${declName};};`);
            break;
        }
        default: {
            error("unknown toplevel declaration kind " + decl.kind);
            break;
        }
        }
    }
}

writeJs(`});
}(typeof define==='function' && define.amd ? define : function (factory) {
if (typeof exports!=='undefined') { factory(require, exports, module);
} else { throw 'no module loader'; }
}));
`);
