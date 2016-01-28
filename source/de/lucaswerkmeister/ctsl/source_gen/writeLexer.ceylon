import ceylon.file {
    Writer
}
import ceylon.formatter {
    format
}
import ceylon.ast.core {
    ...
}
import ceylon.ast.create {
    ...
}
import ceylon.ast.redhat {
    RedHatTransformer,
    SimpleTokenFactory
}
import de.lucaswerkmeister.ctsl.source_gen {
    Atom // override ceylon.ast import
}
import ceylon.unicode {
    ...
}

String initialLowercase(String name) {
    if (exists first = name.first) {
        return first.lowercased.string + name.rest;
    } else {
        return name;
    }
}

LIdentifier llidentifier(String name)
        => lidentifier(initialLowercase(name));

[[Element*]+] powerSet<Element>({Element*} set) {
    if (exists element = set.first) {
        value powRest = powerSet(set.rest);
        return powRest.append(powRest*.withLeading(element));
    } else {
        return [[]];
    }
}

Invocation terminalMatcher(Terminal terminal) {
    value text = terminal.text
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&");
    StringBuilder sb = StringBuilder();
    for (char in text) {
        if (char in 'a'..'z' || char in 'A'..'Z' || char in '0'..'9' || char in "{}()[].;,<>=!+-*%/&|^~?:$_ ") {
            // safe characters, insert directly
            sb.appendCharacter(char);
        } else {
            // escape these characters
            switch (char)
            case ('\b') { sb.append("""\b"""); }
            case ('\t') { sb.append("""\t"""); }
            case ('\n') { sb.append("""\n"""); }
            case ('\f') { sb.append("""\f"""); }
            case ('\r') { sb.append("""\r"""); }
            case ('\e') { sb.append("""\e"""); }
            case ('\\') { sb.append("""\\"""); }
            case ('\`') { sb.append("""\`"""); }
            case ('\'') { sb.append("""\'"""); }
            case ('\"') { sb.append("""\""""); }
            case ('\0') { sb.append("""\0"""); }
            else {
                // unicode name escape
                sb.append("\\{``characterName(char)``}");
                // alternatively: unicode codepoint escape
                //sb.append("\\{#``formatInteger { integer = char.integer; radix = 16; }.padLeading { size = 6; character = '0'; }``}");
            }
        }
    }
    return invocation { "lit"; StringLiteral { sb.string; isVerbatim = false; } };
}

