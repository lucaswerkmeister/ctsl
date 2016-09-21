/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

function dirExists(dir: string): boolean {
    try {
        return fs.statSync(dir).isDirectory();
    } catch (e) {
        return false;
    }
}

const langver: string = "1.3.1";
const args: string[] = process.argv.slice(2);
const modname: string = args[0] || "tsc";
const modver: string = args[1] || "1.0.0";
const filenames: string[] = args.slice(2);
if (filenames.length == 0) {
    for (const unit of ["binder", "checker", "commandLineParser", "core", "declarationEmitter", "diagnosticInformationMap.generated", "emitter", "parser", "program", "scanner", "sourcemap", "sys", "types", "utilities"]) {
        filenames.push(`TypeScript/src/compiler/${unit}.ts`);
    }
}
const options: ts.CompilerOptions = {};
const host: ts.CompilerHost = ts.createCompilerHost(options);
const program: ts.Program = ts.createProgram(filenames, options, host);
const sourceFiles: ts.SourceFile[] = program.getSourceFiles();
const checker: ts.TypeChecker = program.getTypeChecker();
for (const dir of ["modules", `modules/${modname}`, `modules/${modname}/${modver}`])
    if (!dirExists(dir))
        fs.mkdirSync(dir);
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

/*
 * A few types in tsc are problematic, so we just override them here.
 */
function replaceType(typeName: string): string {
    switch (typeName) {
    case 'PropertyName': return 'Identifier';
    default: return typeName;
    }
}

