class LeftHandSide(nonterminal, parameters) {
    shared Nonterminal nonterminal;
    shared String[] parameters;
    shared actual Boolean equals(Object that) {
        if (is LeftHandSide that) {
            return nonterminal==that.nonterminal &&
                    parameters==that.parameters;
        } else {
            return false;
        }
    }
    hash => 31 * (nonterminal.hash + 31*parameters.hash);
    string => parameters.empty then nonterminal.string else "``nonterminal.string``[``", ".join(parameters)``]";
}
