import ceylon.collection {
    LinkedList
}

RightHandSideElement? parseGrhsAnnot(Grammar grammar, String annot) {
    if (annot == "no <span class=\"nt\">LineTerminator</span> here") {
        return noLineTerminatorHere;
    }
    if (annot.startsWith("lookahead ")) {
        Nonterminal|[[Terminal+]+] excluded;
        if (annot.startsWith("lookahead &ne; ")) {
            // lookahead &ne; x
            variable value text = annot["lookahead &ne; ".size...].trimTrailing(' '.equals);
            if (text == "&lt;LF&gt;") {
                // special case for LineTerminatorSequence
                text = "\{LINE FEED (LF)}";
            }
            excluded = [[grammar.terminal(text)]];
        } else if (annot.startsWith("lookahead &notin; {"),
            // lookahead &notin; { <code class="t">x</code>, <code class="t">y z</code> }
            annot.endsWith("}")) {
            value set = annot["lookahead &notin; {".size .. annot.size-"}".size-1].split(','.equals)*.trimmed;
            excluded = set.collect((String terminals) {
                    assert (terminals.startsWith("<code class=\"t\">"),
                        terminals.endsWith("</code>"));
                    value terminalsContent = terminals["<code class=\"t\">".size .. terminals.size-"</code>".size-1];
                    return [for (terminal in terminalsContent.split()) grammar.terminal(terminal)];
                });
        } else if (annot.startsWith("lookahead &notin; <span class=\"nt\">"),
            // lookahead &notin; <span class="nt">X</span>
            annot.endsWith("</span>")) {
            excluded = grammar.nonterminal(annot["lookahead &notin; <span class=\"nt\">".size .. annot.size-"</span>".size-1]);
        } else {
            throw AssertionError("Unknown lookahead kind ``annot``");
        }
        return NegativeLookahead(excluded);
    }
    if (annot.startsWith("match only if the SV of <span class=\"nt\">Hex4Digits</span> is")) {
        // disregard this
        // TODO we *might* need it… ugh
        return null;
    }
    throw AssertionError("Unknown annotation kind ``annot``");
}

"Parses the ECMAScript specification into three grammars:
 
 1. the syntactic grammar,
 2. the lexical and RegExp grammar, and
 3. the numeric string grammar."
