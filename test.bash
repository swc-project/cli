checkBuild() {
  SOURCE_JS_COUNT=$(find $1 -name "*.ts" -o -name '*.js' | wc -l)
  BUILD_JS_COUNT=$(find $2 -name "*.js" | wc -l)
  echo "Compare $1 to $2"
  if [[ $SOURCE_JS_COUNT -ne $BUILD_JS_COUNT ]]
  then
    echo "File count do not match source count: ${SOURCE_JS_COUNT} to build ${BUILD_JS_COUNT}"
    exit 1
  fi
} 

mkdir -p integration-tests/rxjs
git clone --depth 1 https://github.com/ReactiveX/rxjs.git integration-tests/rxjs

cd integration-tests/rxjs
npm install @swc/core @swc/cli --save-dev
npm install
yarn link @swc/cli

tee .swcrc <<EOF
{
  "jsc": {
      "target": "es2019",
      "parser": {
        "syntax": "typescript",
        "dynamicImport": true
      }
  },
  "module": {
      "type": "commonjs"
  }
}
EOF

echo "Run swc sync"
rm -rf build
yarn swc --sync src -d build
checkBuild "src" "build"

rm -rf build-spec
yarn swc --sync spec -d build-spec
checkBuild "spec" "build-spec"

rm -rf build 

echo "Run swc async"
rm -rf build
yarn swc src -d build
checkBuild "src" "build"

rm -rf build-spec
yarn swc spec -d build-spec
checkBuild "spec" "build-spec"

tee spack.config.js <<EOF
module.exports = {
  entry: {
    web: __dirname + "/src/index.ts",
  },
  output: {
    path: __dirname + "/out",
  },
};
EOF

echo "Run spack"
yarn spack