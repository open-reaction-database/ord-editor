# https://github.com/google/closure-library/releases/
closure = closure-library-20200517

# https://github.com/protocolbuffers/protobuf/releases
protobuf = protobuf-3.13.0

# Check that the present ketcher code is compatible.
ketcher-req = v0.1.0+ord
ketcher-cur = $(shell cd ketcher && git describe --tags)
ifneq ($(ketcher-req), $(ketcher-cur))
  $(error ketcher needs update, see editor readme)
endif

all : prep py js

prep :
	# Ensure output directories exist.
	mkdir -p gen/js/ord gen/js/proto/ord
	# Prevent Closure from compiling test code.
	rm -rf $(protobuf)/js/binary/*test* $(protobuf)/js/*test* $(protobuf)/js/experimental

js : gen/js/proto/ord/dataset.js \
	   gen/js/proto/ord/reaction.js \
	   gen/js/ord/dataset.js \
	   gen/js/ord/reaction.js \

py : ../ord-schema/build/lib/ord_schema/proto/dataset_pb2.py \
	   ../ord-schema/build/lib/ord_schema/proto/reaction_pb2.py

gen/js/ord/dataset.js : js/dataset.js gen/js/proto/ord/dataset.js
	$(closure)/closure/bin/build/closurebuilder.py \
	  --root=$(closure) \
	  --root=$(protobuf)/js \
	  --root=gen/js/proto/ord \
	  --root=js \
	  --namespace=ord.dataset \
	  --output_mode=script \
	  --output_file=gen/js/ord/dataset.js \
	  || (rm -f gen/js/ord/dataset.js && false)

gen/js/ord/reaction.js : js/*.js gen/js/proto/ord/reaction.js
	$(closure)/closure/bin/build/closurebuilder.py \
	  --root=$(closure) \
	  --root=$(protobuf)/js \
	  --root=gen/js/proto/ord \
	  --root=js \
	  --namespace=ord.reaction \
	  --output_mode=script \
	  --output_file=gen/js/ord/reaction.js \
	  || (rm -f gen/js/ord/reaction.js && false)

gen/js/proto/ord/%.js : ../ord-schema/ord_schema/proto/%.proto
	protoc \
	  --experimental_allow_proto3_optional \
	  --js_out=binary:gen/js/proto/ord \
	  --proto_path=../ord-schema \
	  $<

../ord-schema/build/lib/ord_schema/proto/%_pb2.py : ../ord-schema/ord_schema/proto/%.proto
	$(error $< not found--run setup?)

package : all
	rm -rf package
	mkdir -p package/ord

	cp -r \
	  css \
	  gen \
	  html \
	  py \
	  serve.sh \
	  package/ord

	cp -r ../ord-schema/build/lib/ord_schema package/ord/py

	mkdir package/ord/ketcher
	cp -r ketcher/dist package/ord/ketcher

	mkdir package/ord/db

	tar --create --directory=package --gzip --file=package/ord.tgz ord

test : all
	node js/test.js

clean :
	rm -rf gen
