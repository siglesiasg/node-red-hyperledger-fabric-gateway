import { BlockchainInfo } from '@hyperledger/fabric-protos/lib/common';

export class ChannelInfoModel {
  height: number;
  lastBlockHash: string;
}

export function buildChannelInfoModel(chainInfoBin: Uint8Array): ChannelInfoModel {
  const info = BlockchainInfo.deserializeBinary(chainInfoBin);
  return {
    height: info.getHeight(),
    lastBlockHash: info.getCurrentblockhash_asB64()
  };
}