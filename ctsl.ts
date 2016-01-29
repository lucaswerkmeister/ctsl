/// <reference path="DefinitelyTyped/node/node.d.ts" />
/// <reference path="TypeScript/src/compiler/program.ts" />
/// <reference path="TypeScript/src/compiler/parser.ts" />
/// <reference path="TypeScript/src/compiler/types.ts" />

import * as fs from "fs";

let program : ts.Program = ts.createProgram(["DefinitelyTyped/acc-wizard/acc-wizard.d.ts"], {});
let sourceFiles : ts.SourceFile[] = program.getSourceFiles();
let sourceFile : ts.SourceFile = sourceFiles[sourceFiles.length - 1];
let checker : ts.TypeChecker = program.getTypeChecker();
let fd : number = fs.openSync("acc-wizard.ceylon", "w");

function write(text: string = ""): void {
    (<any>fs).writeSync(fd, text); // the DefinitelyTyped file is missing most of the writeSync overloads, so remove type info
}

function writeLine(line: string = ""): void {
    write(line + "\n");
}

// TODO force case
function emitName(name: ts.EntityName | ts.DeclarationName): void {
    write(" ");
    switch (name.kind) {
    case (ts.SyntaxKind.Identifier): {
        write((<ts.Identifier>name).text);
        break;
    }
    case (ts.SyntaxKind.StringLiteral): {
        write((<ts.StringLiteral>name).text);
        break;
    }
    case (ts.SyntaxKind.QualifiedName): {
        let qn = <ts.QualifiedName>name;
        emitName(qn.left);
        write(".");
        emitName(qn.right);
        break;
    }
    default: {
        write("/* TODO: unknown name kind " + name.kind + " */ Anything");
        break;
    }
    }
    write(" ");
}

function emitType(type: ts.TypeNode): void {
    write(" ");
    switch (type.kind) {
    case (ts.SyntaxKind.AnyKeyword): {
        write("dynamic");
        break;
    }
    case (ts.SyntaxKind.StringKeyword): {
        write("String");
        break;
    }
    case (ts.SyntaxKind.NumberKeyword): {
        write("Integer|Float");
        break;
    }
    case (ts.SyntaxKind.BooleanKeyword): {
        write("Boolean");
        break;
    }
    case (ts.SyntaxKind.VoidKeyword): {
        write("void");
        break;
    }
    case (ts.SyntaxKind.TypeReference): {
        let tr = <ts.TypeReferenceNode>type;
        if ((<ts.Identifier>tr.typeName).text === "Function") {
            // special case: global Function type for any function
            write("Nothing(Anything*)");
            break;
        }
        emitName(tr.typeName);
        let tas = tr.typeArguments;
        if (tas) {
            write("<");
            let needComma: boolean = false;
            for (let ta of tas) {
                if (needComma) write(",");
                emitType(ta);
                needComma = true;
            }
            write(">");
        }
        break;
    }
    default: {
        write("/* TODO: unknown type kind " + type.kind + " */ Anything");
        break;
    }
    }
    write(" ");
}

function emitSignature(decl: ts.SignatureDeclaration): void {
    emitType(decl.type);
    emitName(decl.name);
    // TODO type parameters
    write("(");
    let needComma: boolean = false
    for (let parameter of decl.parameters) {
        if (needComma) write(", ");
        emitType(parameter.type);
        emitName(parameter.name);
        // TODO other stuff
        needComma = true;
    }
    write(")");
}

function emitDeclaration(decl: ts.Declaration): void {
    switch (decl.kind) {
    case (ts.SyntaxKind.InterfaceDeclaration): {
        let idecl = <ts.InterfaceDeclaration>decl;
        write("shared dynamic");
        emitName(idecl.name);
        writeLine("{");
        for (let memberName in idecl.members) {
            let member = idecl.members[memberName];
            if (typeof member === "number") continue; // pos, end; TODO what happens if members are actually called that?
            emitDeclaration(member);
        }
        writeLine("}");
        break;
    }
    case (ts.SyntaxKind.PropertySignature): {
        let pdecl = <ts.PropertySignature>decl;
        write("shared formal ");
        emitType(pdecl.type);
        emitName(pdecl.name);
        writeLine(";");
        break;
    }
    case (ts.SyntaxKind.MethodSignature): {
        let mdecl = <ts.MethodSignature>decl;
        write("shared formal ");
        emitSignature(mdecl);
        writeLine(";");
        break;
    }
    default: {
        writeLine("/* TODO: unknown declaration kind " + decl.kind + " */");
    }
    }
}

for (let declName in sourceFile.locals) {
    let decl = sourceFile.locals[declName];
    emitDeclaration(decl.declarations[0]);
}
