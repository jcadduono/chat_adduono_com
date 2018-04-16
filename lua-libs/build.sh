#!/bin/bash
for i in */ ; do
  cd $i
  make clean
  make
  make install
  make clean
  cd ..
done
echo "Done."