[Grammar, Grammar, Grammar] readECMAScriptGrammar({String*} spec) {
    Grammar colon1 = Grammar();
    Grammar colon2 = Grammar();
    Grammar colon3 = Grammar();
    value iterator = spec.iterator();
    // skip ahead to Annex A, Grammar Summary
    while (!is Finished line = iterator.next(),
        line != "<section id=\"sec-grammar-summary\">") {
    }
    while (true) {
        // skip ahead to next production <div class="gp">
        while (!is Finished line = iterator.next(),
            line != "    <div class=\"gp\">") {
        }
        // skip <div class="gsumxref"> line
        if (!is Finished gsumxrefLine = iterator.next()) {
            assert (gsumxrefLine.startsWith("      <div class=\"gsumxref\">"),
                gsumxrefLine.endsWith("</div>"));
        } else {
            // end of file, done
            break;
        }
        // read <div class="lhs"> line
        assert (!is Finished lhsLine = iterator.next(),
            lhsLine.startsWith("      <div class=\"lhs\"><span class=\"nt\">"));
        if (lhsLine.endsWith(" <span class=\"geq\">:</span> </div>") ||
                    lhsLine.endsWith(" <span class=\"geq\">::</span> </div>") ||
                    lhsLine.endsWith(" <span class=\"geq\">:::</span> </div>")) {
            String lhsNameAndParams; // IIdentifierReference</span> OR dentifierReference</span><sub class="g-params">[Yield]</sub>
            Grammar grammar;
            if (lhsLine.endsWith(" <span class=\"geq\">:</span> </div>")) {
                lhsNameAndParams = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-" <span class=\"geq\">:</span> </div>".size-1];
                grammar = colon1;
            } else if (lhsLine.endsWith(" <span class=\"geq\">::</span> </div>")) {
                lhsNameAndParams = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-" <span class=\"geq\">::</span> </div>".size-1];
                grammar = colon2;
            } else {
                lhsNameAndParams = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-" <span class=\"geq\">:::</span> </div>".size-1];
                grammar = colon3;
            }
            assert (exists ltIndex = lhsNameAndParams.firstOccurrence('<'));
            String lhsName = lhsNameAndParams[... ltIndex-1];
            String lhsParamsWrapper = lhsNameAndParams[ltIndex+"</span>".size ...]; // <sub class="g-params">[Yield]</sub>
            String[] lhsParams;
            if (lhsParamsWrapper.empty) {
                lhsParams = [];
            } else {
                assert (lhsParamsWrapper.startsWith("<sub class=\"g-params\">["),
                    lhsParamsWrapper.endsWith("]</sub>"));
                value lhsParamsContent = lhsParamsWrapper["<sub class=\"g-params\">[".size .. lhsParamsWrapper.size-"]</sub>".size-1];
                lhsParams = lhsParamsContent.split(','.equals)*.trimmed;
            }
            value lhs = LeftHandSide(grammar.nonterminal(lhsName), lhsParams);
            while (!is Finished rhsLine = iterator.next(),
                rhsLine != "    </div>") {
                assert (rhsLine.startsWith("      <div class=\"rhs\">"),
                    rhsLine.endsWith("</div>"));
                variable value rhsContents = rhsLine["      <div class=\"rhs\">".size .. rhsLine.size-"</div>".size-1];
                RightHandSide rhs;
                if (rhsContents.startsWith("<span class=\"grhsannot\">[+") ||
                            rhsContents.startsWith("<span class=\"grhsannot\">[~")) {
                    value withoutOpenSpanAnnot = rhsContents["<span class=\"grhsannot\">[".size...];
                    assert (exists closeBracketIndex = withoutOpenSpanAnnot.firstOccurrence(']'));
                    value annot = withoutOpenSpanAnnot[... closeBracketIndex-1];
                    assert ((annot.startsWith("+") || annot.startsWith("~") && annot.rest.every(Character.letter)));
                    rhs = RightHandSide(annot);
                    rhsContents = withoutOpenSpanAnnot[closeBracketIndex+"]</span>".size ...].trimLeading(' '.equals);
                } else if (rhsContents.startsWith("<span class=\"grhsannot\">[empty]</span>")) {
                    rhs = RightHandSide("empty");
                    rhsContents = rhsContents["<span class=\"grhsannot\">[empty]</span>".size...].trimLeading(' '.equals);
                } else {
                    rhs = RightHandSide();
                }
                while (!rhsContents.empty) {
                    rhsContents = rhsContents.trimLeading(' '.equals);
                    
                    if (rhsContents.startsWith("<span class=\"nt\">") ||
                                rhsContents.startsWith("<code class=\"t\">")) {
                        assert (exists closeIndex = rhsContents.rest.firstOccurrence('<')?.plus(1));
                        Terminal|Nonterminal element;
                        if (rhsContents.startsWith("<span class=\"nt\">")) {
                            // nonterminal
                            value name = rhsContents["<span class=\"nt\">".size .. closeIndex-1];
                            rhsContents = rhsContents[closeIndex+"</span>".size ...].trimLeading(' '.equals);
                            element = grammar.nonterminal(name);
                        } else {
                            // terminal
                            value text = rhsContents["<code class=\"t\">".size .. closeIndex-1];
                            rhsContents = rhsContents[closeIndex+"</code>".size ...].trimLeading(' '.equals);
                            element = grammar.terminal(text);
                        }
                        String[] args;
                        if (rhsContents.startsWith("<sub class=\"g-params\">[")) {
                            value withoutOpenSubParams = rhsContents["<sub class=\"g-params\">[".size...];
                            assert (exists closeBracketIndex = withoutOpenSubParams.firstOccurrence(']'));
                            args = withoutOpenSubParams[... closeBracketIndex-1].split(','.equals)*.trimmed;
                            rhsContents = withoutOpenSubParams[closeBracketIndex+"]</sub>".size ...].trimLeading(' '.equals);
                        } else {
                            args = [];
                        }
                        Boolean optional;
                        if (rhsContents.startsWith("<sub class=\"g-opt\">opt</sub>")) {
                            optional = true;
                            rhsContents = rhsContents["<sub class=\"g-opt\">opt</sub>".size...].trimLeading(' '.equals);
                        } else {
                            optional = false;
                        }
                        <Terminal|Nonterminal>[] excluded;
                        if (rhsContents.startsWith("<span class=\"grhsmod\">but not")) {
                            if (rhsContents.startsWith("<span class=\"grhsmod\">but not</span> ")) {
                                value excludedWrapped = rhsContents["<span class=\"grhsmod\">but not</span> ".size...];
                                if (excludedWrapped.startsWith("<code class=\"t\">")) {
                                    assert (excludedWrapped.endsWith("</code>"));
                                    excluded = [grammar.terminal(excludedWrapped["<code class=\"t\">".size .. excludedWrapped.size-"</code>".size-1])];
                                } else {
                                    assert (excludedWrapped.startsWith("<span class=\"nt\">"),
                                        excludedWrapped.endsWith("</span>"));
                                    excluded = [grammar.nonterminal(excludedWrapped["<span class=\"nt\">".size .. excludedWrapped.size-"</span>".size-1])];
                                }
                                rhsContents = "";
                            } else if (rhsContents.startsWith("<span class=\"grhsmod\">but not one of</span> ")) {
                                variable value excludedsWrapped = rhsContents["<span class=\"grhsmod\">but not one of</span> ".size...];
                                // <span class="grhsmod">but not one of</span> <code class="t">`</code> <span class="grhsmod">or</span> <code class="t">\</code> <span class="grhsmod">or</span> <code class="t">$</code> <span class="grhsmod">or</span> <span class="nt">LineTerminator</span>
                                LinkedList<Terminal|Nonterminal> excludedList = LinkedList<Terminal|Nonterminal>();
                                while (!excludedsWrapped.empty) {
                                    Terminal|Nonterminal excludedElement;
                                    assert (exists excludedCloseIndex = excludedsWrapped.rest.firstOccurrence('<')?.plus(1));
                                    if (excludedsWrapped.startsWith("<span class=\"nt\">")) {
                                        // nonterminal
                                        value name = excludedsWrapped["<span class=\"nt\">".size .. excludedCloseIndex-1];
                                        excludedsWrapped = excludedsWrapped[excludedCloseIndex+"</span>".size ...].trimLeading(' '.equals);
                                        excludedElement = grammar.nonterminal(name);
                                    } else {
                                        // terminal
                                        value text = excludedsWrapped["<code class=\"t\">".size .. excludedCloseIndex-1];
                                        excludedsWrapped = excludedsWrapped[excludedCloseIndex+"</code>".size ...].trimLeading(' '.equals);
                                        excludedElement = grammar.terminal(text);
                                    }
                                    excludedList.add(excludedElement);
                                    if (excludedsWrapped.startsWith("<span class=\"grhsmod\">or</span> ")) {
                                        excludedsWrapped = excludedsWrapped["<span class=\"grhsmod\">or</span> ".size...];
                                    } else {
                                        assert (excludedsWrapped.empty);
                                    }
                                }
                                excluded = excludedList.sequence();
                                rhsContents = "";
                            } else {
                                throw AssertionError("Unknown “but not” kind ``rhsContents``");
                            }
                        } else {
                            excluded = [];
                        }
                        rhs.addElement(Atom(element, args, optional, excluded));
                    } else if (rhsContents.startsWith("&lt;")) {
                        String angleBracketedCharName;
                        if (exists spaceIndex = rhsContents.firstOccurrence(' ')) {
                            value [part1, part2] = rhsContents.slice(spaceIndex);
                            angleBracketedCharName = part1;
                            rhsContents = part2.trimLeading(' '.equals);
                        } else {
                            angleBracketedCharName = rhsContents;
                            rhsContents = "";
                        }
                        assert (angleBracketedCharName.startsWith("&lt;"),
                            angleBracketedCharName.endsWith("&gt;"));
                        switch (charName = angleBracketedCharName["&lt;".size .. angleBracketedCharName.size-"&gt;".size-1])
                        case ("BOM") { rhs.addElement(Atom(Terminal("\{#FEFF}"), [], false, [])); }
                        case ("CR") { rhs.addElement(Atom(Terminal("\{CARRIAGE RETURN (CR)}"), [], false, [])); }
                        case ("FF") { rhs.addElement(Atom(Terminal("\{FORM FEED (FF)}"), [], false, [])); }
                        case ("LF") { rhs.addElement(Atom(Terminal("\{LINE FEED (LF)}"), [], false, [])); }
                        case ("LS") { rhs.addElement(Atom(Terminal("\{LINE SEPARATOR}"), [], false, [])); }
                        case ("NBSP") { rhs.addElement(Atom(Terminal("\{NO-BREAK SPACE}"), [], false, [])); }
                        case ("PS") { rhs.addElement(Atom(Terminal("\{PARAGRAPH SEPARATOR}"), [], false, [])); }
                        case ("SP") { rhs.addElement(Atom(Terminal("\{SPACE}"), [], false, [])); }
                        case ("TAB") { rhs.addElement(Atom(Terminal("\{CHARACTER TABULATION}"), [], false, [])); }
                        case ("VT") { rhs.addElement(Atom(Terminal("\{LINE TABULATION}"), [], false, [])); }
                        case ("ZWJ") { rhs.addElement(Atom(Terminal("\{ZERO WIDTH JOINER}"), [], false, [])); }
                        case ("ZWNBSP") { rhs.addElement(Atom(Terminal("\{ZERO WIDTH NO-BREAK SPACE}"), [], false, [])); }
                        case ("ZWNJ") { rhs.addElement(Atom(Terminal("\{ZERO WIDTH NON-JOINER}"), [], false, [])); }
                        case ("USP") { rhs.addElement(anyUnicodeSpaceSeparator); }
                        else { throw AssertionError("Unknown character name ``charName``"); }
                    } else if (rhsContents.startsWith("<span class=\"gprose\">")) {
                        assert (rhsContents.endsWith("</span>"));
                        value prose = rhsContents["<span class=\"gprose\">".size .. rhsContents.size-"</span>".size-1];
                        "Prose is always last element"
                        assert (!prose.any('<'.equals));
                        switch (prose)
                        case ("any Unicode code point") {
                            rhs.addElement(anyUnicode);
                        }
                        case ("any Unicode code point with the Unicode property &ldquo;ID_Start&rdquo; or &ldquo;Other_ID_Start&rdquo;") {
                            rhs.addElement(anyUnicodeIdStart);
                        }
                        case ("any Unicode code point with the Unicode property &ldquo;ID_Continue&rdquo;, &ldquo;Other_ID_Continue&rdquo;, or &ldquo;Other_ID_Start&rdquo;") {
                            rhs.addElement(anyUnicodeIdContinue);
                        }
                        else {
                            throw AssertionError("Unknown prose ``prose``");
                        }
                        rhsContents = "";
                    } else if (rhsContents.startsWith("<span class=\"grhsannot\">[")) {
                        value withoutOpenSpanAnnot = rhsContents["<span class=\"grhsannot\">[".size...];
                        assert (exists closeBracketIndex = withoutOpenSpanAnnot.firstOccurrence(']'));
                        value annot = withoutOpenSpanAnnot[... closeBracketIndex-1];
                        if (exists parsedAnnot = parseGrhsAnnot(grammar, annot)) {
                            rhs.addElement(parsedAnnot);
                        }
                        rhsContents = withoutOpenSpanAnnot[closeBracketIndex+"]</span>".size ...].trimLeading(' '.equals);
                    } else {
                        throw AssertionError("Cannot parse RHS contents ``rhsContents``");
                    }
                }
                grammar.appendProduction(lhs, rhs);
            }
        } else {
            String lhsName;
            Grammar grammar;
            if (lhsLine.endsWith("</span> <span class=\"geq\">:</span> <span class=\"grhsmod\">one of</span></div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">:</span> <span class=\"grhsmod\">one of</span></div>".size-1];
                grammar = colon1;
            } else if (lhsLine.endsWith("</span> <span class=\"geq\">:</span> <span class=\"grhsmod\">one of</span> </div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">:</span> <span class=\"grhsmod\">one of</span> </div>".size-1];
                grammar = colon1;
            } else if (lhsLine.endsWith("</span> <span class=\"geq\">::</span> <span class=\"grhsmod\">one of</span></div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">::</span> <span class=\"grhsmod\">one of</span></div>".size-1];
                grammar = colon2;
            } else if (lhsLine.endsWith("</span> <span class=\"geq\">::</span> <span class=\"grhsmod\">one of</span> </div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">::</span> <span class=\"grhsmod\">one of</span> </div>".size-1];
                grammar = colon2;
            } else if (lhsLine.endsWith("</span> <span class=\"geq\">:::</span> <span class=\"grhsmod\">one of</span></div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">:::</span> <span class=\"grhsmod\">one of</span></div>".size-1];
                grammar = colon3;
            } else if (lhsLine.endsWith("</span> <span class=\"geq\">:::</span> <span class=\"grhsmod\">one of</span> </div>")) {
                lhsName = lhsLine["      <div class=\"lhs\"><span class=\"nt\">".size .. lhsLine.size-"</span> <span class=\"geq\">:::</span> <span class=\"grhsmod\">one of</span> </div>".size-1];
                grammar = colon3;
            } else {
                throw AssertionError("unknown line end '``lhsLine``'");
            }
            value lhs = LeftHandSide(grammar.nonterminal(lhsName), []);
            // RHS is either lines with multiple terminals or a table
            assert (!is Finished nextLine = iterator.next());
            if (nextLine.startsWith("      <div class=\"rhs\">")) {
                // RHS lines
                void readRhsLine(String line) {
                    variable value terminals = line["      <div class=\"rhs\">".size .. line.size-"</div>".size-1];
                    while (!terminals.empty) {
                        assert (terminals.startsWith("<code class=\"t\">"));
                        value withoutOpenTag = terminals["<code class=\"t\">".size...];
                        assert (exists closeTagIndex = withoutOpenTag.firstOccurrence('<'));
                        value text = withoutOpenTag[... closeTagIndex-1];
                        terminals = withoutOpenTag[closeTagIndex+"</code>".size ...].trimLeading(' '.equals);
                        value rhs = RightHandSide();
                        rhs.addElement(Atom(grammar.terminal(text), [], false, []));
                        grammar.appendProduction(lhs, rhs);
                    }
                }
                readRhsLine(nextLine);
                while (!is Finished rhsLine = iterator.next(),
                    rhsLine.startsWith("      <div class=\"rhs\">")) {
                    readRhsLine(rhsLine);
                }
            } else {
                // table
                assert (nextLine == "    </div>");
                while (!is Finished figureLine = iterator.next(),
                    !figureLine.endsWith("<figure>")) {
                    // skip
                }
                while (!is Finished figureLine = iterator.next(),
                    !figureLine.endsWith("</figure>")) {
                    value trimmed = figureLine.trimLeading(' '.equals);
                    if (trimmed.startsWith("<td><code>"),
                        trimmed.endsWith("</code></td>")) {
                        value text = trimmed["<td><code>".size .. trimmed.size-"</code></td>".size-1];
                        value rhs = RightHandSide();
                        rhs.addElement(Atom(grammar.terminal(text), [], false, []));
                        grammar.appendProduction(lhs, rhs);
                    } else {
                        assert (trimmed in { "<table class=\"lightweight-table\">", "<tr>", "</tr>", "</table>", "<td></td>" });
                    }
                }
            }
        }
    }
    return [colon1, colon2, colon3];
}
