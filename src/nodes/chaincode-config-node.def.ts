import { ConnectionNodeDef } from "./connection-config-node.def";

export interface ChaincodeNodeDef extends ConnectionNodeDef {
    contractSelector: string;
    transaction: string;
    args?: string;
    transientData?: string;
}
