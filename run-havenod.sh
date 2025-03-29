#!/bin/bash
set -x -e

envoy -c envoy.yaml &
ENVOY_PID=$!

cd haveno
./haveno-daemon \
    --baseCurrencyNetwork=XMR_MAINNET \
    --useLocalhostForP2P=false \
    --useDevPrivilegeKeys=false \
    --nodePort=9999 \
    --appName=Haveno \
    --apiPassword=hunter1 \
    --apiPort=1201 \
    --useNativeXmrWallet=false \
    --ignoreLocalXmrNode=false \
    --maxConnections=5

kill $ENVOY_PID