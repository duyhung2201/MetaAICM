/*
 * SPDX-License-Identifier: Apache-2.0
 */

"use strict";

// Deterministic JSON.stringify()
const { Contract, Context } = require("fabric-contract-api");
const TokenERC20Contract = require("./tokenERC20");
const DigitalAssetContract = require("./digital_asset");

class DAMContext extends Context {
	constructor() {
		super();
		this.tokenERC20Contract = new TokenERC20Contract("token-erc20");
		this.digitalAssetContract = new DigitalAssetContract(this);
	}
}

class DAMContract extends Contract {
	constructor() {
		// Unique namespace when multiple contracts per chaincode file
		super("dam");
		this.createContext();
	}

	/**
	 * Define a custom context
	 */
	createContext() {
		return new DAMContext();
	}

	async Initialize(ctx) {
		await ctx.tokenERC20Contract.SetOption(
			ctx,
			"tokenName",
			"tokenSymbol",
			"2"
		);
	}

	async queryItem(ctx, itemId) {
		return await ctx.digitalAssetContract.queryItem(itemId);
	}

	async listItem(
		ctx,
		price,
		parentAsset,
		commissionRate
		// itemId
	) {
		return await ctx.digitalAssetContract.listItem(
			taskId,
			price,
			parentAsset,
			commissionRate
		);
	}

	async unlistItem(ctx, itemId) {
		return await ctx.digitalAssetContract.unlistItem(itemId);
	}

	async updatePrice(ctx, itemId, newPrice) {
		return await ctx.digitalAssetContract.updatePrice(itemId, newPrice);
	}

	async registerRequest(ctx, itemId) {
		return await ctx.digitalAssetContract.registerRequest(itemId);
	}

	async cancelRequest(ctx, buyReqId) {
		return await ctx.digitalAssetContract.cancelRequest(buyReqId);
	}

	async grantAccess(
		ctx,
		buyReqId,
		encryptedFileHash,
		encryptedSymmetricKey,
		ipfsURI
	) {
		return await ctx.digitalAssetContract.grantAccess(
			buyReqId,
			encryptedFileHash,
			encryptedSymmetricKey,
			ipfsURI
		);
	}

	async compareHashes(ctx, buyReqId, customerHash) {
		return await ctx.digitalAssetContract.compareHashes(
			buyReqId,
			customerHash
		);
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
}

module.exports = DAMContract;
