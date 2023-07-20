import { NodeDef } from 'node-red';

export interface FabricContractDef extends NodeDef {
    name: string;
    contract: string;
}