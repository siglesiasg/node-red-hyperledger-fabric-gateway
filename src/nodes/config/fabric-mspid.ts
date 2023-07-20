import { addConfiguration } from './../../libs/node-red-utils';
import { FabricMspIdDef } from './fabric-mspid.def';
import { Node, NodeAPI } from 'node-red';

export = function (RED: NodeAPI): void {

    function fabricMspIdNode(this: Node<FabricMspIdDef>, config: FabricMspIdDef) {
        RED.nodes.createNode(this, config);
        addConfiguration(this, config);
    }

    RED.nodes.registerType('fabric-mspid', fabricMspIdNode);

}
