import { ConnectionNodeDef } from "../connection-config-node.def";

export interface FabricCCSubmitDef extends ConnectionNodeDef {
    name: string;
    contractSelector: string;
    transaction: string;
    args: string;
}
