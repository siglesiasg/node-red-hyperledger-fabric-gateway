import { Gateway, GrpcClient } from "@hyperledger/fabric-gateway";
import { Node } from "node-red";
import { ConnectionConfigModel } from "src/models/connection-config.model";
import { buildGatewayConnection, newGrpcConnection } from "./fabric-functions";

const connectionMap = new Map<string, GrpcClient> ();
const gatewayMap = new Map<string, Gateway> ();

const connectionOwners = new Map<GrpcClient, Set<string>> ();
const gatewayOwners = new Map<Gateway, Set<string>> ();

export async function closeGateway(ownerNode: Node<{}>, connection: ConnectionConfigModel) {
    ownerNode.debug(`Closing Gateway`);
    await releaseGateway(ownerNode, connection);
    await releaseGrpcClient(ownerNode, connection);
}

export async function getGateway(ownerNode: Node<{}>, connection: ConnectionConfigModel): Promise<Gateway> {
    
    const grpcClient: GrpcClient = await buildGrpcClient(ownerNode, connection);

    return await buildGateway(grpcClient, ownerNode, connection);    

}

async function buildGateway(grpcClient: GrpcClient, ownerNode: Node<{}>, connection: ConnectionConfigModel) {
    let gateway: Gateway;
    // Build Gateway
    if (gatewayMap.has(connection.identity.identitySelector)) {
        gateway = gatewayMap.get(connection.identity.identitySelector);
    } else {
        gateway = await buildGatewayConnection(grpcClient, connection);
        gatewayMap.set(connection.identity.identitySelector, gateway);
        ownerNode.debug("Added new gateway to gateway map. Current Size: " + connectionMap.size);

    }
    // Save in Gateway Owners
    if (gatewayOwners.has(gateway)) {
        gatewayOwners.get(gateway).add(ownerNode.id);
    } else {
        gatewayOwners.set(gateway, new Set<string>([ownerNode.id]));
    }
    return gateway;
}

async function buildGrpcClient(ownerNode: Node<{}>, connection: ConnectionConfigModel) {
    let grpcClient: GrpcClient;

    // Build Grpc Client and save in cache map
    if (connectionMap.has(connection.gateway.peer.peerSelector)) {
        grpcClient = connectionMap.get(connection.gateway.peer.peerSelector);
    } else {
        grpcClient = await newGrpcConnection(connection);
        connectionMap.set(connection.gateway.peer.peerSelector, grpcClient);
        ownerNode.debug("Added new connection to connection map. Current Size: " + connectionMap.size);
    }

    // Save in Grpc Owners
    if (connectionOwners.has(grpcClient)) {
        connectionOwners.get(grpcClient).add(ownerNode.id);
    } else {
        connectionOwners.set(grpcClient, new Set<string>([ownerNode.id]));
    }
    return grpcClient;
}

async function releaseGrpcClient(ownerNode: Node<{}>, connection: ConnectionConfigModel) {

    const grpcClient: GrpcClient = await buildGrpcClient(ownerNode, connection);

    if (connectionOwners.has(grpcClient)) {
        const owners = connectionOwners.get(grpcClient);
        if(owners.size > 1) {
            ownerNode.debug('Grpc Client is being used by other nodes');
        } else {
            ownerNode.debug('Closing Grpc Client. No more nodes are using it');
            grpcClient.close();
            connectionOwners.delete(grpcClient);
            connectionMap.delete(connection.gateway.peer.peerSelector);
            return;
        }

        // Drop owner node from list
        owners.delete(ownerNode.id);
        ownerNode.debug("Remaining nodes attached to Grpc Client: " + owners.size);

    } else {
        ownerNode.warn('Trying to close unknown Grpc Client');
    }
}

async function releaseGateway(ownerNode: Node<{}>, connection: ConnectionConfigModel) {

    const gateway = await getGateway(ownerNode, connection);
    if (gatewayOwners.has(gateway)) {
        const owners = gatewayOwners.get(gateway);
        if(owners.size > 1) {
            ownerNode.debug('Gateway is being used by other nodes');
        } else {
            ownerNode.debug('Closing gateway. No more nodes are using it');
            gateway.close();
            gatewayOwners.delete(gateway);
            gatewayMap.delete(connection.identity.identitySelector);
            return;
        }

        // Drop owner node from list
        owners.delete(ownerNode.id);
        ownerNode.debug("Remaining nodes attached to gateway: " + owners);

    } else {
        ownerNode.warn('Trying to close unknown gateway');
    }
}