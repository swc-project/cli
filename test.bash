checkBuild() {
  SOURCE_JS_COUNT=$(find $1 -name "*.js" | wc -l)
  BUILD_JS_COUNT=$(find $2 -name "*.js" | wc -l)
  echo "Compare $1 to $2"
  if [[ $SOURCE_JS_COUNT -ne $BUILD_JS_COUNT ]]
  then
    echo "File count do not match source count: ${SOURCE_JS_COUNT} to build ${BUILD_JS_COUNT}"
    exit 1
  fi
} 

mkdir -p integration-tests/three.js
git clone --depth 1 https://github.com/mrdoob/three.js.git integration-tests/three.js

cd integration-tests/three.js
npm install @swc/core @swc/cli --save-dev
npm install
yarn link @swc/cli

tee .swcrc <<EOF
{
  "jsc": {
      "target": "es2019",
      "parser": {
        "syntax": "ecmascript",
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

rm -rf build-editor 
yarn swc --sync editor -d ./build-editor/
checkBuild "editor" "build-editor"

echo "Run swc async"
rm -rf build 
yarn swc src -d ./build/
checkBuild "src" "build"

rm -rf build-editor 
yarn swc editor -d ./build-editor/
checkBuild "editor" "build-editor"

tee spack.config.js <<EOF
module.exports = {
  entry: {
    web: __dirname + "/src/Three.js",
  },
  output: {
    path: __dirname + "/out",
  },
};
EOF

echo "Run spack"
yarn spack