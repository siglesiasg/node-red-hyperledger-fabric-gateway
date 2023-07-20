import { NodeDef } from 'node-red';

export interface FabricChannelDef extends NodeDef {
    name: string;
    channel: string;
}