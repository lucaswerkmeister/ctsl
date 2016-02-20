# Jake apparently ignores -C when looking for the Jakefile, so it needs -f
TSJAKE := jake -C TypeScript -f TypeScript/Jakefile.js
NODE   := node

CTSL_TSFILE := ctsl.ts
CTSL_JSFILE := built/ctsl.js

MODULE_NAME       := simple
MODULE_VERSION    := 1.0.0
MODULE_TSFILE     := $(MODULE_NAME).ts
MODULE_JSFILE     := modules/$(MODULE_NAME)/$(MODULE_VERSION)/$(MODULE_NAME)-$(MODULE_VERSION).js
MODULE_MODELFILE  := modules/$(MODULE_NAME)/$(MODULE_VERSION)/$(MODULE_NAME)-$(MODULE_VERSION)-model.js

TESTMODULE_NAME    := simple2
TESTMODULE_VERSION := 1.0.0

.PHONY: all test clean

all: test

TypeScript/built/local/typescript.js TypeScript/built/local/tsc.js:
	$(TSJAKE) local

$(CTSL_JSFILE): TypeScript/built/local/tsc.js $(CTSL_TSFILE)
	$(NODE) $<

$(MODULE_JSFILE) $(MODULE_MODELFILE): TypeScript/built/local/typescript.js $(CTSL_JSFILE) $(MODULE_TSFILE)
	cat TypeScript/built/local/typescript.js $(CTSL_JSFILE) | $(NODE)

%.sha1: %
	printf "%s" "$$(sha1sum $^ | cut -d' ' -f1)" > $@

test: $(MODULE_JSFILE) $(MODULE_JSFILE).sha1 $(MODULE_MODELFILE) $(MODULE_MODELFILE).sha1
	ceylon compile-js,run-js $(TESTMODULE_NAME)

clean:
	$(RM) $(CTSL_JSFILE) $(MODULE_JSFILE) $(MODULE_JSFILE).sha1 $(MODULE_MODELFILE) $(MODULE_MODELFILE).sha1
	$(TSJAKE) clean
