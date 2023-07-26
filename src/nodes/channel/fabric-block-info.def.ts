import { ConnectionNodeDef } from '../connection-config-node.def';

export interface FabricBlockInfoDef extends ConnectionNodeDef {
    method: string;
    blockNumber?: string;
    blockHash?: string;
    txId?: string;
}
