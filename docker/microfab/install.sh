#!/bin/bash
set -euo pipefail

println() {
  echo -e "$1"
}

verifyResult() {
  if [ $1 -ne 0 ]; then
    println "$2"
    exit $2
  fi
}

createFirstInitFile() {
    println "Creating one time file"
    echo "firstInstallComplete" > started.txt
}

function wait() {
    println "Waiting 10s before building CC: 10"
    COUNT=10
    # bash while loop
    while [ $COUNT -gt 1 ]; do
        let COUNT=COUNT-1
        println "Waiting 10s before building CC: $COUNT"
        sleep 1 
    done
}


checkInstalled() {
    if [ -f "started.txt" ]; then
        println "Already started for first time. Not recreating chaincodes"
        exit 0
    else 
        println "Installing chaincode"
    fi
}

# Start
checkInstalled

wait

export CORE_PEER_LOCALMSPID="noderedtestMSP"
export CORE_PEER_MSPCONFIGPATH="/opt/microfab/data/admin-nodered-test"
export CORE_PEER_ADDRESS="nodered-testpeer-api.127-0-0-1.nip.io:9999"
export FABRIC_CFG_PATH="/opt/microfab/data/peer-nodered-test/config"
export CC_NAME="fabcar"
export CC_VERSION="0.0.0"

println "Package Npm Install"
cd chaincode-source 
npm install
npm run build
cd ..
println "Package Peer"
peer lifecycle chaincode package fabcarcc.tgz --path /home/ibp-user/chaincode-source --lang node --label fabcar >&logPackage.txt
res=$?
{ set +x; } 2>/dev/null
cat logPackage.txt
verifyResult $res "Chaincode packaging has failed"
println "Chaincode is packaged"


println "Install"
peer lifecycle chaincode install fabcarcc.tgz >&logInstall.txt
res=$?
{ set +x; } 2>/dev/null
cat logInstall.txt
verifyResult $res "Chaincode installation has failed"
println "Chaincode is installed"

println "Query Installed"
peer lifecycle chaincode queryinstalled >&logQuery.txt
res=$?
{ set +x; } 2>/dev/null
cat logQuery.txt
PACKAGE_ID=$(sed -n "/${CC_NAME}_${CC_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" logQuery.txt)
verifyResult $res "Query installed has failed"
println "Query installed successful on channel"

string=$(tail -n1 logQuery.txt)
pattern="fabcar:([a-zA-Z0-9]+)"

if [[ $string =~ $pattern ]]; then
  CC_PACKAGE_ID="${BASH_REMATCH[1]}"
  println "Extracted value: $CC_PACKAGE_ID"
else
  println "No match found."
fi

println "Approving"
peer lifecycle chaincode approveformyorg -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test --name ${CC_NAME} --version ${CC_VERSION} --sequence 1 --waitForEvent --package-id ${CC_NAME}:${CC_PACKAGE_ID} >& logApp.txt
res=$?
{ set +x; } 2>/dev/null
cat logApp.txt
verifyResult $res "Chaincode definition approve failed"
println "Chaincode definition approved"

println "Commiting"
peer lifecycle chaincode commit -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test --name ${CC_NAME} --version ${CC_VERSION} --sequence 1 >& logCommit.txt
res=$?
{ set +x; } 2>/dev/null
cat logCommit.txt
verifyResult $res "Chaincode definition commit failed"
println "Chaincode definition commited"

println "Invoke fabcar init"
peer chaincode invoke -o orderer-api.127-0-0-1.nip.io:9999 --channelID nodered-test -n ${CC_NAME} -c '{"function":"InitLedger","Args":[]}'

sleep 5

createFirstInitFile

println "Install Completed"