#!/usr/bin/env bash

set -eu

# (cd ~/projects/kdy1-swc && npx neon build && npx tsc -d) 

# npm link @swc/core

npx tsc -d

(cd ./examples/spack-config-js && npx spack)