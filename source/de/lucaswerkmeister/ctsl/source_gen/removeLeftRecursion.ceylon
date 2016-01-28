"Removes left recursion by rewriting a rule like
 
     X ::
         a X i
         b X j
         X m X p
         X n X q
 
 to a set of rules like
 
     X ::
         X_nlr X_lr_star
     
     X_nlr ::
         a X i
         b X j
     
     X_lr ::
         m X p
         n X q
     
     X_lr_star ::
         empty
         X_lr X_lr_star
 
 which are equivalent, but no longer left recursive."
Anything removeLeftRecursion() {
    //TODO: return type, parameters, implement, use
    return null;
}
