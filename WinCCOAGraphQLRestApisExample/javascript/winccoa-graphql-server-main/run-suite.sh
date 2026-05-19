if [ -z "$1" ]; then
  node tests/run-all.js
else
  node tests/run-all.js --suite "$1"
fi
