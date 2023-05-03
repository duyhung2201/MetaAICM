/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

const taskCounterKey = 'task_counter';

class ModelExchangeContract extends Contract {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.reputationContract = ctx.reputationContract;
        this.tokenERC20Contract = ctx.tokenERC20Contract;
    }

    async queryTask(taskId) {
        const taskAsBytes = await this.ctx.stub.getState(taskId);

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
        taskId,
        deadline,
        taskDescriptionLink,
        paymentPerModel,
        testDataHash,
        maxParticipants,
        minReputation
    ) {
        const taskOwner = this.ctx.clientIdentity.getID();
        // await this.tokenERC20Contract.Transfer(
        //     this.ctx,
        //     this.getName(),
        //     paymentPerModel * maxParticipants
        // );

        // const taskId = await this.getNextTaskId();
        const task = {
            taskId,
            taskOwner,
            deadline,
            taskDescriptionLink,
            paymentPerModel,
            testDataHash,
            maxParticipants,
            minReputation,
            totalParticipants: 0,
            models: [],
        };

        await this.ctx.stub.putState(
            taskId,
            Buffer.from(stringify(sortKeysRecursive(task)))
        );

        return taskId;
    }

    async submitModel(taskId, modelHash) {
        const taskAsBytes = await this.ctx.stub.getState(taskId);

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

        const model = {
            modelHash,
            user,
            rewardDistributed: false,
        };

        task.models.push(model);
        task.totalParticipants += 1;

        await this.ctx.stub.putState(taskId, Buffer.from(JSON.stringify(task)));
    }

    async evaluate(taskId, results) {
        //results =[true, flase, ....]
        const taskAsBytes = await this.ctx.stub.getState(taskId);
        if (!taskAsBytes || taskAsBytes.length === 0) {
            throw new Error(`Task ${taskId} does not exist.`);
        }
        const task = JSON.parse(taskAsBytes.toString());
        const taskOwner = this.ctx.clientIdentity.getID();

        if (task.taskOwner !== taskOwner) {
            throw new Error('authentication fail');
        }
        if (results.length !== task.models.length) {
            throw new Error('malformed evaluation result');
        }

        let paidAmount = 0; // Keep track of the total paid amount

        for (let i = 0; i < results.length; i++) {
            if (!results[i]) {
                continue;
            }
            task.models[i].rewardDistributed = true;
            await this.tokenERC20Contract._transfer(
                this.ctx,
                this.getName(),
                task.models[i].user,
                task.paymentPerModel
            );
            await this.reputationContract.award(task.models[i].user, 1);

            paidAmount += task.paymentPerModel; // Increment the total paid amount
        }

        // Calculate and return the remaining deposit to the task owner
        const initialDeposit = task.paymentPerModel * task.maxParticipants;
        const remainingDeposit = initialDeposit - paidAmount;
        await this.tokenERC20Contract._transfer(
            this.ctx,
            this.getName(),
            taskOwner,
            remainingDeposit
        );

        await this.ctx.stub.putState(taskId, Buffer.from(JSON.stringify(task)));
    }
}

module.exports = ModelExchangeContract;
