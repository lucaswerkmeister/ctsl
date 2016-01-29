// model-reading versions of ctsl.ts functions;
// just for stowing away, not meant to be used
// – unless we discover that we need to operate
// on the model instead of the AST
/*
function emitType(type: ts.Type): void {
    console.log(type);
    switch (type.flags) {
    case (ts.TypeFlags.Any): {
        write("dynamic");
        break;
    }
    case (ts.TypeFlags.String): {
        write("String");
        break;
    }
    case (ts.TypeFlags.Number): {
        write("Integer|Float");
        break;
    }
    case (ts.TypeFlags.Boolean): {
        write("Boolean");
        break;
    }
    default: {
        write("/* TODO: unknown type *//* Anything");
        break;
    }
    }
}

function emitDeclaration(decl: ts.Symbol): void {
    switch (decl.flags) {
    case (ts.SymbolFlags.Interface): {
        writeLine("shared dynamic \\I" + decl.name + " {");
        for (let memberName in decl.members) {
            let member = decl.members[memberName];
            emitDeclaration(member);
        }
        writeLine("}");
        break;
    }
    case (ts.SymbolFlags.Property): {
        write("shared formal ");
        emitType(checker.getDeclaredTypeOfSymbol(decl));
        writeLine(" " + decl.name + ";");
        break;
    }
    case (ts.SymbolFlags.Method): {
        write("shared formal ");
        emitType(checker.getDeclaredTypeOfSymbol(decl));
        writeLine(" " + decl.name + "(Anything* args);");
        break;
    }
    default: {
        writeLine("// declaration " + decl.name + " of unknown kind " + decl.flags);
    }
    }
}
*/
