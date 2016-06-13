# Jake apparently ignores -C when looking for the Jakefile, so it needs -f
TSJAKE := jake -C TypeScript -f TypeScript/Jakefile.js
NODE   := node

CTSL_TSFILE := ctsl.ts
CTSL_JSFILE := built/ctsl.js

MODULE_NAME       := tsc
MODULE_VERSION    := 1.0.0
MODULE_TSUNITS    := binder checker commandLineParser core declarationEmitter diagnosticInformationMap.generated emitter parser program scanner sourcemap sys types utilities
MODULE_TSFILES    := $(addsuffix .ts,$(addprefix TypeScript/src/compiler/,$(MODULE_TSUNITS)))
MODULE_JSFILE     := modules/$(MODULE_NAME)/$(MODULE_VERSION)/$(MODULE_NAME)-$(MODULE_VERSION).js
MODULE_MODELFILE  := modules/$(MODULE_NAME)/$(MODULE_VERSION)/$(MODULE_NAME)-$(MODULE_VERSION)-model.js

TESTMODULE_NAME    := simple2
TESTMODULE_VERSION := 1.0.0

.PHONY: all test clean install

all: install

TypeScript/built/local/typescript.js TypeScript/built/local/tsc.js:
	$(TSJAKE) local

$(CTSL_JSFILE): TypeScript/built/local/tsc.js $(CTSL_TSFILE)
	$(NODE) $<

$(MODULE_JSFILE) $(MODULE_MODELFILE): TypeScript/built/local/typescript.js $(CTSL_JSFILE) $(MODULE_TSFILES)
	cat TypeScript/built/local/typescript.js $(CTSL_JSFILE) | $(NODE)

%.sha1: %
	printf "%s" "$$(sha1sum $^ | cut -d' ' -f1)" > $@

test: $(MODULE_JSFILE) $(MODULE_JSFILE).sha1 $(MODULE_MODELFILE) $(MODULE_MODELFILE).sha1
	ceylon compile-js,test-js $(TESTMODULE_NAME)

clean:
	$(RM) $(CTSL_JSFILE) $(MODULE_JSFILE) $(MODULE_JSFILE).sha1 $(MODULE_MODELFILE) $(MODULE_MODELFILE).sha1
	$(TSJAKE) clean

install: $(MODULE_JSFILE) $(MODULE_MODELFILE) $(MODULE_JSFILE).sha1 $(MODULE_MODELFILE).sha1
	mkdir -p ~/.ceylon/repo/$(MODULE_NAME)/$(MODULE_VERSION)
	cp -r $^ ~/.ceylon/repo/$(MODULE_NAME)/$(MODULE_VERSION)
