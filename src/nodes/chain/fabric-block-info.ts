import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { buildBlockDecoder } from "./../../libs/fabric-decoder";
import { getGateway } from "../../libs/fabric-connection-pool";
import { closeConnection, invokeChaincodeGeneric } from "../../libs/fabric-functions";
import { addResultToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { buildConnectionConfig } from "../../models/connection-config.model";
import { FabricBlockInfoDef } from "./fabric-block-info.def";
import { buildBlockEventModel } from "./models/block.model";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-info', fabricGetBlockNode);    

    function fabricGetBlockNode(this: Node<FabricBlockInfoDef>, config: FabricBlockInfoDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        const connection = buildConnectionConfig(RED, config);
        const fabricChannelDef = getConfigValidate(RED, config.channelSelector);
        const blockDecoder = buildBlockDecoder(fabricChannelDef.channel);

        this.debug('Fabric Get Block By Number Node Created');
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {

            try {

                this.status({ fill: 'yellow', shape: 'dot', text: "Querying..." });

                let transactionName;
                let transactionArgs;

                if (config.method === 'number') {
                    transactionName = 'GetBlockByNumber';
                    transactionArgs = [fabricChannelDef.channel, config.blockNumber];

                } else if (config.method === 'hash') {
                    transactionName = 'GetBlockByHash';
                    transactionArgs = [fabricChannelDef.channel, config.blockHash];

                } else if (config.method === 'txId') {
                    transactionName = 'GetBlockByTxID';
                    transactionArgs = [fabricChannelDef.channel, config.txId];
                } else {
                    throw new Error('Config method invalid: ' + config.method);
                }

                await invokeChaincodeGeneric(RED, this, msg, blockDecoder, 'evaluate', connection, config.channelSelector, 'qscc', transactionName, transactionArgs);

                this.status({ fill: 'green', shape: 'dot', text: "Done" });
                
                send(msg);
                done();

            } catch (error: any) {
                this.status({ fill: 'red', shape: 'dot', text: error });
                done(error);
            }

        });
        
        // removed -> "Node disabled / deleted" | !removed -> "Node is reestarted"
        this.on('close', async (removed: boolean, done: () => void) => {
            await closeConnection.call(this, connection, done);            
        });
        
    }    
}
