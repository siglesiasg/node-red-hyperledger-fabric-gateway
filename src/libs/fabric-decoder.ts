import { buildBlockEventModel } from './../nodes/chain/models/block.model';
import { buildChannelInfoModel } from './../nodes/chain/models/channel-info.model';

export type FabricDecoderType = (getResult: Uint8Array) => string;

export function buildGenericDecoder(): FabricDecoderType {
  return (data) => new TextDecoder().decode(data);
}

export function buildChannelInfoDecoder(): FabricDecoderType {
  return (data) => JSON.stringify(buildChannelInfoModel(data));
}

export function buildBlockDecoder(channel: string): FabricDecoderType {
  return (data) => JSON.stringify(buildBlockEventModel(data, channel));
}
