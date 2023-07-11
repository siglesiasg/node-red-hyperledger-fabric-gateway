import { NodeDef } from "node-red";

export interface FabricIdentityDef extends NodeDef {
    name: string;
    mspIdSelector: string;
    certType: string;
    cert?: string;
    ca: string;
    privateKey?: string;
    certPath?: string;
    privateKeyPath?: string;
    microfabUrl?: string;
    microfabId?: string;
}