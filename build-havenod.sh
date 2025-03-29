#!/bin/bash

rm -rf haveno || true
W="$PWD"
git clone https://github.com/retoaccess1/haveno-reto/ haveno || true
pushd haveno
    git fetch -a
    git checkout master
    git pull
    make skip-tests
popd
