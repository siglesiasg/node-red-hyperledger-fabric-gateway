import { Block } from '@hyperledger/fabric-protos/lib/common';
import { NamespaceReadWriteSetProtos, TransactionProtos, parseBlock } from '../libs/fabric-parse-block';

const utf8Decoder = new TextDecoder();

export class BlockModel {
  blockNumber: number;
  blockHash: string;
  channelId: string;
  transactions: TransactionModel[];
}

export class TransactionModel {
  blockNumber?: number;
  transactionIndex: number;
  transactionId: string;
  isValid: boolean;
  rawData?: RWSetModel[];
  // getChannelHeader(): common.ChannelHeader;
  // getCreator(): Identity;
  // getValidationCode(): number;

  // getNamespaceReadWriteSets(): NamespaceReadWriteSetModel[];
  // toProto(): common.Payload;
}

export class RWSetModel {
  rwIndex: number;
  key: string;
  data?: any;
  isChaincodeOperation?: boolean;
  isDelete?: boolean;
}

export function buildBlockEventModel(blockData: Block | Uint8Array, channelId: string): BlockModel {

  let blockProtos;
  if (blockData instanceof Block) {
    blockProtos = parseBlock(blockData);
  } else if (blockData instanceof Uint8Array) {
    blockProtos = parseBlock(Block.deserializeBinary(blockData));
  }

  return {
    blockNumber: Number(blockProtos.getNumber()),
    blockHash: blockProtos.getHash(),
    channelId,
    transactions: getTransactions(blockProtos.getTransactions()),
  };
}

function getTransactions(transactions: TransactionProtos[]): TransactionModel[] {
  const tx: TransactionModel[] = [];
  let transactionIndex = 0;
  for (const txProtos of transactions) {
    tx.push({
      transactionIndex,
      transactionId: txProtos.getChannelHeader().getTxId(),
      isValid: txProtos.isValid(),
      rawData: getRWSet(txProtos.getNamespaceReadWriteSets())
    });
    transactionIndex++;
  }
  return tx;
}

//
function getRWSet(rwsetProtos: NamespaceReadWriteSetProtos[]): RWSetModel[] {
  const rw: RWSetModel[] = [];
  let rwIndex = 0;
  for (const rwProtos of rwsetProtos) {
    for (const writeProtos of rwProtos.getReadWriteSet().getWritesList()) {
      const key = writeProtos.getKey();
      let data;
      let isChaincodeOperation;
      if (key.startsWith('namespaces/fields/') || key.startsWith('namespaces/metadata/')) {
        data = undefined;
        isChaincodeOperation = true;
      } else {
        data = JSON.parse(utf8Decoder.decode(writeProtos.getValue_asU8()));
      }

      rw.push({
        rwIndex,
        key,
        data,
        isChaincodeOperation,
        isDelete: writeProtos.getIsDelete()?true:undefined,
      });
      rwIndex++;
    }
  }
  return rw;
}