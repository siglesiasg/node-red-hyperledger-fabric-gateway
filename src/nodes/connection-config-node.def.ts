import { NodeDef } from "node-red";

export interface ConnectionNodeDef extends NodeDef {
    gatewaySelector: string;         // Pointer to FabricConfigDef object
    identitySelector: string;
    channelSelector: string;
}