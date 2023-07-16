import Semaphore from '@chriscdn/promise-semaphore';
import { Checkpointer, CloseableAsyncIterable, EventsOptions, checkpointers } from "@hyperledger/fabric-gateway";
import { Block } from "@hyperledger/fabric-protos/lib/common";
import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { addConfiguration, addEventToPayload, addSharedData, getConfigValidate, getSharedData } from "../../libs/node-red-utils";
import { buildBlockEventModel } from "../chain/models/block.model";
import { closeConnection } from "./../../libs/fabric-functions";
import { buildConnectionConfig } from "./../../models/connection-config.model";
import { FabricChannelDef } from "./../config/fabric-channel.def";
import { FabricBlockListenerDef } from "./fabric-block-listener.def";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-listener', fabricBlockListenerNode);    

    function fabricBlockListenerNode(this: Node<FabricBlockListenerDef>, config: FabricBlockListenerDef) {
        
        RED.nodes.createNode(this, config); // First line always!
        
        const connection = buildConnectionConfig(RED, config);

        try {

            addConfiguration(this, config);

            this.debug('Fabric BLock Listener Node Created');
            
            // Launch listener async function
            mainFunct(this, config);

            this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        } catch (error: any){
            this.status({ fill: 'red', shape: 'dot', text: error });
            return;
        }

        // removed -> "Node disabled / deleted" | !removed -> "Node is reestarted"
        this.on('close', async (removed: boolean, done: () => void) => {

            const blockIterable = getSharedData(RED, this.id, 'blockIterable') as CloseableAsyncIterable<Block>;
            if (blockIterable) {
                blockIterable.close();
            }
                        
            await closeConnection.call(this, connection, done);            
        });


        async function mainFunct(node: Node<FabricBlockListenerDef>, config: FabricBlockListenerDef) {

            try {
    
                node.status({ fill: 'yellow', shape: 'dot', text: "Starting listener" });
                
                const checkpointer = await checkpointers.file(config.checkpointerPath);
                addSharedData(node, 'checkpointer', checkpointer);

                const eventsOption = await createEventsOptions(checkpointer);
                
                const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);
    
                const gateway = await getGateway(node, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
    
                const request = network.newBlockEventsRequest(eventsOption);
                const blockIterable = await request.getEvents();

                const semaphore = new Semaphore();

                addSharedData(node, 'blockIterable', blockIterable);
                addSharedData(node, 'semaphore', semaphore);

                let nextBlock;
                if (eventsOption.checkpoint) {
                    nextBlock = eventsOption.checkpoint.getBlockNumber();
                } else {
                    nextBlock = eventsOption.startBlock;
                }
    
                node.status({ fill: 'green', shape: 'dot', text: "Waiting for next block: " + nextBlock });
    
                if (config.sendTransactions === 'false') {
                    await sendByBlocks(node, fabricChannelDef.channel, semaphore);
                } else {
                    const checkpointBlock = Number(checkpointer.getBlockNumber());
                    const checkpointTx = checkpointer.getTransactionId() ? Number(checkpointer.getTransactionId()) : 0;
                    await sendByTransactions(node, checkpointBlock, checkpointTx, fabricChannelDef.channel, semaphore); 
                }
                
            } catch (error: any) {
    
                node.error(error.stack);
                node.status({ fill: 'red', shape: 'dot', text: error });
    
            } finally {
                const blockIterable = getSharedData(RED, node.id, 'blockIterable') as CloseableAsyncIterable<Block>;
                if (blockIterable) {
                    blockIterable.close();
                }
            }
            
            async function createEventsOptions(checkpointer: Checkpointer) {
                let eventsOption: EventsOptions;
                if (checkpointer.getBlockNumber()) { // Already got a block number to continue
                    eventsOption = {
                        checkpoint: checkpointer
                    };
                } else { // First run, start at 0
                    eventsOption = {
                        checkpoint: checkpointer,
                        startBlock: BigInt(0)
                    };
                    // Initialice checkpointer
                    await checkpointer.checkpointBlock(BigInt(-1));
                }

                return eventsOption;
            }

            async function sendByBlocks(node: Node<FabricBlockListenerDef>, channel: string, semaphore: Semaphore) {

                const blockIterable = getSharedData(RED, node.id, 'blockIterable') as CloseableAsyncIterable<Block>;
    
                try {
    
                    if (!blockIterable) { throw new Error('Unable to get block iterable'); }
    
                    for await (const block of blockIterable) {
        
                        const blockData = buildBlockEventModel(block, channel);
                        
                        const lockId = `${node.id}-${blockData.blockNumber}`;
                        node.trace("Adding lock " + lockId);
                        await semaphore.acquire();
                        
                        node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + ") is still pending to be commited" });
                        
                        const msg: NodeMessageInFlow = {
                            _msgid: RED.util.generateId(),
                            topic: ""
                        };
                        
                        addEventToPayload(RED, msg, JSON.stringify(blockData));
                        
                        RED.util.setMessageProperty(msg, "_lockSession", lockId, true);
                        
                        node.send(msg);
                        
                        node.status({ fill: 'green', shape: 'dot', text: "Waiting for next block: " + (blockData.blockNumber + 1) });
                    }
                } catch (error: any) {
                    if (error.message && error.message.includes('1 CANCELLED: Cancelled on client')) {
                        node.status({ fill: 'grey', shape: 'dot', text: 'Closed' });
                    } else {
                        node.error(error.stack);
                        node.status({ fill: 'red', shape: 'dot', text: error });
                    }
        
                } finally {
                    if (blockIterable) {
                        blockIterable.close();
                    }
                }   
            }
        
            async function sendByTransactions(node: Node<FabricBlockListenerDef>, checkpointBlock: number, checkpointTx: number, channel: string, semaphore: Semaphore) {
                
                const blockIterable = getSharedData(RED, node.id, 'blockIterable') as CloseableAsyncIterable<Block>;
    
                try {
    
                    if (!blockIterable) { throw new Error('Unable to get block iterable'); }
                    for await (const block of blockIterable) {
        
                        const blockData = buildBlockEventModel(block, channel);
        
                        node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + " - 0) is still pending to be commited" });

                        for await (const tx of blockData.transactions) {
        
                            if (blockData.blockNumber === checkpointBlock && tx.transactionIndex <= checkpointTx) {
                                node.trace(`Skiping already processed block ${blockData.blockNumber} - ${tx.transactionIndex}`);
                                node.status({ fill: 'yellow', shape: 'dot', text: "Skiping already processed block (" + blockData.blockNumber + " - " + tx.transactionIndex + ")" });
                                continue;
                            }
                            
                            const lockId = `${node.id}-${blockData.blockNumber}-${tx.transactionIndex}`;
                            node.trace("Adding lock " + lockId);
                            await semaphore.acquire();
                            
                            node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + " - " + tx.transactionIndex + ") is still pending to be commited" });
    
                            const msg: NodeMessageInFlow = {
                                _msgid: RED.util.generateId(),
                                topic: ""
                            };
            
                            addEventToPayload(RED, msg, JSON.stringify(tx));
            
                            RED.util.setMessageProperty(msg, "_lockSession", lockId, true);
            
                            node.send(msg);
                        }
    
                        node.status({ fill: 'green', shape: 'dot', text: "Waiting for next block: " + (blockData.blockNumber + 1) });
                    }
                } catch (error: any) {
                    if (error.message && error.message.includes('1 CANCELLED: Cancelled on client')) {
                        node.status({ fill: 'grey', shape: 'dot', text: 'Closed' });
                    } else {
                        node.error(error.stack);
                        node.status({ fill: 'red', shape: 'dot', text: error });
                    }
        
                } finally {
                    if (blockIterable) {
                        blockIterable.close();
                    }
                }       
            }              

        }
    
    }
    
}
