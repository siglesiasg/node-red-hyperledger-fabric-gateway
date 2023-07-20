import { Node, NodeAPI } from 'node-red';
import { addConfiguration } from './../../libs/node-red-utils';
import { FabricIdentityDef } from './fabric-identity.def';

export = function (RED: NodeAPI): void {

    function fabricIdentityNode(this: Node<FabricIdentityDef>, config: FabricIdentityDef) {
        RED.nodes.createNode(this, config);
        addConfiguration(this, config);
    }

    RED.nodes.registerType('fabric-identity', fabricIdentityNode);

}

