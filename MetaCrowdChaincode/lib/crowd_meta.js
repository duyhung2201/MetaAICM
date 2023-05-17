/*
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

// Deterministic JSON.stringify()
const { Contract, Context } = require("fabric-contract-api");
const TokenERC20Contract = require("./tokenERC20");
const ReputationContract = require("./reputation");
const ModelExchangeContract = require("./model_exchange");
const DataExchangeContract = require("./data_exchange");
const MarketplaceContract = require("./marketplace");

class CrowdMetaContext extends Context {
	constructor() {
		super();
		this.reputationContract = new ReputationContract(this);
		this.tokenERC20Contract = new TokenERC20Contract("token-erc20");
		this.modelExchangeContract = new ModelExchangeContract(this);
		this.dataExchangeContract = new DataExchangeContract(this);
		this.marketplaceContract = new MarketplaceContract(this);
	}
}

class CrowdMetaContract extends Contract {
	constructor() {
		// Unique namespace when multiple contracts per chaincode file
		super("crowdmeta");
		this.createContext();
	}

	/**
	 * Define a custom context
	 */
	createContext() {
		return new CrowdMetaContext();
	}

	async Initialize(ctx) {
		await ctx.tokenERC20Contract.SetOption(
			ctx,
			"tokenName",
			"tokenSymbol",
			"2"
		);
	}

	async queryMLTask(ctx, taskId) {
		return await ctx.modelExchangeContract.queryTask(taskId);
	}

	async initMLTask(
		ctx,
		taskId,
		deadline,
		taskDescriptionLink,
		paymentPerModel,
		testDataHash,
		maxParticipants,
		minReputation
	) {
		return await ctx.modelExchangeContract.initTask(
			taskId,
			deadline,
			taskDescriptionLink,
			paymentPerModel,
			testDataHash,
			maxParticipants,
			minReputation
		);
	}

	async submitModel(ctx, taskId, modelHash) {
		await ctx.modelExchangeContract.submitModel(taskId, modelHash);
	}

	async evaluateModel(ctx, taskId, results) {
		await ctx.modelExchangeContract.evaluate(taskId, results);
	}

	async queryDataTask(ctx, taskId) {
		await ctx.dataExchangeContract.queryTask(taskId);
	}

	async initDataTask(
		ctx,
		publicKey,
		deadline,
		taskDescriptionLink,
		paymentPerDataset,
		maxParticipants,
		minReputation
	) {
		await ctx.dataExchangeContract.initTask(
			publicKey,
			deadline,
			taskDescriptionLink,
			paymentPerDataset,
			maxParticipants,
			minReputation
		);
	}

	async submitData(ctx, taskId, encryptedDataHash) {
		await ctx.dataExchangeContract.submitData(taskId, encryptedDataHash);
	}

	async evaluateDataset(ctx, taskId, results) {
		await ctx.dataExchangeContract.evaluate(taskId, results);
	}

	async unlockDeposit(ctx, taskId) {
		await ctx.dataExchangeContract.unlockDeposit(taskId);
	}

	async createDisputeRequest(
		ctx,
		taskId,
		datasetIndex,
		dataHash,
		disputeDescription
	) {
		await ctx.dataExchangeContract.createDisputeRequest(
			taskId,
			datasetIndex,
			dataHash,
			disputeDescription
		);
	}

	async resolveDispute(ctx, taskId, datasetIndex, result) {
		await ctx.dataExchangeContract.resolveDispute(taskId, datasetIndex, result);
	}

	async BalanceOf(ctx, owner) {
		return await ctx.tokenERC20Contract.BalanceOf(ctx, owner);
	}

	async Transfer(ctx, to, value) {
		await ctx.tokenERC20Contract.Transfer(ctx, to, value);
	}

	async TransferFrom(ctx, from, to, value) {
		await ctx.tokenERC20Contract.TransferFrom(ctx, from, to, value);
	}

	async Mint(ctx, amount) {
		await ctx.tokenERC20Contract.Mint(ctx, amount);
	}

	async Allowance(ctx, owner, spender) {
		await ctx.tokenERC20Contract.Allowance(ctx, owner, spender);
	}

	async Approve(ctx, spender, value) {
		await ctx.tokenERC20Contract.Approve(ctx, spender, value);
	}

	async getReputation(ctx) {
		const user = ctx.clientIdentity.getID();
		return await ctx.reputationContract.getReputation(user);
	}

	async initSellingItem(ctx, itemDescriptionLink, price, proof) {
		return await ctx.marketplaceContract.initItem(
			itemDescriptionLink,
			price,
			proof
		);
	}

	async buyRequest(ctx, itemId, encryptionKey) {
		return await ctx.marketplaceContract.buyRequest(itemId, encryptionKey);
	}

	async querySellingItem(ctx, itemId) {
		return await ctx.marketplaceContract.queryItem(itemId);
	}
}

module.exports = CrowdMetaContract;
