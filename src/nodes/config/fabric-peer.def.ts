import { NodeDef } from "node-red";

export interface FabricPeerDef extends NodeDef {
    name: string;
    url: string;
    grpcOptions: string;
}