import { NodeDef } from "node-red";

export interface FabricGatewayDef extends NodeDef {
    name: string;
    peerSelectorGw: string;
}