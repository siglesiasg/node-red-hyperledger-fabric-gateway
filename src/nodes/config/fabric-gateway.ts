import { Node, NodeAPI } from "node-red";
import { addConfiguration } from "./../../libs/node-red-utils";
import { FabricGatewayDef } from "./fabric-gateway.def";

export = function (RED: NodeAPI): void {

    function fabricGatewayNode(this: Node<FabricGatewayDef>, config: FabricGatewayDef) {
        RED.nodes.createNode(this, config);
        addConfiguration(this, config);
    }    

    RED.nodes.registerType('fabric-gateway', fabricGatewayNode);

}

