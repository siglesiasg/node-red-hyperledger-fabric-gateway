import { Node, NodeAPI, NodeDef, NodeMessageInFlow } from "node-red";

export function addConfiguration(node: Node, config: NodeDef) {
    const nodeAny = node as any;
    if (!nodeAny.internalConfig) {
        nodeAny.internalConfig = {};
    }
    nodeAny.internalConfig = config;
    node.debug(`Updating data of ${node.name?node.name:'nodeId[' + node.id + ']'} with ${JSON.stringify(nodeAny.internalConfig)}`);
};

export function getConfig(node: Node) {
    const nodeAny = node as any;
    if (nodeAny.internalConfig) {
        return nodeAny.internalConfig;
    } else {
        return undefined;
    }
};

export function getConfigValidate(RED: NodeAPI, id: string) {
    const nodeAny = RED.nodes.getNode(id) as any;
    if (!nodeAny) {
        throw new Error("Unable to get config node with id: " + id + ". Is this node enabled and available?");
    }
    
    if (nodeAny.internalConfig) {
        return nodeAny.internalConfig;
    } else {
        throw new Error("Unable to get internal config node with id: " + id + ". Is this node filled with internal config info?");
    }
};

export function addEventToPayload(RED: NodeAPI, msg: NodeMessageInFlow, decodedResult: string) {
    const data = {
        event: decodedResult?JSON.parse(decodedResult):undefined
    }

    RED.util.setMessageProperty(msg, "payload", data, true);
}

export function addResultToPayload(RED: NodeAPI, msg: NodeMessageInFlow, transactionName: string, transactionArgs: string[], decodedResult: string) {
    const data = {
        query: {
            transactionName,
            transactionArgs
        },
        result: decodedResult?JSON.parse(decodedResult):undefined
    };

    RED.util.setMessageProperty(msg, "payload", data, true);
}
