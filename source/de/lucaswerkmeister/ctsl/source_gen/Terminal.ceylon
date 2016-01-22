class Terminal(text) {
    shared String text;
    string => "`" + text + "`";
    shared actual Boolean equals(Object that) {
        if (is Terminal that) {
            return text == that.text;
        } else {
            return false;
        }
    }
    hash => 31 * text.hash;
}
