import { Node, NodeAPI } from 'node-red';
import { FabricChannelDef } from './fabric-channel.def';
import { addConfiguration } from './../../libs/node-red-utils';

export = function (RED: NodeAPI): void {

    function fabricChannelNode(this: Node<FabricChannelDef>, config: FabricChannelDef) {
        RED.nodes.createNode(this, config);
        addConfiguration(this, config);
    }

    RED.nodes.registerType('fabric-channel', fabricChannelNode);

}
