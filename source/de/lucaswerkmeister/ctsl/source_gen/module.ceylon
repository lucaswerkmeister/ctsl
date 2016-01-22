"Generates source code for CTSL
 by parsing the ECMAScript and TypeScript grammars
 and generating a lexer and parser from them."
native ("jvm") module de.lucaswerkmeister.ctsl.source_gen "1.0.0" {
    import java.base "7";
    import ceylon.file "1.2.1";
    import ceylon.collection "1.2.1";
    import ceylon.ast.core "1.2.1";
    import ceylon.ast.create "1.2.1";
    import ceylon.ast.redhat "1.2.1";
    import ceylon.formatter "1.2.1";
    import ceylon.unicode "1.2.1";
}
