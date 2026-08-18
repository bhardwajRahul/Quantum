#!/bin/bash
echo "@codelines.sh: counting lines of code..."

cloc --exclude-list=scripts/.clocignore .

echo "@codelines.sh: happy hacking."