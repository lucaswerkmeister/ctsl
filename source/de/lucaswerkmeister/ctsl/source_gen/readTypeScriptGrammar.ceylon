import java.lang {
    JString=String
}

void readTypeScriptGrammar({String*} spec, Grammar grammar) {
    value iterator = spec.iterator();
    while (!is Finished line = iterator.next(),
        line != "# <a name=\"A\"/>A Grammar") {
        // skip
    }
    while (!is Finished line = iterator.next()) {
        if (!line.startsWith("&emsp;")) {
            // skip
            continue;
        }
        assert (line.startsWith("&emsp;&emsp;*"),
            line.endsWith(":*  ") || line.endsWith(":*  *( Modified )*  "));
        String name;
        if (line.endsWith(":*  ")) {
            name = line["&emsp;&emsp;*".size .. line.size-":*  ".size-1];
        } else {
            name = line["&emsp;&emsp;*".size .. line.size-":*  *( Modified )*  ".size-1];
        }
        value leftHandSide = LeftHandSide(grammar.nonterminal(name), name in ["Declaration", "UnaryExpression"] then ["Yield"] else []);
        value previousProductions = grammar.productions[leftHandSide];
        grammar.clearProductions(leftHandSide); // we usually override them
        while (!is Finished productionLine = iterator.next(), !productionLine.empty) {
            assert (productionLine.startsWith("&emsp;&emsp;&emsp;"));
            String productionContents = productionLine["&emsp;&emsp;&emsp;".size...];
            if (productionContents == "…  ") {
                assert (exists previousProductions);
                for (previousProduction in previousProductions) {
                    grammar.appendProduction(leftHandSide, previousProduction);
                }
                continue;
            }
            value rightHandSide = RightHandSide();
            grammar.appendProduction(leftHandSide, rightHandSide);
            value productionComponents = JString(productionContents).split("\\&emsp;").iterable.collect((JString? s) => s?.string else "");
            for (component in productionComponents*.trimmed) {
                Boolean optional;
                String requiredComponent;
                if (component.contains("<sub>opt</sub>")) {
                    optional = true;
                    value notOptional = component.replace("<sub>opt</sub>", "");
                    if (notOptional.endsWith("**")) {
                        // left over from e.g. `export`*<sub>opt</sub>* → `export`**
                        requiredComponent = notOptional[... notOptional.size-"**".size-1];
                    } else {
                        requiredComponent = notOptional;
                    }
                } else {
                    optional = false;
                    requiredComponent = component;
                }
                if (requiredComponent == "*[no LineTerminator here]*") {
                    rightHandSide.addElement(noLineTerminatorHere);
                } else if (requiredComponent in { "*NamespaceDeclaration", "AmbientDeclaration", "ImportAliasDeclaration", "ExportNamespaceElement*" }) {
                    // TODO stupid special case: MS has broken formatting
                    rightHandSide.addElement(Atom(grammar.nonterminal(requiredComponent.trim('*'.equals)), [], optional, []));
                } else if (requiredComponent.startsWith("*")) {
                    // nonterminal
                    assert (requiredComponent.startsWith("*"),
                        requiredComponent.endsWith("*"));
                    value nonterminal = grammar.nonterminal(requiredComponent["*".size .. requiredComponent.size-"*".size-1]);
                    assert (nonterminal.name.every(Character.letter));
                    rightHandSide.addElement(Atom(nonterminal, nonterminal.name == "UnaryExpression" then ["?Yield"] else [], optional, []));
                } else {
                    // terminal
                    Terminal terminal;
                    if (requiredComponent == "=") {
                        // TODO super special case: missing backticks in spec
                        terminal = grammar.terminal("=");
                    } else {
                        assert (requiredComponent.startsWith("`"),
                            requiredComponent.endsWith("`"));
                        terminal = grammar.terminal(requiredComponent["`".size .. requiredComponent.size-"`".size-1]);
                    }
                    rightHandSide.addElement(Atom(terminal, [], optional, []));
                }
            }
        }
    }
}