function initEnumMembers(decl: ts.EnumDeclaration): void {
    if ("enumValue" in decl.members[0]) return;
    const isConst: boolean = decl.modifiers && decl.modifiers.some(modifier => modifier.kind == ts.SyntaxKind.ConstKeyword);
    let value: number = -1;
    for (const member of decl.members) {
        const memberName: string = (<ts.Identifier>member.name).text;
        if (isConst) {
            const initializer: ts.Expression = member.initializer;
            if (initializer) {
                switch (initializer.kind) {
                case ts.SyntaxKind.NumericLiteral:
                    value = parseInt((<ts.LiteralExpression>initializer).text);
                    break;
                case ts.SyntaxKind.BinaryExpression:
                    const bexp: ts.BinaryExpression = <ts.BinaryExpression>initializer;
                    if (bexp.operatorToken.kind == ts.SyntaxKind.LessThanLessThanToken
                        && bexp.left.kind == ts.SyntaxKind.NumericLiteral
                        && bexp.right.kind == ts.SyntaxKind.NumericLiteral) {
                        value = parseInt((<ts.LiteralExpression>bexp.left).text) << parseInt((<ts.LiteralExpression>bexp.right).text);
                    } else {
                        error(`unknown binary expression in enum initializer`);
                        value = NaN;
                    }
                    break;
                default:
                    error(`unknown enum initializer kind ${initializer.kind}`);
                    break;
                }
            } else {
                value++;
            }
            (<any>member).enumValue = value.toString();
        } else {
            (<any>member).enumValue = memberName;
        }
    }
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
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.UndefinedKeyword: {
        // map to Null
        writeModel('{md:"$",pk:"$",nm:"Null"}');
        break;
    }
    case ts.SyntaxKind.ParenthesizedType: {
        emitType((<ts.ParenthesizedTypeNode>type).type);
        break;
    }
    case ts.SyntaxKind.TypeReference: {
        const ref = <ts.TypeReferenceNode>type;
        // TODO deal with qualified names
        const typeName: string = replaceType((<ts.Identifier>ref.typeName).text);
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

function emitRuntimeType(type: ts.TypeNode, containerName: string, containerTypeParameters: ts.NodeArray<ts.TypeParameterDeclaration>): void {
    if (!type) type = <ts.TypeNode>{ kind: ts.SyntaxKind.AnyKeyword };
    switch (type.kind) {
    case ts.SyntaxKind.StringKeyword: {
        writeJs('{t:m$1.$_String}');
        break;
    }
    case ts.SyntaxKind.NumberKeyword: {
        writeJs("{t:'u',l:[{t:m$1.Integer},{t:m$1.Float}]}");
        break;
    }
    case ts.SyntaxKind.BooleanKeyword: {
        writeJs('{t:m$1.$_Boolean}');
        break;
    }
    case ts.SyntaxKind.VoidKeyword: {
        writeJs('{t:m$1.Anything}');
        break;
    }
    case ts.SyntaxKind.StringLiteralType: {
        // map all string literal types to String for now
        writeJs('{t:m$1.$_String}');
        break;
    }
    case ts.SyntaxKind.AnyKeyword: {
        // map to Anything for now
        writeJs('{t:m$1.Anything}');
        break;
    }
    case ts.SyntaxKind.ParenthesizedType: {
        emitRuntimeType((<ts.ParenthesizedTypeNode>type).type, containerName, containerTypeParameters);
        break;
    }
    case ts.SyntaxKind.TypeReference: {
        const ref = <ts.TypeReferenceNode>type;
        // TODO deal with qualified names
        const typeName: string = replaceType((<ts.Identifier>ref.typeName).text);
        writeJs("{");
        if (ref.typeArguments && ref.typeArguments.length > 0) {
            writeJs('a:{');
            let comma: boolean = false;
            let index: number = 0;
            for (const ta of ref.typeArguments) {
                if (comma) writeJs(",");
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
                writeJs(`${paramName}$${typeName}:`);
                if (containerTypeParameters && containerTypeParameters.some(function(tp: ts.TypeParameterDeclaration) { return tp.name.text == typeName; })) {
                    writeJs(`'${typeName}$${containerName}'`);
                } else {
                    emitRuntimeType(ta, containerName, containerTypeParameters);
                }
                index++;
            }
            writeJs('},');
        }
        if (typeName === "Array") {
            writeJs('t:m$1.$_Array');
        } else if (typeName === "String") {
            writeJs('t:m$1.$_String');
        } else {
            writeJs(`t:$init$${typeName}()`);
        }
        writeJs('}');
        break;
    }
    case ts.SyntaxKind.UnionType:
    case ts.SyntaxKind.IntersectionType: {
        const uit = <ts.UnionOrIntersectionTypeNode>type;
        const comp = type.kind == ts.SyntaxKind.UnionType ? "u" : "i";
        writeJs(`{t:'${comp}',l:[`);
        let comma: boolean = false;
        for (let t of uit.types) {
            if (comma) writeJs(",");
            comma = true;
            emitRuntimeType(t, containerName, containerTypeParameters);
        }
        writeJs(']}');
        break;
    }
    case ts.SyntaxKind.FunctionType: {
        const ft = <ts.FunctionTypeNode>type;
        if (ft.parameters.length == 0) {
            writeJs('{t:m$1.Callable,a:{Arguments$Callable:{t:m$1.Empty},"Callable.Return":');
        } else {
            writeJs("{t:m$1.Callable,a:{Arguments$Callable:{t:'T',l:[");
            let comma: boolean = false;
            for (let p of ft.parameters) {
                if (comma) writeJs(",");
                comma = true;
                emitRuntimeType(p.type, containerName, containerTypeParameters);
            }
            writeJs(']},Return$Callable:');
        }
        emitRuntimeType(ft.type, containerName, containerTypeParameters);
        writeJs('}}');
        break;
    }
    case ts.SyntaxKind.ArrayType: {
        const at = <ts.ArrayTypeNode>type;
        writeJs('{t:m$1.$_Array,a:{Element$Array:');
        emitRuntimeType(at.elementType, containerName, containerTypeParameters);
        writeJs('}}');
        break;
    }
    case ts.SyntaxKind.TypeLiteral: {
        // there’s only a single type literal in the TypeScript compiler, which we don’t care about.
        // as it’s used in an intersection type, we emit Anything here,
        // so that the intersection with the type literal is a noop.
        writeJs('{t:m$1.Anything}');
        break;
    }
    case ts.SyntaxKind.TypePredicate: {
        // map to boolean for now
        writeJs('{t:m$1.$_Boolean}');
        break;
    }
    case ts.SyntaxKind.ConstructorType: {
        // proper handling requires changes to backend, map to Anything for now
        writeJs('{t:m$1.Anything}');
        break;
    }
    default: {
        error("unknown runtime type kind " + type.kind);
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

function emitRuntimeParameters(params: ts.NodeArray<ts.ParameterDeclaration>, containerName: string, containerTypeParameters: ts.NodeArray<ts.TypeParameterDeclaration>): void {
    if (params.length > 0) {
        writeJs(",ps:[");
        let comma: boolean = false;
        for (let param of params) {
            if (comma) writeJs(",");
            comma = true;
            writeJs("{$t:");
            emitRuntimeType(param.type, containerName, containerTypeParameters);
            if (param.questionToken) {
                writeJs(',def:1');
            }
            writeJs(`,mt:"prm",nm:"${(<ts.Identifier>param.name).text}"}`);
        }
        writeJs("]");
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
        writeModel(`,pa:${pa},dyn:1`);
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
        writeModel(`,mt:"c",dyn:1`);
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
            writeModel(',$cn:{$def:{pa:1,dyn:1');
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
        const name = (<ts.Identifier>pdecl.name).text;
        if (pdecl.questionToken || name.indexOf('_') == 0) {
            // discard optional members for now
            return false;
        }
        writeModel(`${name}:{$t:`);
        emitType(pdecl.type);
        writeModel(`,pa:1,dyn:1,mt:"a",nm:"${name}"}`);
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
        case ts.SyntaxKind.InterfaceDeclaration: {
            const idecl: ts.InterfaceDeclaration = <ts.InterfaceDeclaration>decl;
            const name: string = idecl.name.text;
            const lname: string = name[0].toLowerCase() + name.substr(1);
            writeJs(`function ${name}(${lname}$){
}
${name}.dynmem$=[`);
            let comma: boolean = false;
            for (const decl of idecl.members) {
                switch (decl.kind) {
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.MethodSignature:
                    const declName = (<ts.Identifier>decl.name).text;
                    if (decl.questionToken || declName.indexOf('_') == 0) {
                        // discard optional members for now
                        break;
                    }
                    if (comma) writeJs(',');
                    comma = true;
                    writeJs(`'${declName}'`);
                    break;
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.CallSignature:
                    break;
                default:
                    error(`unknown member kind ${decl.kind}`);
                    break;
                }
            }
            writeJs(`];${name}.$crtmm$=function(){return{mod:$CCMM$,pa:1,d:['${modname}','${name}']};};
ex$.${name}=${name};
function $init$${name}(){
    if(${name}.$$===undefined){
        m$1.initTypeProtoI(${name},'${modname}::${name}');
        (function(${lname}$){
`);
            for (const decl of idecl.members) {
                switch (decl.kind) {
                case ts.SyntaxKind.PropertySignature: {
                    const declName = (<ts.Identifier>decl.name).text;
                    const declUname = declName[0].toUpperCase() + declName.substr(1);
                    const pdecl = <ts.PropertySignature>decl;
                    writeJs(`            ${lname}$.$prop$get${declUname}={$crtmm$:function(){return{mod:$CCMM$,$t:`);
                    emitRuntimeType(pdecl.type, name, idecl.typeParameters);
                    writeJsLine(`,$cont:${name},pa:1029,d:['${modname}','${name}','$at','${declName}']};}};`);
                    break;
                }
                case ts.SyntaxKind.MethodSignature: {
                    const declName = (<ts.Identifier>decl.name).text;
                    const declUname = declName[0].toUpperCase() + declName.substr(1);
                    const mdecl = <ts.MethodSignature>decl;
                    writeJs(`            ${lname}$.${declName}={$fml:1,$crtmm$:function(){return{mod:$CCMM$,$t:`);
                    emitRuntimeType(mdecl.type, name, idecl.typeParameters);
                    emitRuntimeParameters(mdecl.parameters, name, idecl.typeParameters);
                    writeJsLine(`,$cont:${name},pa:5,d:['${modname}','${name}','$m','${declName}']};}};`);
                    break;
                }
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.CallSignature:
                    break;
                default:
                    error(`unknown member kind ${decl.kind}`);
                    break;
                }
            }
            writeJs(`        })(${name}.$$.prototype);
    }
    return ${name};
}
ex$.$init$${name}=$init$${name};
$init$${name}();
`);
            break;
        }
        case ts.SyntaxKind.TypeAliasDeclaration: {
            const tadecl: ts.TypeAliasDeclaration = <ts.TypeAliasDeclaration>decl;
            const name: string = tadecl.name.text;
            writeJs(`function ${name}(){var $2=`);
            emitRuntimeType(tadecl.type, name, tadecl.typeParameters); // note: JS backend emits calls to m$1.$mut/$mit$mtt to flatten union/intersection/tuple types – ignored here for simplicity’s sake
            writeJsLine(`;$2.$crtmm$=function(){return{mod:$CCMM$,pa:1,d:['${modname}','${name}']};};return $2;}
ex$.${name}=${name};`);
            break;
        }
        case ts.SyntaxKind.ModuleDeclaration: {
            // ignore for now
            break;
        }
        case ts.SyntaxKind.EnumDeclaration: {
            writeJsLine(`function ${declName}(){m$1.throwexc(Exception("${modname}::${declName} has no default constructor."),'0:0-0:0','/dev/null');}
function ${declName}$$c(syntaxKind$){
    $init$${declName}();
    if(syntaxKind$===undefined)syntaxKind$=new ${declName}.$$;
    return syntaxKind$;
}`);
            const edecl = <ts.EnumDeclaration> decl;
            initEnumMembers(edecl);
            for (const member of edecl.members) {
                const memberName: string = (<ts.Identifier>member.name).text;
                const enumValue: string = (<any>member).enumValue;
                let expr: string = enumValue.match(/[1-9][0-9]*|0/) ? enumValue : `${declName}.${enumValue}`;
                writeJsLine(`function ${declName}$c_${memberName}(){return ${expr};}
${declName}$c_${memberName}.$crtmm$=function(){return{mod:$CCMM$,$t:{t:${declName}},$cont:${declName},pa:1,d:['${modname}','${declName}','$cn','${memberName}']};}
ex$.${declName}$c_${memberName}=${declName}$c_${memberName};
${declName}.${declName}$c_${memberName}=${declName}$c_${memberName};`);
            }
            writeJs(`${declName}.$crtmm$=function(){return{mod:$CCMM$,'super':{t:m$1.Basic},of:[`);
            let comma: boolean = false;
            for (const member of (<ts.EnumDeclaration>decl).members) {
                if (comma) writeJs(',');
                comma = true;
                const memberName: string = (<ts.Identifier>member.name).text;
                writeJs(`${declName}.${declName}$c_${memberName}`);
            }
            const l$name: string = declName[0].toLowerCase() + declName.substr(1) + '$';
            writeJsLine(`],pa:1,d:['${modname}','${declName}']};};
ex$.${declName}=${declName};
function $init$${declName}(){
    if(${declName}.$$===undefined){
        m$1.initTypeProto(${declName},'${modname}::${declName}',m$1.Basic);
        (function(${l$name}){`);
            for (const member of (<ts.EnumDeclaration>decl).members) {
                const memberName: string = (<ts.Identifier>member.name).text;
                writeJsLine(`            m$1.atr$(${l$name},'${memberName}',function(){return ${declName}$c_${memberName}();},undefined,function(){return{mod:$CCMM$,$t:{t:${declName}},$cont:${declName},pa:1,d:['${modname}','${declName}','$cn','${memberName}']};});`);
            }
            writeJs(`
        })(${declName}.$$.prototype);
    }
    return ${declName};
}
ex$.$init$${declName}=$init$${declName};
$init$${declName}();
`);
            break;
        }
        case ts.SyntaxKind.VariableDeclaration: {
            writeJsLine(`ex$.${declName}=${namespace}${declName};`);
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
