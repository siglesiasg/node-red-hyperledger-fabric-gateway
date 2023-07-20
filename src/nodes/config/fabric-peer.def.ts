import { NodeDef } from 'node-red';

export interface FabricPeerDef extends NodeDef {
    name: string;
    url: string;
    tls?: string;
    grpcOptions?: string;
}