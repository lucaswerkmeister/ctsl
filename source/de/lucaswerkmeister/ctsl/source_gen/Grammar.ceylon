import ceylon.collection {
    HashMap,
    LinkedList
}

class Grammar() {
    
    HashMap<String,Nonterminal> nonterminalRegistry = HashMap<String,Nonterminal>();
    HashMap<String,Terminal> terminalRegistry = HashMap<String,Terminal>();
    HashMap<LeftHandSide,LinkedList<RightHandSide>> productionRegistry = HashMap<LeftHandSide,LinkedList<RightHandSide>>();
    
    shared {Nonterminal*} nonterminals => nonterminalRegistry.items;
    shared {Terminal*} terminals => terminalRegistry.items;
    shared Map<LeftHandSide,{RightHandSide*}> productions => productionRegistry;
    
    shared Nonterminal nonterminal(String name) {
        if (exists nonterminal = nonterminalRegistry[name]) {
            return nonterminal;
        } else {
            value nonterminal = Nonterminal(name);
            nonterminalRegistry.put(name, nonterminal);
            return nonterminal;
        }
    }
    shared Terminal terminal(String text) {
        if (exists terminal = terminalRegistry[text]) {
            return terminal;
        } else {
            value terminal = Terminal(text);
            terminalRegistry.put(text, terminal);
            return terminal;
        }
    }
    shared void appendProduction(LeftHandSide leftHandSide, RightHandSide rightHandSide) {
        if (exists rightHandSides = productionRegistry[leftHandSide]) {
            rightHandSides.add(rightHandSide);
        } else {
            value rightHandSides = LinkedList<RightHandSide> { rightHandSide };
            productionRegistry.put(leftHandSide, rightHandSides);
        }
    }
    shared void clearProductions(LeftHandSide leftHandSide) {
        productionRegistry.remove(leftHandSide);
    }
    string => "\n\n".join { for (lhs->rhss in productions) "\n".join { lhs, for (rhs in rhss) "    " + rhs.string } };
}
