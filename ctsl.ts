/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

const program : ts.Program = ts.createProgram(["simple.ts"], {});
const sourceFiles : ts.SourceFile[] = program.getSourceFiles();
const sourceFile : ts.SourceFile = sourceFiles[sourceFiles.length - 1];
const checker : ts.TypeChecker = program.getTypeChecker();
const fd_ceylon : number = fs.openSync("simple.ceylon", "w");
const fd_js : number = fs.openSync("simple.js", "w");

function write(fd: number, text: string): void {
    (<any>fs).writeSync(fd, text); // the DefinitelyTyped file is missing most of the writeSync overloads, so remove type info
}

function writeCeylon(text: string = ""): void {
    write(fd_ceylon, text);
}

function writeCeylonLine(line: string = ""): void {
    writeCeylon(line + "\n");
}

function writeJs(text: string = ""): void {
    write(fd_js, text);
}

function writeJsLine(line: string = ""): void {
    writeJs(line + "\n");
}

// TODO force case
function emitName(name: ts.EntityName | ts.DeclarationName): void {
    writeCeylon(" ");
    switch (name.kind) {
    case (ts.SyntaxKind.Identifier): {
        writeCeylon((<ts.Identifier>name).text);
        break;
    }
    case (ts.SyntaxKind.StringLiteral): {
        writeCeylon((<ts.StringLiteral>name).text);
        break;
    }
    case (ts.SyntaxKind.QualifiedName): {
        const qn = <ts.QualifiedName>name;
        emitName(qn.left);
        writeCeylon(".");
        emitName(qn.right);
        break;
    }
    default: {
        writeCeylon("/* TODO: unknown name kind " + name.kind + " */ Anything");
        break;
    }
    }
    writeCeylon(" ");
}

function emitType(type: ts.TypeNode): void {
    writeCeylon(" ");
    switch (type.kind) {
    case (ts.SyntaxKind.AnyKeyword): {
        writeCeylon("dynamic");
        break;
    }
    case (ts.SyntaxKind.StringKeyword): {
        writeCeylon("String");
        break;
    }
    case (ts.SyntaxKind.NumberKeyword): {
        writeCeylon("Integer|Float");
        break;
    }
    case (ts.SyntaxKind.BooleanKeyword): {
        writeCeylon("Boolean");
        break;
    }
    case (ts.SyntaxKind.VoidKeyword): {
        writeCeylon("void");
        break;
    }
    case (ts.SyntaxKind.TypeReference): {
        const tr = <ts.TypeReferenceNode>type;
        if ((<ts.Identifier>tr.typeName).text === "Function") {
            // special case: global Function type for any function
            writeCeylon("Nothing(Anything*)");
            break;
        }
        emitName(tr.typeName);
        const tas = tr.typeArguments;
        if (tas) {
            writeCeylon("<");
            let needComma: boolean = false;
            for (const ta of tas) {
                if (needComma) writeCeylon(",");
                emitType(ta);
                needComma = true;
            }
            writeCeylon(">");
        }
        break;
    }
    default: {
        writeCeylon("/* TODO: unknown type kind " + type.kind + " */ Anything");
        break;
    }
    }
    writeCeylon(" ");
}

function emitSignature(decl: ts.SignatureDeclaration): void {
    if (decl.type)
        emitType(decl.type);
    if (decl.name)
        emitName(decl.name);
    // TODO type parameters
    writeCeylon("(");
    let needComma: boolean = false
    for (const parameter of decl.parameters) {
        if (needComma) writeCeylon(", ");
        emitType(parameter.type);
        emitName(parameter.name);
        // TODO other stuff
        needComma = true;
    }
    writeCeylon(")");
}

function emitDeclaration(decl: ts.Declaration): void {
    switch (decl.kind) {
    case (ts.SyntaxKind.InterfaceDeclaration): {
        const idecl = <ts.InterfaceDeclaration>decl;
        writeCeylon("shared dynamic");
        emitName(idecl.name);
        writeCeylonLine("{");
        for (const memberName in idecl.members) {
            const member = idecl.members[memberName];
            if (typeof member === "number") continue; // pos, end; TODO what happens if members are actually called that?
            emitDeclaration(member);
        }
        writeCeylonLine("}");
        break;
    }
    case (ts.SyntaxKind.ClassDeclaration): {
        const cdecl = <ts.ClassDeclaration>decl;
        writeCeylon("shared class");
        emitName(cdecl.name);
        writeCeylonLine("{");
        for (const memberName in cdecl.members) {
            const member = cdecl.members[memberName];
            if (typeof member === "number") continue; // pos, end; TODO what happens if members are actually called that?
            emitDeclaration(member);
        }
        writeCeylonLine("}");
        break;
    }
    case (ts.SyntaxKind.PropertySignature):
    case (ts.SyntaxKind.PropertyDeclaration): {
        const pdecl = <ts.PropertySignature|ts.PropertyDeclaration>decl;
        writeCeylon("shared formal ");
        emitType(pdecl.type);
        emitName(pdecl.name);
        writeCeylonLine(";");
        break;
    }
    case (ts.SyntaxKind.MethodSignature):
    case (ts.SyntaxKind.MethodDeclaration): {
        const mdecl = <ts.MethodSignature|ts.MethodDeclaration>decl;
        writeCeylon("shared formal ");
        emitSignature(mdecl);
        writeCeylonLine(";");
        break;
    }
    case (ts.SyntaxKind.Constructor): {
        const cdecl = <ts.ConstructorDeclaration>decl;
        writeCeylon("shared new ");
        emitSignature(cdecl);
        writeCeylonLine("{}");
        break;
    }
    default: {
        writeCeylonLine("/* TODO: unknown declaration kind " + decl.kind + " */");
    }
    }
}

for (const declName in sourceFile.locals) {
    const decl = sourceFile.locals[declName];
    emitDeclaration(decl.declarations[0]);
}

program.emit(sourceFile, function(fileName: string, data: string, writeByteOrderMark: boolean, onError: (message: string) => void): void {
    writeJs(data);
});
