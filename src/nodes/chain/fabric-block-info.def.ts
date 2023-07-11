import { ConnectionNodeDef } from "../connection-config-node.def";

export interface FabricBlockInfoDef extends ConnectionNodeDef {
    name: string;
    method: string;
    blockNumber?: string;
    blockHash?: string;
    txId?: string;
}
