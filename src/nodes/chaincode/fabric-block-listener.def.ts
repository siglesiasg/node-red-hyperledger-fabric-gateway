import { ConnectionNodeDef } from "../connection-config-node.def";

export interface FabricBlockListenerDef extends ConnectionNodeDef {
    sendTransactions: string; // true / false
    checkpointerPath: string;
}