void writeLexer(Grammar grammar, Writer writer) {
    
    value sharedAnnotations = annotations { "shared" };
    value regularType = baseType("Regular");
    
    format {
        node = CompilationUnit {
            imports = [Import(FullPackageName([lidentifier("ceylon"), lidentifier("regular")]), ImportElements([], ImportWildcard()))];
            declarations = concatenate(*concatenate(
                    for (lhs->rhss in grammar.productions)
                        for (parameters in powerSet(lhs.parameters))
                            let (name = initialLowercase(lhs.nonterminal.name) + (parameters.empty then "" else "_".join { "", *parameters }),
                                usedRhss = rhss.filter {
                                    // filter out +X or ~X annotated RHSs when the parameters don’t match
                                    Boolean selecting(RightHandSide rhs) {
                                        if (exists annotation = rhs.annotation) {
                                            if (annotation == "empty") {
                                                return true;
                                            }
                                            if (annotation.startsWith("+")) {
                                                return annotation[1...] in parameters;
                                            }
                                            if (annotation.startsWith("~")) {
                                                return !annotation[1...] in parameters;
                                            }
                                            throw AssertionError("Unknown rhs annotation ``annotation``");
                                        } else {
                                            return true;
                                        }
                                    }
                                })
                                {
                                    {
                                        ValueDefinition {
                                            name = lidentifier(name);
                                            type = regularType;
                                            definition = Specifier(invocation {
                                                    invoked = "lazy";
                                                    FunctionExpression {
                                                        parameterLists = [Parameters()];
                                                        value definition {
                                                            variable Primary expr = baseExpression(name + "_0");
                                                            for (i in 1 : usedRhss.size-1) {
                                                                expr = invocation { qualifiedExpression(expr, "or"); baseExpression(name + "_" + i.string) };
                                                            }
                                                            return LazySpecifier(expr);
                                                        }
                                                    }
                                                });
                                            annotations = sharedAnnotations;
                                        }
                                    },
                                    for (rhsI->rhs in usedRhss.indexed)
                                        {
                                            ValueDefinition {
                                                name = lidentifier(name + "_" + rhsI.string);
                                                type = regularType;
                                                value definition {
                                                    if (exists annotation = rhs.annotation, annotation == "empty") {
                                                        return Specifier(baseExpression("empty"));
                                                    }
                                                    variable Primary expr = baseExpression(name + "_" + rhsI.string + "_0");
                                                    for (i in 1 : rhs.elements.size-1) {
                                                        expr = invocation { qualifiedExpression(expr, "plus"); baseExpression(name + "_" + rhsI.string + "_" + i.string) };
                                                    }
                                                    return Specifier(expr);
                                                }
                                            },
                                            for (elemI->elem in rhs.elements.indexed)
                                                ValueDefinition {
                                                    name = lidentifier(name + "_" + rhsI.string + "_" + elemI.string);
                                                    type = regularType;
                                                    definition = Specifier {
                                                        value expression {
                                                            switch (elem)
                                                            case (is Atom) {
                                                                Primary baseMatcher;
                                                                switch (element = elem.element)
                                                                case (is Terminal) {
                                                                    assert (elem.arguments.empty);
                                                                    baseMatcher = terminalMatcher(element);
                                                                }
                                                                case (is Nonterminal) {
                                                                    String[] arguments = elem.arguments.map {
                                                                        function collecting(String argument) {
                                                                            if (argument.startsWith("?")) {
                                                                                value arg = argument[1...];
                                                                                if (arg in parameters) {
                                                                                    return arg;
                                                                                } else {
                                                                                    return null;
                                                                                }
                                                                            } else {
                                                                                return argument;
                                                                            }
                                                                        }
                                                                    }.coalesced.sequence();
                                                                    baseMatcher = baseExpression("_".join { initialLowercase(element.name), *arguments });
                                                                }
                                                                Primary optMatcher;
                                                                if (elem.optional) {
                                                                    optMatcher = qualifiedExpression(baseMatcher, "maybe");
                                                                } else {
                                                                    optMatcher = baseMatcher;
                                                                }
                                                                variable Primary matcher = optMatcher;
                                                                for (excluded in elem.excluded) {
                                                                    Primary unmatcher;
                                                                    switch (excluded)
                                                                    case (is Terminal) {
                                                                        assert (elem.arguments.empty);
                                                                        unmatcher = terminalMatcher(excluded);
                                                                    }
                                                                    case (is Nonterminal) {
                                                                        String[] arguments = elem.arguments.map {
                                                                            function collecting(String argument) {
                                                                                if (argument.startsWith("?")) {
                                                                                    value arg = argument[1...];
                                                                                    if (arg in parameters) {
                                                                                        return arg;
                                                                                    } else {
                                                                                        return null;
                                                                                    }
                                                                                } else {
                                                                                    return argument;
                                                                                }
                                                                            }
                                                                        }.coalesced.sequence();
                                                                        unmatcher = baseExpression("_".join { initialLowercase(excluded.name), *arguments });
                                                                    }
                                                                    matcher = invocation { qualifiedExpression { invocation { baseExpression("not"); unmatcher }; "and"; }; matcher };
                                                                }
                                                                return matcher;
                                                            }
                                                            case (is NegativeLookahead) {
                                                                switch (excluded = elem.excluded)
                                                                case (is Nonterminal) {
                                                                    return invocation { "not"; baseExpression(llidentifier(excluded.name)) };
                                                                }
                                                                else {
                                                                    function seq([Terminal+] terminals) {
                                                                        variable Primary expr = terminalMatcher(terminals.first);
                                                                        for (terminal in terminals.rest) {
                                                                            expr = invocation { qualifiedExpression(expr, "plus"); terminalMatcher(terminal) };
                                                                        }
                                                                        return expr;
                                                                    }
                                                                    function choice([[Terminal+]+] terminalses) {
                                                                        variable Primary expr = seq(terminalses.first);
                                                                        for (terminals in terminalses.rest) {
                                                                            expr = invocation { qualifiedExpression(expr, "or"); seq(terminals) };
                                                                        }
                                                                        return expr;
                                                                    }
                                                                    return invocation { "not"; choice(excluded) };
                                                                }
                                                            }
                                                            case (noLineTerminatorHere) {
                                                                return baseExpression("noLineTerminatorHere");
                                                            }
                                                            case (anyUnicode) {
                                                                return baseExpression("anyChar");
                                                            }
                                                            case (anyUnicodeIdStart) {
                                                                return baseExpression("anyUnicodeIdStart");
                                                            }
                                                            case (anyUnicodeIdContinue) {
                                                                return baseExpression("anyUnicodeIdContinue");
                                                            }
                                                            case (anyUnicodeSpaceSeparator) {
                                                                return baseExpression("anyUnicodeSpaceSeparator");
                                                            }
                                                        }
                                                    };
                                                }
                                        }
                                }
                )).sequence();
        }.transform(RedHatTransformer(SimpleTokenFactory()));
        output = writer;
    };
}
