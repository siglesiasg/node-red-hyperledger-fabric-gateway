import { Checkpointer, CloseableAsyncIterable, EventsOptions, checkpointers } from "@hyperledger/fabric-gateway";
import { Block } from "@hyperledger/fabric-protos/lib/common";
import { Semaphore } from 'await-semaphore';
import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getGateway } from "../../libs/fabric-connection-pool";
import { addConfiguration, addEventToPayload, getConfigValidate } from "../../libs/node-red-utils";
import { buildBlockEventModel } from "../chain/models/block.model";
import { closeConnection } from "./../../libs/fabric-functions";
import { ConnectionConfigModel, buildConnectionConfig } from "./../../models/connection-config.model";
import { FabricChannelDef } from "./../config/fabric-channel.def";
import { FabricBlockListenerCommitDef, FabricBlockListenerDef } from "./fabric-block-listener.def";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-listener', fabricBlockListenerNode);    
    RED.nodes.registerType('fabric-block-listener-commit', fabricBlockListenerCommitNode);

    let connection: ConnectionConfigModel;

    let blockIterable: CloseableAsyncIterable<Block>;

    const locks: Map<string, any> = new Map();

    let checkpointer: Checkpointer;

    function fabricBlockListenerNode(this: Node<FabricBlockListenerDef>, config: FabricBlockListenerDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        try {

            addConfiguration(this, config);

            connection = buildConnectionConfig(RED, config);

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

            if (blockIterable) {
                blockIterable.close();
            }
                        
            await closeConnection.call(this, connection, done);            
        });


        async function mainFunct(node: Node<FabricBlockListenerDef>, config: FabricBlockListenerDef) {

            try {
    
                node.status({ fill: 'yellow', shape: 'dot', text: "Starting listener" });
                
                checkpointer = await checkpointers.file(config.checkpointerPath);
    
                const eventsOption: EventsOptions = {
                    checkpoint: checkpointer,
                    startBlock: BigInt(config.firstBlock)
                }
                
                const fabricChannelDef: FabricChannelDef = getConfigValidate(RED, config.channelSelector);
    
                const gateway = await getGateway(node, connection);
                const network = gateway.getNetwork(fabricChannelDef.channel);
    
                const request = network.newBlockEventsRequest(eventsOption);
                blockIterable = await request.getEvents();
                
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
                if (blockIterable) {
                    blockIterable.close();
                }
            }            
        }
    
        async function sendByBlocks(node: Node<FabricBlockListenerDef>, channel: string) {
            try {
                const semaphore = new Semaphore(1);
                for await (const block of blockIterable) {
    
                    const blockData = buildBlockEventModel(block, channel);
    
                    node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + ") is still pending to be commited" });
                    
                    const lockId = `${node.id}-${blockData.blockNumber}`;
                    await getLock(semaphore, lockId);
    
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
            try {
                const semaphore = new Semaphore(1);
                for await (const block of blockIterable) {
    
                    const blockData = buildBlockEventModel(block, channel);
    
                    for (const tx of blockData.transactions) {
    
                        if (blockData.blockNumber === checkpointBlock && tx.transactionIndex <= checkpointTx) {
                            continue;
                        }
                        
                        node.status({ fill: 'yellow', shape: 'dot', text: "Previous block (" + blockData.blockNumber + " - " + tx.transactionIndex + ") is still pending to be commited" });

                        const lockId = `${node.id}-${blockData.blockNumber}-${tx.transactionIndex}`;
                        await getLock(semaphore, lockId);
        
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
    
    function fabricBlockListenerCommitNode(this: Node<FabricBlockListenerCommitDef>, config: FabricBlockListenerCommitDef) {
        
        RED.nodes.createNode(this, config); // First line always!

        this.debug('Fabric BLock Listener Commit Node Created');
        this.status({ fill: 'green', shape: 'dot', text: "Ready" });

        this.on('input', async (msg: NodeMessageInFlow, send, done) => {
            try {

                const _lockSession: string = (msg as any)._lockSession;
                if (!_lockSession) { throw new Error('Unable to get _lockSession attribute'); }

                const nodeId = _lockSession.split('-');
                if (!nodeId || nodeId.length !==2 && nodeId.length !==3) { throw new Error('Unable to get node id from lockSession: ' + _lockSession); }
                
                const checkpointedBlock = BigInt(parseInt(nodeId[1]));
                const checkPointerTxIndex = (nodeId.length === 3) ? nodeId[2] : undefined;

                // const nodeListenerConfig: FabricBlockListenerDef = getConfigValidate(RED, nodeId[0]);
                // const checkpointTx = nodeListenerConfig.sendTransactions;

                // RED.util.getMessageProperty
                await releaseLock(_lockSession);

                await updateCheckpointer.call(this, checkpointedBlock, checkPointerTxIndex);

                done();

            } catch (error: any) {
                this.error(error.stack);
                this.status({ fill: 'red', shape: 'dot', text: error });
                done(error);
            }

        });        
        
        async function updateCheckpointer(this: Node<FabricBlockListenerCommitDef>, checkpointedBlock: bigint, checkPointerTxIndex: string) {

            const currentBlock = checkpointer.getBlockNumber();
            const currentTxIndex = Number(checkpointer.getTransactionId());

            // If checkpointer is not initialized just start it
            if (!currentBlock) {
                if (!checkPointerTxIndex) {
                    await checkpointer.checkpointBlock(checkpointedBlock);
                    this.status({ fill: 'green', shape: 'dot', text: "Checkpointed block: " + checkpointedBlock });
                } else {
                    await checkpointer.checkpointTransaction(checkpointedBlock, checkPointerTxIndex);
                    this.status({ fill: 'green', shape: 'dot', text: "Checkpointed block: " + checkpointedBlock + " - " + checkPointerTxIndex });
                }
            } else {
                // Checkpoint can only grow: Numbers and transaction. This aims to be duplicate message proof
                if (currentBlock <= checkpointedBlock) {
                    if (!checkPointerTxIndex) {
                        await checkpointer.checkpointBlock(checkpointedBlock);
                        this.status({ fill: 'green', shape: 'dot', text: "Checkpointed block: " + checkpointedBlock });
                    } else {
                        if (currentBlock < checkpointedBlock || (currentBlock === checkpointedBlock && currentTxIndex < Number(checkPointerTxIndex))) {
                            await checkpointer.checkpointTransaction(checkpointedBlock, String(Number(checkPointerTxIndex)+1));
                            this.status({ fill: 'green', shape: 'dot', text: "Checkpointed block: " + checkpointedBlock + " - " + checkPointerTxIndex });
                        }
                    }
                }
            }
        }
    }        

    async function getLock(semaphore: Semaphore, id: string) {
        const blockLock = await semaphore.acquire();
        locks.set(id, blockLock);
    }
    
    async function releaseLock(id: string) {
        const release = locks.get(id);
        if (release) {
            try {
                await release();
            } catch (err) {
                // Nothing to do if unable to unlock
            }
            locks.delete(id);
        }
    }
}
