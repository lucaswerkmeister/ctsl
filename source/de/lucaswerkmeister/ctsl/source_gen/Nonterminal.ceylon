class Nonterminal(name) {
    shared String name;
    string => name;
    shared actual Boolean equals(Object that) {
        if (is Nonterminal that) {
            return name == that.name;
        } else {
            return false;
        }
    }
    hash => 31 * name.hash;
}
