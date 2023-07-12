import { CloseableAsyncIterable, EventsOptions, checkpointers } from "@hyperledger/fabric-gateway";
import { Block } from "@hyperledger/fabric-protos/lib/common";
import { Semaphore } from 'await-semaphore';
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
            this.error(error.stack);
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
                const locks: Map<string, any> = new Map();
                addSharedData(node, 'locks', locks);

                const eventsOption: EventsOptions = {
                    checkpoint: checkpointer,
                    startBlock: BigInt(config.firstBlock)
                }
                
                const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);
    
                const gateway = await getGateway(node, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
    
                const request = network.newBlockEventsRequest(eventsOption);
                const blockIterable = await request.getEvents();

                addSharedData(node, 'blockIterable', blockIterable);
                
                let nextBlock;
                if (eventsOption.checkpoint) {
                    nextBlock = eventsOption.checkpoint.getBlockNumber();
                } else {
                    nextBlock = eventsOption.startBlock;
                }
    
                node.status({ fill: 'green', shape: 'dot', text: "Waiting for next block: " + nextBlock });
    
                if (!config.sendTransactions) {
                    await sendByBlocks(node, fabricChannelDef.channel);
                } else {
                    let checkpointBlock: number
                    let checkpointTx: number;
                    if (checkpointer) {
                        checkpointBlock = Number(checkpointer.getBlockNumber());
                        checkpointTx = checkpointer.getTransactionId() ? Number(checkpointer.getTransactionId()) : 0;
                    } else {
                        checkpointBlock = Number(eventsOption.startBlock);
                        checkpointTx = 0;
                    }
                    await sendByTransactions(node, checkpointBlock, checkpointTx, fabricChannelDef.channel); 
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
        }
    
        async function sendByBlocks(node: Node<FabricBlockListenerDef>, channel: string) {

            const blockIterable = getSharedData(RED, node.id, 'blockIterable') as CloseableAsyncIterable<Block>;

            try {
                const semaphore = new Semaphore(1);
                if (!blockIterable) { throw new Error('Unable to get block iterable'); }
                for await (const block of blockIterable) {
    
                    const blockData = buildBlockEventModel(block, channel);
    
                    node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + ") is still pending to be commited" });
                    
                    const lockId = `${node.id}-${blockData.blockNumber}`;
                    await getLock(semaphore, node.id, lockId);
    
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
    
        async function sendByTransactions(node: Node<FabricBlockListenerDef>, checkpointBlock: number, checkpointTx: number, channel: string) {
            
            const blockIterable = getSharedData(RED, node.id, 'blockIterable') as CloseableAsyncIterable<Block>;

            try {
                const semaphore = new Semaphore(1);
                if (!blockIterable) { throw new Error('Unable to get block iterable'); }
                for await (const block of blockIterable) {
    
                    const blockData = buildBlockEventModel(block, channel);
    
                    for (const tx of blockData.transactions) {
    
                        if (blockData.blockNumber === checkpointBlock && tx.transactionIndex <= checkpointTx) {
                            continue;
                        }
                        
                        node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + " - " + tx.transactionIndex + ") is still pending to be commited" });

                        const lockId = `${node.id}-${blockData.blockNumber}-${tx.transactionIndex}`;
                        await getLock(semaphore, node.id, lockId);
        
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
    
    async function getLock(semaphore: Semaphore, nodeId: string, id: string) {
        console.log("Adding lock " + id);
        const blockLock = await semaphore.acquire();
        console.log("Added lock " + id);
        const locks = getSharedData(RED, nodeId, 'locks');
        locks.set(id, blockLock);
    }
    
}
