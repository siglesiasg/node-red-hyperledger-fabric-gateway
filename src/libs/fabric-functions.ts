import * as grpc from '@grpc/grpc-js';
import { connect, ConnectOptions, Gateway, GrpcClient, Identity, ProposalOptions, Signer, signers } from '@hyperledger/fabric-gateway';
import { Buffer } from 'buffer';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import { Node, NodeAPI, NodeMessageInFlow } from 'node-red';
import { ConnectionConfigModel } from 'src/models/connection-config.model';
import { ChaincodeNodeDef } from 'src/nodes/chaincode-config-node.def';
import { FabricChannelDef } from 'src/nodes/config/fabric-channel.def';
import { closeGateway, getGateway } from './fabric-connection-pool';
import { FabricDecoderType } from './fabric-decoder';
import { addResultToPayload, getConfigValidate } from './node-red-utils';

export async function newGrpcConnection(connectionConfig: ConnectionConfigModel): Promise<GrpcClient> {

    // const tlsRootCert = await fs.readFile(tlsCertPath);
    // const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    const tlsCredentials = grpc.credentials.createInsecure();
    return new grpc.Client(connectionConfig.gateway.peer.url, tlsCredentials, connectionConfig.gateway.peer.grpcOptions as any);
}

export async function newIdentity(connectionConfig: ConnectionConfigModel): Promise<{ identity: Identity, signer: Signer }> {

    let credentials;
    let privateKey;
    if (connectionConfig.identity.certType === 'embeded') {

        credentials = Buffer.from(Buffer.from(connectionConfig.identity.cert, 'base64').toString('utf8'), 'utf8');

        const privateKeyPem = Buffer.from(connectionConfig.identity.privateKey, 'base64').toString('utf8');
        privateKey = crypto.createPrivateKey(privateKeyPem);
        
    } else if (connectionConfig.identity.certType === 'files') {

        credentials = await fs.readFile(connectionConfig.identity.certPath);

        const privateKeyPem = await fs.readFile(connectionConfig.identity.privateKeyPath);
        privateKey = crypto.createPrivateKey(privateKeyPem);

    } else if (connectionConfig.identity.certType === 'microfab') {

        try {
            const dataufab = await fetch(connectionConfig.identity.microfabUrl + '/ak/api/v1/components');
            const bodyJson = await dataufab.json();
            const ufabIdentity = findCertById(bodyJson, connectionConfig.identity.microfabId);
    
            credentials = Buffer.from(Buffer.from(ufabIdentity.cert, 'base64').toString('utf8'), 'utf8');
            
            const privateKeyPem = Buffer.from(ufabIdentity.private_key, 'base64').toString('utf8');
            privateKey = crypto.createPrivateKey(privateKeyPem);
        } catch (err) {
            throw new Error(`Unable to build identity from microfab. ${err}`);
        } 

    } else {
        throw new Error('Unable to get identity with cert type: ' + connectionConfig.identity.certType + ". Not implemented");
    }

    return { identity: { mspId: connectionConfig.identity.mspId.mspId, credentials }, signer: signers.newPrivateKeySigner(privateKey) };
}

export async function buildGatewayConnection(grpcClient: GrpcClient, connectionConfig: ConnectionConfigModel): Promise<Gateway> {

    const identity = await newIdentity(connectionConfig);

    const options: ConnectOptions = {
        identity: identity.identity,
        signer: identity.signer,
        client: grpcClient,
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    };

    return connect(options);    
}

export function getTransactionName(configTransaction: string, payload: { transactionName?: string; }) {
    let transactionName;
    if (payload && payload.transactionName) {
        transactionName = payload.transactionName;
    } else {
        transactionName = configTransaction;
    }
    if (!transactionName) {
        throw Error("Transaction name not defined in config nor payload");
    }
    return transactionName;
}

/**
 * Return the value if it is defined; otherwise thrown an error.
 * @param value A value that might not be defined.
 * @param message Error message if the value is not defined.
 */
export function assertDefined<T>(value: T | null | undefined, message: string): T {
    if (value == undefined) {
        throw new Error(message);
    }

    return value;
}

