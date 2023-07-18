import { ChaincodeNodeDef } from "../chaincode-config-node.def";

export interface FabricGenericDef extends ChaincodeNodeDef {
    actionType: string;
}
