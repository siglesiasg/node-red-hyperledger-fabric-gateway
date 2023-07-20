import { NodeDef } from 'node-red';

export interface FabricMspIdDef extends NodeDef {
    name: string;
    mspId: string;
}