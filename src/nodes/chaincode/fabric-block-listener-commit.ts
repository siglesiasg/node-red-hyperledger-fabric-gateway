import { Node, NodeAPI, NodeMessageInFlow } from "node-red";
import { getSharedData } from "../../libs/node-red-utils";
import { FabricBlockListenerCommitDef } from "./fabric-block-listener-commit.def";

export = (RED: NodeAPI): void => {

    RED.nodes.registerType('fabric-block-listener-commit', fabricBlockListenerCommitNode);

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
                
                const listenerNodeId = nodeId[0];
                const checkpointedBlock = BigInt(parseInt(nodeId[1]));
                const checkPointerTxIndex = (nodeId.length === 3) ? nodeId[2] : undefined;

                await releaseLock(listenerNodeId, _lockSession);

                await updateCheckpointer.call(this, listenerNodeId, checkpointedBlock, checkPointerTxIndex);

                done();

            } catch (error: any) {
                this.error(error.stack);
                this.status({ fill: 'red', shape: 'dot', text: error });
                done(error);
            }

        });        
        
        async function updateCheckpointer(this: Node<FabricBlockListenerCommitDef>, listenerNodeId: string, checkpointedBlock: bigint, checkPointerTxIndex: string) {
           
            const checkpointer = getSharedData(RED, listenerNodeId, 'checkpointer');
            const currentBlock = checkpointer.getBlockNumber();
            const currentTxIndex = Number(checkpointer.getTransactionId());

            // If checkpointer is not initialized just start it
            if (!currentBlock) {
                if (!checkPointerTxIndex) {
                    await checkpointer.checkpointBlock(checkpointedBlock);
                    this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${checkpointedBlock} for node ${this.name?this.name:this.id}`});
                } else {
                    await checkpointer.checkpointTransaction(checkpointedBlock, checkPointerTxIndex);
                    this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${checkpointedBlock} - ${checkPointerTxIndex} for node ${this.name?this.name:this.id}`});
                }
            } else {
                // Checkpoint can only grow: Numbers and transaction. This aims to be duplicate message proof
                if (currentBlock <= checkpointedBlock) {
                    if (!checkPointerTxIndex) {
                        await checkpointer.checkpointBlock(checkpointedBlock);
                        this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${checkpointedBlock} for node ${this.name?this.name:this.id}`});
                    } else {
                        if (currentBlock < checkpointedBlock || (currentBlock === checkpointedBlock && currentTxIndex < Number(checkPointerTxIndex))) {
                            await checkpointer.checkpointTransaction(checkpointedBlock, String(Number(checkPointerTxIndex)+1));
                            this.status({ fill: 'green', shape: 'dot', text: `Checkpointed block: ${checkpointedBlock} - ${checkPointerTxIndex} for node ${this.name?this.name:this.id}`});
                        }
                    }
                }
            }
        }
    }        

    async function releaseLock(nodeId: string, id: string) {
        const locks = getSharedData(RED, nodeId, 'locks');
        const release = locks.get(id);
        if (release) {
            try {
                console.log("Release lock " + id);
                await release();
                console.log("Released lock " + id);
            } catch (err) {
                console.log("Unable to Release lock " + id);
                // Nothing to do if unable to unlock
            }
            locks.delete(id);
        } else {
            console.log("Lock already released " + id);
        }
    }
}
