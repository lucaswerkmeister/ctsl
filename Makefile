TSGULP := gulp --cwd TypeScript
NODE   := node

CTSL_TSFILE := ctsl.ts
CTSL_JSFILE := built/ctsl.js
CTSL_STANDALONEFILE := ctsl.js

TSC_MODULE_NAME       := tsc
TSC_MODULE_VERSION    := 1.0.0
TSC_MODULE_TSUNITS    := binder checker commandLineParser core declarationEmitter diagnosticInformationMap.generated emitter parser program scanner sourcemap sys types utilities
TSC_MODULE_TSFILES    := $(addsuffix .ts,$(addprefix TypeScript/src/compiler/,$(MODULE_TSUNITS)))
TSC_MODULE_JSFILE     := modules/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)/$(TSC_MODULE_NAME)-$(TSC_MODULE_VERSION).js
TSC_MODULE_MODELFILE  := modules/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)/$(TSC_MODULE_NAME)-$(TSC_MODULE_VERSION)-model.js

TEST_MODULE_NAME       := simple
TEST_MODULE_VERSION    := 1.0.0
TEST_MODULE_TSFILES    := simple.ts
TEST_MODULE_JSFILE     := modules/$(TEST_MODULE_NAME)/$(TEST_MODULE_VERSION)/$(TEST_MODULE_NAME)-$(TEST_MODULE_VERSION).js
TEST_MODULE_MODELFILE  := modules/$(TEST_MODULE_NAME)/$(TEST_MODULE_VERSION)/$(TEST_MODULE_NAME)-$(TEST_MODULE_VERSION)-model.js
TEST_CMODULE_NAME      := simple2

.PHONY: all test clean install

all: install

TypeScript/built/local/typescript.js TypeScript/built/local/tsc.js:
	$(TSGULP) tsc

$(CTSL_JSFILE): TypeScript/built/local/tsc.js $(CTSL_TSFILE)
	$(NODE) $<

$(CTSL_STANDALONEFILE): TypeScript/built/local/typescript.js $(CTSL_JSFILE)
	cat $^ >| $@

$(TSC_MODULE_JSFILE) $(TSC_MODULE_MODELFILE): $(CTSL_STANDALONEFILE) $(TSC_MODULE_TSFILES)
	$(NODE) $< $(TSC_MODULE_NAME) $(TSC_MODULE_VERSION) $(TSC_MODULE_TSFILES)

$(TEST_MODULE_JSFILE) $(TEST_MODULE_MODELFILE): $(CTSL_STANDALONEFILE) $(TEST_MODULE_TSFILES)
	$(NODE) $< $(TEST_MODULE_NAME) $(TEST_MODULE_VERSION) $(TEST_MODULE_TSFILES)

%.sha1: %
	printf "%s" "$$(sha1sum $^ | cut -d' ' -f1)" > $@

test: $(TEST_MODULE_JSFILE) $(TEST_MODULE_MODELFILE) $(TEST_MODULE_JSFILE).sha1 $(TEST_MODULE_MODELFILE).sha1
	ceylon compile-js,test-js $(TEST_CMODULE_NAME)

clean:
	$(RM) $(CTSL_JSFILE) $(TSC_MODULE_JSFILE) $(TSC_MODULE_JSFILE).sha1 $(TSC_MODULE_MODELFILE) $(TSC_MODULE_MODELFILE).sha1 $(TEST_MODULE_JSFILE) $(TEST_MODULE_MODELFILE) $(TEST_MODULE_JSFILE).sha1 $(TEST_MODULE_MODELFILE).sha1
	$(TSGULP) clean

install: $(TSC_MODULE_JSFILE) $(TSC_MODULE_MODELFILE) $(TSC_MODULE_JSFILE).sha1 $(TSC_MODULE_MODELFILE).sha1 TypeScript/lib/lib.es5.d.ts
	mkdir -p ~/.ceylon/repo/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)
	cp -r $^ ~/.ceylon/repo/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)
	mv ~/.ceylon/repo/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)/lib.es5.d.ts ~/.ceylon/repo/$(TSC_MODULE_NAME)/$(TSC_MODULE_VERSION)/lib.d.ts
