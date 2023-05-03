/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
const sinon = require('sinon');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub, ClientIdentity } = require('fabric-shim');

const CrowdMetaContract = require('../lib/crowd_meta');
const TokenERC20Contract = require('../lib/tokenERC20');
const ReputationContract = require('../lib/reputation');
const ModelExchangeContract = require('../lib/model_exchange');
const DataExchangeContract = require('../lib/data_exchange');

chai.should();
chai.use(chaiAsPromised);

let mockClientIdentity;

class CrowdMetaContext extends Context {
    constructor() {
        super();
        this.reputationContract = new ReputationContract(this);
        this.tokenERC20Contract = new TokenERC20Contract('token-erc20');
        this.modelExchangeContract = new ModelExchangeContract(this);
        this.dataExchangeContract = new DataExchangeContract(this);
    }
}

let admin = 'Admin';
let user = 'Alice';
let org = 'Org1MSP';

describe('CrwodMeta Tests', () => {
    let ctx, mockStub, crowdMeta;
    beforeEach(async () => {
        ctx = new CrowdMetaContext();

        // Mock the ChaincodeStub
        mockStub = sinon.createStubInstance(ChaincodeStub);
        ctx.setChaincodeStub(mockStub);

        // Mock the ClientIdentity
        mockClientIdentity = sinon.createStubInstance(ClientIdentity);
        ctx.clientIdentity = mockClientIdentity;

        mockClientIdentity.getMSPID.returns(org);
        mockClientIdentity.getID.returns(admin);

        crowdMeta = new CrowdMetaContract();
        await crowdMeta.Initialize(ctx);

        mockStub.putState.callsFake((key, value) => {
            if (!mockStub.states) {
                mockStub.states = {};
            }
            mockStub.states[key] = value;
        });

        mockStub.getState.callsFake(async (key) => {
            let ret;
            if (mockStub.states) {
                ret = mockStub.states[key];
            }
            return Promise.resolve(ret);
        });
    });

    describe('Test stub', () => {
        it('should work', async () => {
            await mockStub.putState('t', Buffer.from('1'));
            console.log(await mockStub.getState('t'));
            console.log(await mockStub.getState('t1'));
        });
    });

    describe('Test Mint', () => {
        it('should return success on Mint', async () => {
            await crowdMeta.Mint(ctx, 10);
            const key = getKey(ctx, 'balance');

            let ret = JSON.parse(
                (await chaincodeStub.getState(key)).toString()
            );
            expect(ret).to.eql(10);
        });
    });

    describe('Test getReputation', () => {
        it('should work', async () => {
            let t = await crowdMeta.getReputation(ctx);
            console.log(t);
        });
    });

    describe('Test initMLTask', () => {
        it('should work', async () => {
            mockClientIdentity.getID.returns(admin);
            await crowdMeta.Mint(ctx, 1000);
            console.log(await crowdMeta.BalanceOf(ctx, admin));
            let taskId = await crowdMeta.initMLTask(
                ctx,
                Date.now() + 300000,
                '',
                1,
                '',
                10,
                1
            );
            expect(taskId).to.eql(1);

            let task = await crowdMeta.queryMLTask(ctx, taskId);
            console.log(task);

            await crowdMeta.submitModel(ctx, 1, 't');
            task = await crowdMeta.queryMLTask(ctx, taskId);
            console.log(task);

            await crowdMeta.evaluateModel(ctx, 1, [true]);
            task = await crowdMeta.queryMLTask(ctx, taskId);
            console.log(task);
        });
    });
});
