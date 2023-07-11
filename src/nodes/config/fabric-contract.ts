import { Node, NodeAPI } from "node-red";
import { FabricContractDef } from "./fabric-contract.def";
import { addConfiguration } from "./../../libs/node-red-utils";

export = function (RED: NodeAPI): void {

    function fabricChaincodeNode(this: Node<FabricContractDef>, config: FabricContractDef) {
        RED.nodes.createNode(this, config);
        addConfiguration(this, config);
    }    

    RED.nodes.registerType('fabric-contract', fabricChaincodeNode);

}
