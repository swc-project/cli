"use strict";
{
    "name": "swc-cli",
    "version": "0.0.1",
    "description": "CLI for the swc project",
    "main": "index.js",
    "scripts": {
        "test": "jest"
    },
    "repository": {
        "type": "git",
        "url": "git+https://github.com/swc-project/cli.git"
    },
    "keywords": [
        "swc",
        "cli",
        "babel",
        "es6",
        "transpile",
        "transpiler",
        "compiler",
        "javascript"
    ],
    "author": "강동윤 <kdy1@outlook.kr>",
    "license": "MIT",
    "bugs": {
        "url": "https://github.com/swc-project/cli/issues"
    },
    "homepage": "https://github.com/swc-project/cli#readme",
    "peerDependencies": {
        "swc": ">=1.0.0-beta.2"
    },
    "devDependencies": {
        "@types/glob": "^7.1.1",
        "@types/lodash": "^4.14.119",
        "@types/node": "^10.12.18",
        "jest": "^23.6.0",
        "swc": "^1.0.0-beta.2",
        "typescript": "^3.2.2"
    },
    "dependencies": {
        "commander": "^2.19.0",
        "glob": "^7.1.3",
        "loadsh": "^0.0.3"
    }
}
