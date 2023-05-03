/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

const reputationPrefix = 'reputation';

class ReputationContract extends Contract {
    constructor(ctx) {
        super();
        this.ctx = ctx;
    }

    async getReputation(user) {
        const reputationKey = this.ctx.stub.createCompositeKey(
            reputationPrefix,
            [user]
        );
        const reputationAsBytes = await this.ctx.stub.getState(reputationKey);

        // If the user does not have a reputation score, return 0
        if (!reputationAsBytes || reputationAsBytes.length === 0) {
            return 0;
        }

        const reputationScore = parseInt(reputationAsBytes.toString());
        return reputationScore;
    }

    async award(user, points) {
        const reputationKey = this.ctx.stub.createCompositeKey(
            reputationPrefix,
            [user]
        );
        const currentReputationAsBytes = await this.ctx.stub.getState(
            reputationKey
        );
        let currentReputation = 0;

        if (currentReputationAsBytes && currentReputationAsBytes.length !== 0) {
            currentReputation = parseInt(currentReputationAsBytes.toString());
        }

        const newReputation = currentReputation + parseInt(points);
        await this.ctx.stub.putState(
            reputationKey,
            Buffer.from(newReputation.toString())
        );
        console.log(`${user} increase ${points} reputation`);

        return newReputation;
    }

    async punish(user, points) {
        const reputationKey = this.ctx.stub.createCompositeKey(
            reputationPrefix,
            [user]
        );
        const currentReputationAsBytes = await this.ctx.stub.getState(
            reputationKey
        );
        let currentReputation = 0;

        if (currentReputationAsBytes && currentReputationAsBytes.length !== 0) {
            currentReputation = parseInt(currentReputationAsBytes.toString());
        }

        const newReputation = currentReputation - parseInt(points);
        await this.ctx.stub.putState(
            reputationKey,
            Buffer.from(newReputation.toString())
        );

        return newReputation;
    }
}

module.exports = ReputationContract;
