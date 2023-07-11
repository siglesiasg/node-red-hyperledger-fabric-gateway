import { ConnectionNodeDef } from "../connection-config-node.def";

export interface FabricGenericDef extends ConnectionNodeDef {
    name: string;
    contractSelector: string;
    actionType: string;
    transaction: string;
    args: string;
}
