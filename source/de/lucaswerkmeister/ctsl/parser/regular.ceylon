import ceylon.regular {
    Regular,
    MatchResult,
    not
}
import ceylon.unicode {
    ...
}

object anyUnicodeIdStart extends Regular() {
    shared actual MatchResult? matchAt(Integer start, String s, Integer? maxLength) {
        if (exists maxLength, maxLength < 1) { return null; }
        assert (exists char = s[start]);
        if (generalCategory(char) in { letterUppercase, letterLowercase, letterTitlecase, letterModifier, letterOther, numberLetter }) {
            // note: does not include Other_ID_Start; does not exclude Pattern_Syntax or Pattern_White_Space
            return object satisfies MatchResult {
                matched = char.string;
                length = 1;
            };
        } else {
            return null;
        }
    }
}

object anyUnicodeIdContinue extends Regular() {
    shared actual MatchResult? matchAt(Integer start, String s, Integer? maxLength) {
        if (exists maxLength, maxLength < 1) { return null; }
        assert (exists char = s[start]);
        if (exists startMatch = anyUnicodeIdStart.matchAt(start, s, maxLength)) {
            return startMatch;
        } else if (generalCategory(char) in { markNonspacing, markCombiningSpacing, numberDecimalDigit, punctuationConnector }) {
            // note: does not include Other_ID_Continue; does not exclude Pattern_Syntax or Pattern_White_Space
            return object satisfies MatchResult {
                matched = char.string;
                length = 1;
            };
        } else {
            return null;
        }
    }
}

object anyUnicodeSpaceSeparator extends Regular() {
    shared actual MatchResult? matchAt(Integer start, String s, Integer? maxLength) {
        if (exists maxLength, maxLength < 1) { return null; }
        assert (exists char = s[start]);
        if (generalCategory(char) == separatorSpace) {
            return object satisfies MatchResult {
                matched = char.string;
                length = 1;
            };
        } else {
            return null;
        }
    }
}

object empty extends Regular() {
    shared actual MatchResult? matchAt(Integer start, String s, Integer? maxLength) {
        return object satisfies MatchResult {
            matched = "";
            length = 0;
        };
    }
}

Regular noLineTerminatorHere = not(lineTerminator);
