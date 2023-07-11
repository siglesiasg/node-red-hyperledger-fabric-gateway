import { ConnectionNodeDef } from "../connection-config-node.def";

export interface FabricBlockListenerDef extends ConnectionNodeDef {
    name: string;
    sendTransactions: boolean;
    firstBlock: number;
    checkpointerPath: string;
}

export interface FabricBlockListenerCommitDef extends ConnectionNodeDef {
    name: string;
}
