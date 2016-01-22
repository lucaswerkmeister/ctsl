abstract class RightHandSideElement()
        of Atom | NegativeLookahead | noLineTerminatorHere | anyUnicode | anyUnicodeIdContinue | anyUnicodeIdStart | anyUnicodeSpaceSeparator {}

class Atom(element, arguments, optional, excluded) extends RightHandSideElement() {
    shared Terminal|Nonterminal element;
    shared String[] arguments; // TODO arguments can start with ? – parse that
    shared Boolean optional;
    shared <Terminal|Nonterminal>[] excluded;
    string => element.string + (arguments nonempty then "[``", ".join(arguments)``]" else "") + (optional then "?" else "");
}

class NegativeLookahead(excluded) extends RightHandSideElement() {
    shared Nonterminal|[[Terminal+]+] excluded;
    string => "[lookahead ∉ ``excluded``]";
}

object noLineTerminatorHere extends RightHandSideElement() {
    string => "[no LineTerminator here]";
}

object anyUnicode extends RightHandSideElement() {
    string => "any Unicode code point";
}

object anyUnicodeIdStart extends RightHandSideElement() {
    string => "any Unicode code point with the Unicode property “ID_Start” or “Other_ID_Start”";
}

object anyUnicodeIdContinue extends RightHandSideElement() {
    string => "any Unicode code point with the Unicode property “ID_Continue”, “Other_ID_Continue”, or “Other_ID_Start”";
}

object anyUnicodeSpaceSeparator extends RightHandSideElement() {
    string => "Any other Unicode “Separator, space” code point";
}
