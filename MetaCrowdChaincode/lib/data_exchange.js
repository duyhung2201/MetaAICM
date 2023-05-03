/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

const taskCounterKey = 'task_counter_data';
const dataExchangePrefix = 'data';
const disputePrefix = 'dispute';
const lockedDuration = 5 * 60 * 1000;

class DataExchangeContract extends Contract {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.reputationContract = ctx.reputationContract;
        this.tokenERC20Contract = ctx.tokenERC20Contract;
    }

    async queryTask(taskId) {
        const dataExchangeKey = this.ctx.stub.createCompositeKey(
            dataExchangePrefix,
            [taskId]
        );
        const taskAsBytes = await this.ctx.stub.getState(dataExchangeKey);

        if (!taskAsBytes || taskAsBytes.length === 0) {
            throw new Error(`Task ${taskId} does not exist.`);
        }
        return taskAsBytes.toString();
    }

    async getNextTaskId() {
        const counterBytes = await this.ctx.stub.getState(taskCounterKey);
        let counterValue;
        if (!counterBytes || counterBytes.length === 0) {
            // Initialize the counter if it doesn't exist
            counterValue = 1;
        } else {
            counterValue = parseInt(counterBytes.toString()) + 1;
        }

        // Update the counter value on the ledger
        await this.ctx.stub.putState(
            taskCounterKey,
            Buffer.from(counterValue.toString())
        );

        return counterValue;
    }

    async initTask(
        publicKey,
        deadline,
        taskDescriptionLink,
        paymentPerDataset,
        maxParticipants,
        minReputation
    ) {
        const taskOwner = this.ctx.clientIdentity.getID();
        await this.tokenERC20Contract.Transfer(
            this.ctx,
            this.getName(),
            paymentPerDataset * maxParticipants
        );

        const taskId = await this.getNextTaskId();
        const task = {
            taskId,
            taskOwner,
            publicKey,
            deadline,
            taskDescriptionLink,
            paymentPerDataset,
            maxParticipants,
            minReputation,
            totalParticipants: 0,
            datasets: [],
        };

        const dataExchangeKey = this.ctx.stub.createCompositeKey(
            dataExchangePrefix,
            [taskId]
        );
        await this.ctx.stub.putState(
            dataExchangeKey,
            Buffer.from(stringify(sortKeysRecursive(task)))
        );
    }

    async submitData(taskId, encryptedDataHash) {
        const dataExchangeKey = this.ctx.stub.createCompositeKey(
            dataExchangePrefix,
            [taskId]
        );
        const taskAsBytes = await this.ctx.stub.getState(dataExchangeKey);

        if (!taskAsBytes || taskAsBytes.length === 0) {
            throw new Error(`Task ${taskId} does not exist.`);
        }
        const task = JSON.parse(taskAsBytes.toString());

        if (task.totalParticipants >= task.maxParticipants) {
            throw new Error('Maximum number of participants reached');
        }

        // Check if the deadline has passed
        const currentTime = new Date().getTime();
        if (currentTime > task.deadline) {
            throw new Error('Deadline has passed');
        }

        const user = this.ctx.clientIdentity.getID();
        // Check if the participant has the required minimum reputation
        const userReputation = await this.reputationContract.getReputation(
            user
        );
        if (userReputation < task.minReputation) {
            throw new Error(
                'Participant does not meet the minimum reputation requirement'
            );
        }

        const dataset = {
            encryptedDataHash,
            user,
            rewardDistributed: false,
        };

        task.datasets.push(dataset);
        task.totalParticipants += 1;

        await this.ctx.stub.putState(
            dataExchangeKey,
            Buffer.from(JSON.stringify(task))
        );
    }

    async evaluate(taskId, results) {
        const dataExchangeKey = this.ctx.stub.createCompositeKey(
            dataExchangePrefix,
            [taskId]
        );
        //results =[true, flase, ....]
        const task = JSON.parse(this.queryTask(taskId));
        const taskOwner = this.ctx.clientIdentity.getID();

        if (task.taskOwner !== taskOwner) {
            throw new Error('authentication fail');
        }
        if (results.length !== task.datasets.length) {
            throw new Error('malformed evaluation result');
        }

        for (let i = 0; i < results.length; i++) {
            if (!results[i]) {
                continue;
            }
            task.datasets[i].rewardDistributed = true;
            await this.tokenERC20Contract._transfer(
                this.ctx,
                this.getName(),
                task.datasets[i].user,
                task.paymentPerDataset
            );
            await this.reputationContract.award(task.datasets[i].user, 1);
        }

        await this.ctx.stub.putState(
            dataExchangeKey,
            Buffer.from(JSON.stringify(task))
        );
    }

    async unlockDeposit(taskId) {
        const task = JSON.parse(this.queryTask(taskId));
        const taskOwner = this.ctx.clientIdentity.getID();
        if (task.taskOwner !== taskOwner) {
            throw new Error('authentication fail');
        }
        // Check if the lockedDuration has passed
        const currentTime = new Date().getTime();
        if (currentTime < task.deadline + lockedDuration) {
            throw new Error('Deposit is locked');
        }

        const notDistributed = task.datasets.filter(
            (item) => !item.rewardDistributed
        );
        await this.tokenERC20Contract._transfer(
            this.ctx,
            this.getName(),
            taskOwner,
            task.paymentPerDataset * notDistributed.length
        );
    }

    async createDisputeRequest(
        taskId,
        datasetIndex,
        dataHash,
        disputeDescription
    ) {
        const task = JSON.parse(this.queryTask(taskId));
        const user = this.ctx.clientIdentity.getID();
        const dataset = task.datasets[datasetIndex];
        if (dataset.user !== user || dataset.rewardDistributed) {
            throw new Error('authentication fail');
        }

        // check encryptedDataHash and dataHash matching
        const encryptedHash = crypto.publicEncrypt(
            {
                key: task.publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256',
            },
            Buffer.from(dataHash)
        );

        if (encryptedHash !== dataset.encryptedDataHash) {
            throw new Error('Wrong dataHash');
        }

        const dispute = {
            taskId,
            dataHash,
            user,
            disputeDescription,
            resolved: false,
            result: null,
        };

        const disputeKey = this.ctx.stub.createCompositeKey(disputePrefix, [
            taskId,
            datasetIndex,
        ]);
        await this.ctx.stub.putState(
            disputeKey,
            Buffer.from(stringify(sortKeysRecursive(dispute)))
        );
    }

    async resolveDispute(taskId, datasetIndex, result) {
        // Check Oracle authorization
        const clientMSPID = this.ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'OracleMSP') {
            throw new Error('client is not authorized to resolve dispute');
        }

        const disputeKey = this.ctx.stub.createCompositeKey(disputePrefix, [
            taskId,
            datasetIndex,
        ]);
        const disputeAsBytes = await this.ctx.stub.getState(disputeKey);

        if (!disputeAsBytes || disputeAsBytes.length === 0) {
            throw new Error('Dispute does not exist.');
        }
        const dispute = JSON.parse(disputeAsBytes.toString());

        if (dispute.resolved) {
            throw new Error('Dispute has already been resolved');
        }

        dispute.resolved = true;
        dispute.result = result;

        const task = JSON.parse(this.queryTask(taskId));
        if (result) {
            // Reward the user if the dispute is resolved in their favor
            await this.tokenERC20Contract._transfer(
                this.ctx,
                this.getName(),
                dispute.user,
                task.paymentPerDataset
            );
            await this.reputationContract.award(dispute.user, 1);
            await this.reputationContract.punish(task.taskOwner, 1);
        }

        const dataExchangeKey = this.ctx.stub.createCompositeKey(
            dataExchangePrefix,
            [taskId]
        );

        task.datasets[datasetIndex].rewardDistributed = true;
        await this.ctx.stub.putState(
            dataExchangeKey,
            Buffer.from(JSON.stringify(task))
        );
    }
}

module.exports = DataExchangeContract;
