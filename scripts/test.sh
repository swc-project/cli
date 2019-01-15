#!/bin/bash

set -e

tsc

./bin/swc.js src/ -d out 
