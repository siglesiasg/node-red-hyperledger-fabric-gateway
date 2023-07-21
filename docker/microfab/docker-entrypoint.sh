set -euo pipefail

echo "Starting microfab"
export MICROFAB_CONFIG=$(cat /home/ibp-user/fabric-config.json)
echo ${MICROFAB_CONFIG}

if [ -n "${MICROFAB_CONFIG:-}" ]; then
    COUCHDB_ENABLED=$(echo "${MICROFAB_CONFIG}" | jq -r '. | if has("couchdb") then .couchdb else true end')
    if [ "${COUCHDB_ENABLED}" = "true" ]; then
        echo "Starting couchdb"
        couchdb &
    else 
        echo "Not using couchdb"
    fi
else
    echo "Starting couchdb"
    couchdb &
fi

exec microfabd &
exec /home/ibp-user/install.sh &
sleep infinity








# Package
peer lifecycle chaincode package fabcarcc.tgz --path /home/ibp-user/chaincode-source --lang golang --label fabcar

# Install

export CORE_PEER_LOCALMSPID="noderedtestMSP"
export CORE_PEER_MSPCONFIGPATH="/opt/microfab/data/admin-nodered-test"
export CORE_PEER_ADDRESS="nodered-testpeer-api.127-0-0-1.nip.io:9999"
export FABRIC_CFG_PATH="/opt/microfab/data/peer-nodered-test/config"

peer lifecycle chaincode install fabcarcc.tgz

export CC_PACKAGE_ID=fabcar:39e56729bf6d88a08b40a76fc398eeadd2ffc2110e45b8e59576eed0b8bd4932

peer lifecycle chaincode approveformyorg -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test --name fabcar --version 1 --sequence 1 --waitForEvent --package-id ${CC_PACKAGE_ID}
peer lifecycle chaincode commit -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test --name fabcar --version 1 --sequence 1

peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test -n fabcar -c '{"function":"initLedger","Args":[]}'
peer chaincode query  -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test -n fabcar -c '{"function":"queryAllCars","Args":[]}'