import { NodeDef } from "node-red";

export interface FabricGatewayDef extends NodeDef {
    name: string;
    mspIdSelectorGw: string;
    peerSelectorGw: string;
}