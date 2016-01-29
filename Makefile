# Jake apparently ignores -C when looking for the Jakefile, so it needs -f
TSJAKE  := jake -C TypeScript -f TypeScript/Jakefile.js
NODE    := node

TSFILES := $(shell jq -r .files[] tsconfig.json)
JSFILES := $(patsubst %.ts,built/%.js,$(TSFILES))

.PHONY: all run clean

all: $(JSFILES)

run: TypeScript/built/local/typescript.js $(JSFILES)
	cat $^ | $(NODE)

$(JSFILES): TypeScript/built/local/tsc.js $(TSFILES)
	$(NODE) $<

TypeScript/built/local/typescript.js TypeScript/built/local/tsc.js:
	$(TSJAKE) local

clean:
	$(RM) $(JSFILES)
	$(TSJAKE) clean
