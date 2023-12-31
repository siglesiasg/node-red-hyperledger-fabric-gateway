import { ProposalOptions } from '@hyperledger/fabric-gateway';
import { Node, NodeAPI, NodeDef, NodeMessageInFlow } from 'node-red';

export function addSharedData(node: Node, key: string, sharedData: any) {
  const nodeAny = node as any;
  if (!nodeAny.sharedData) {
    nodeAny.sharedData = {};
  }
  node.debug(`Updating shared data of ${node.name?node.name:'nodeId[' + node.id + ']'} - Key: ${key}`);

  nodeAny.sharedData[key] = sharedData;
}

export function getSharedData(RED: NodeAPI, nodeId: string, key: string) {
  const nodeAny = RED.nodes.getNode(nodeId) as any;

  if (!nodeAny) {
    return undefined;
  }

  if (nodeAny.sharedData[key]) {
    return nodeAny.sharedData[key];
  } else {
    return undefined;
  }

}

export function addConfiguration(node: Node, config: NodeDef) {
  const nodeAny = node as any;
  if (!nodeAny.internalConfig) {
    nodeAny.internalConfig = {};
  }
  // if (!nodeAny.internalCredentials) {
  //   nodeAny.internalCredentials = {};
  // }
  nodeAny.internalConfig = config;
  // nodeAny.internalCredentials = node.credentials;
  node.debug(`Updating data of ${node.name?node.name:'nodeId[' + node.id + ']'}`);
}

export function getConfig(node: Node) {
  const nodeAny = node as any;
  if (nodeAny.internalConfig) {
    return nodeAny.internalConfig;
  } else {
    return undefined;
  }
}

export function getConfigValidate(RED: NodeAPI, nodeId: string) {
  const nodeAny = RED.nodes.getNode(nodeId) as any;
  if (!nodeAny) {
    throw new Error('Unable to get config node with id: ' + nodeId + '. Is this node enabled and available?');
  }

  if (nodeAny.internalConfig) {
    return nodeAny.internalConfig;
  } else {
    throw new Error('Unable to get internal config node with id: ' + nodeId + '. Is this node filled with internal config info?');
  }
}

export function addEventToPayload(RED: NodeAPI, msg: NodeMessageInFlow, decodedResult: string) {
  const data = {
    event: decodedResult?JSON.parse(decodedResult):undefined
  };

  RED.util.setMessageProperty(msg, 'payload', data, true);
}

export function addResultToPayload(RED: NodeAPI, msg: NodeMessageInFlow, name: string, transactionArgs: string[] | ProposalOptions, decodedResult: string) {

  let transaction;
  if (!transactionArgs) {
    transaction = {
      name,
    };
  } else if (Array.isArray(transactionArgs)) {
    transaction = {
      name,
      args: transactionArgs
    };
  } else {
    transaction = {
      name,
      args: (transactionArgs as ProposalOptions).arguments,
      transient: (transactionArgs as ProposalOptions).transientData,
    };
  }

  const payloadData = {
    transaction,
    result: decodedResult?JSON.parse(decodedResult):undefined
  };

  if (!payloadData.result) { delete payloadData.result; }
  if (!payloadData.transaction.args) { delete payloadData.transaction.args; }
  if (!payloadData.transaction.transient) { delete payloadData.transaction.transient; }

  RED.util.setMessageProperty(msg, 'payload', payloadData, true);
}
