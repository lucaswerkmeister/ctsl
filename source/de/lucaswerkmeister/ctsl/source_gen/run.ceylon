import ceylon.file {
    lines,
    parsePath,
    File
}

shared void run() {
    "The ECMAScript 6.0 specification can be downloaded at
     http://www.ecma-international.org/ecma-262/6.0/"
    assert (is File ecmaScriptSpec = parsePath("index.html").resource);
    "The TypeScript specification can be downloaded at
     https://raw.githubusercontent.com/Microsoft/TypeScript/master/doc/spec.md"
    assert (is File typeScriptSpec = parsePath("spec.md").resource);
    value [grammar1, grammar2, grammar3] = readECMAScriptGrammar(lines(ecmaScriptSpec));
    readTypeScriptGrammar(lines(typeScriptSpec), grammar1);
}
