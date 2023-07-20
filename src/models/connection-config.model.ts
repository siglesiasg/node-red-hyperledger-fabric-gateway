import { NodeAPI } from 'node-red';
import { getConfigValidate } from './../libs/node-red-utils';
import { FabricChannelDef } from './../nodes/config/fabric-channel.def';
import { FabricGatewayDef } from './../nodes/config/fabric-gateway.def';
import { FabricIdentityDef } from './../nodes/config/fabric-identity.def';
import { FabricMspIdDef } from './../nodes/config/fabric-mspid.def';
import { FabricPeerDef } from './../nodes/config/fabric-peer.def';
import { ConnectionNodeDef } from './../nodes/connection-config-node.def';

export interface ConnectionConfigModel {
    gateway: GatewayConfigModel;
    identity: IdentityConfigModel;
    channel: ChannelConfigModel;
}

interface GatewayConfigModel {
    gatewaySelector: string;

    name: string;
    peer: PeerConfigModel;
}

export interface IdentityConfigModel {
    identitySelector: string;

    name: string;
    mspId: MspIdConfigModel
    certType: string;
    cert?: string;
    privateKey?: string;
    ca: string;

    certPath?: string;
    privateKeyPath?: string;

    microfabUrl?: string;
    microfabId?: string;
}

interface ChannelConfigModel {
    channelSelector: string;

    name: string;
    channel: string;
}

interface MspIdConfigModel {
    mspIdSelector: string;

    name: string;
    mspId: string;
}

interface PeerConfigModel {
    peerSelector: string;

    name: string;
    url: string;
    tls?: string
    grpcOptions?: string;
}

export function buildConnectionConfig(RED: NodeAPI, config: ConnectionNodeDef): ConnectionConfigModel {

  const fabricGatewayDef: FabricGatewayDef = getConfigValidate(RED, config.gatewaySelector);
  const fabricIdentityDef: FabricIdentityDef = getConfigValidate(RED, config.identitySelector);
  const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);

  return {
    gateway: buildGateway(RED, fabricGatewayDef),
    identity: buildIdentity(RED, fabricIdentityDef),
    channel: buildChannel(fabricChannelDef)
  };

}
function buildGateway(RED: NodeAPI, fabricGatewayDef: FabricGatewayDef): GatewayConfigModel {

  const fabricPeerDef: FabricPeerDef = getConfigValidate(RED, fabricGatewayDef.peerSelectorGw);

  return {
    gatewaySelector: fabricGatewayDef.id,
    name: fabricGatewayDef.name,
    peer: buildPeer(fabricPeerDef)
  };
}

function buildIdentity(RED: NodeAPI, fabricIdentityDef: FabricIdentityDef): IdentityConfigModel {

  const fabricIdentityMspidDef = getConfigValidate(RED, fabricIdentityDef.mspIdSelector);
  return {
    identitySelector: fabricIdentityDef.id,
    name: fabricIdentityDef.name,

    certType: fabricIdentityDef.certType,

    cert: fabricIdentityDef.cert,
    privateKey: fabricIdentityDef.privateKey,
    ca: fabricIdentityDef.ca,

    certPath: fabricIdentityDef.certPath,
    privateKeyPath: fabricIdentityDef.privateKeyPath,

    microfabUrl: fabricIdentityDef.microfabUrl,
    microfabId: fabricIdentityDef.microfabId,

    mspId: buildMspId(fabricIdentityMspidDef)
  };
}

function buildChannel(fabricChannelDef: FabricChannelDef): ChannelConfigModel {
  return {
    channelSelector: fabricChannelDef.id,
    name: fabricChannelDef.name,
    channel: fabricChannelDef.channel
  };
}

function buildMspId(fabricMspIdDef: FabricMspIdDef): MspIdConfigModel {
  return {
    mspIdSelector: fabricMspIdDef.id,
    name: fabricMspIdDef.name,
    mspId: fabricMspIdDef.mspId,
  };
}

function buildPeer(fabricPeerDef: FabricPeerDef): PeerConfigModel {
  let url;
  if (fabricPeerDef.url.startsWith('grpcs://')) {
    url = fabricPeerDef.url.substring(8, fabricPeerDef.url.length);
  } else {
    url = fabricPeerDef.url;
  }
  return {
    peerSelector: fabricPeerDef.id,
    name: fabricPeerDef.name,
    url,
    tls: fabricPeerDef.tls,
    grpcOptions: fabricPeerDef.grpcOptions,
  };
}