import { NodeDef } from 'node-red';

export interface FabricIdentityDef extends NodeDef {
    name: string;
    mspIdSelector: string;
    certType: string;
    cert: string;
    privateKey: string;
    isFabricOpType: string;
    fabricOpIdPath: string;
    certPath?: string;
    privateKeyPath?: string;
    microfabUrl?: string;
    microfabId?: string;
}