import * as grpc from '@grpc/grpc-js';
import { connect, ConnectOptions, Gateway, GrpcClient, Identity, Signer, signers } from '@hyperledger/fabric-gateway';
import { Buffer } from 'buffer';
import * as crypto from 'crypto';
import { FabricIdentityDef } from './../nodes/config/fabric-identity.def';
import { FabricMspIdDef } from './../nodes/config/fabric-mspid.def';
import { FabricPeerDef } from './../nodes/config/fabric-peer.def';
import { ConnectionConfigModel, IdentityConfigModel } from 'src/models/connection-config.model';
import { Node } from 'node-red';
import { closeGateway } from './fabric-connection-pool';
import { promises as fs } from 'fs';

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

        const dataufab = await fetch(connectionConfig.identity.microfabUrl + '/ak/api/v1/components');
        const bodyJson = await dataufab.json();
        const ufabIdentity = findCertById(bodyJson, connectionConfig.identity.microfabId);

        credentials = Buffer.from(Buffer.from(ufabIdentity.cert, 'base64').toString('utf8'), 'utf8');
        
        const privateKeyPem = Buffer.from(ufabIdentity.private_key, 'base64').toString('utf8');
        privateKey = crypto.createPrivateKey(privateKeyPem);

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

export function getTransactionArgs(configArgs: string, payload: { transactionArgs?: string; }): string[] {
    let transactionArgs;
    if (payload && payload.transactionArgs) {
        transactionArgs = payload.transactionArgs;
    } else if (configArgs) {
        try {
            transactionArgs = JSON.parse(configArgs);
        } catch (e) {
            throw new Error("Configuration Args is not an array! " + configArgs);
        }
    } else {
        return [];
    }
    
    if (transactionArgs && !Array.isArray(transactionArgs)) {
        throw new Error("Transaction Args is not an array");
    }

    return transactionArgs;
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
        this.error(error.stack);
        this.status({ fill: 'red', shape: 'dot', text: error });
        done();
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
