import { Node, NodeAPI } from 'node-red';
import { addConfiguration } from './../../libs/node-red-utils';
import { FabricPeerDef } from './fabric-peer.def';

export = function (RED: NodeAPI): void {

  function fabricPeerNode(this: Node<FabricPeerDef>, config: FabricPeerDef) {
    RED.nodes.createNode(this, config);
    addConfiguration(this, config);
  }

  RED.nodes.registerType('fabric-peer', fabricPeerNode);

}