export async function closeConnection(this: Node<{}>, connection: ConnectionConfigModel, done: () => void) {
    try {
        await closeGateway(this, connection);
        this.status({ fill: 'grey', shape: 'dot', text: 'Closed' });
        this.debug('Closed');
        done();

    } catch (error: any) {
        this.status({ fill: 'red', shape: 'dot', text: error });
        done();
    }
}

export async function invokeChaincode(
    RED: NodeAPI,
    node: Node<{}>,
    msg: NodeMessageInFlow,
    decoder: FabricDecoderType,
    actionType: string,
    connection: ConnectionConfigModel,
    config: ChaincodeNodeDef,
) {
    const channelName = getConfigValidate(RED, config.channelSelector).channel;
    const contractName = getConfigValidate(RED, config.contractSelector).contract;

    const transactionName = getTransactionName(config.transaction, msg.payload);
    const proposal = getTransactionData(config.args, config.transientData, msg.payload);

    return await invokeChaincodeInternal(RED, node, msg, decoder, actionType, connection, channelName, contractName, transactionName, proposal);
}

export async function invokeChaincodeGeneric(
    RED: NodeAPI,
    node: Node<{}>,
    msg: NodeMessageInFlow,
    decoder: FabricDecoderType,
    actionType: string,
    connection: ConnectionConfigModel, 
    channelSelector: string,
    contractName: string,
    transactionName: string,
    args?: string[],
) {
    const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, channelSelector);
    const proposal: ProposalOptions = {arguments: args}; 
    return await invokeChaincodeInternal(RED, node, msg, decoder, actionType, connection, fabricChannelDef.channel, contractName, transactionName, proposal);
}

async function invokeChaincodeInternal(
    RED: NodeAPI,
    node: Node<{}>,
    msg: NodeMessageInFlow,
    decoder: FabricDecoderType,
    actionType: string,
    connection: ConnectionConfigModel, 
    channelName: string,
    contractName: string,
    transactionName: string,
    proposal: ProposalOptions,
) {

    const gateway = await getGateway(node, connection);
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(contractName);

    let getResult;
    if (actionType === 'submit') {
        getResult = await contract.submit(transactionName, proposal);
    } else if (actionType === 'evaluate') {
        getResult = await contract.evaluate(transactionName, proposal);
    } else {
        throw new Error("Undefined action type: " + actionType);
    }

    addResultToPayload(RED, msg, transactionName, proposal, decoder(getResult));
}

function getTransactionData(configArgs: string, configTransient: string, payload: { transaction?: { args?: string[], transient?: string[] }}): ProposalOptions {

    return {
        arguments: getTransactionArg(),
        transientData: getTransactionTransient()
    };    

    function getTransactionArg() {
        let transactionArgs;
        if (payload?.transaction?.args) {
            transactionArgs = payload.transaction.args;

        } else if (configArgs) {
            try {
                transactionArgs = JSON.parse(configArgs);
            } catch (e) {
                throw new Error("Configuration Args is not an array!");
            }

        }

        if (transactionArgs && !Array.isArray(transactionArgs)) {
            throw new Error("Configuration Args is not an array!");
        }

        return transactionArgs;
    }    

    function getTransactionTransient() {
        let transientData;
        if (payload?.transaction?.transient) {
            transientData = payload.transaction.transient;
        } else if (configTransient) {
            try {
                transientData = JSON.parse(configTransient);
            } catch (e) {
                throw new Error("Transient args is not an array! " + configTransient);
            }
        }

        if (transientData && !Array.isArray(transientData)) {
            throw new Error("Transient args is not an array");
        }
        
        return transientData;
    }
}

function findCertById(data: any, id: string) {
    try {

        for (const item of data) {
            if (item.id === id && item.type === "identity") {
                return item;
            }
        }
    } catch (err) {
        throw new Error('Unable to get Identity from microfab. Id: ' + id + ". Error: " + err);
    }
    
    throw new Error('Unable to get Identity from microfab. Id: ' + id);
}