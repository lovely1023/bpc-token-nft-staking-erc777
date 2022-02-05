const {singletons, BN } = require('@openzeppelin/test-helpers');
const {assert } = require('chai');

const BPC = artifacts.require('BPC');
const IterableMapping = artifacts.require('IterableMapping');
const ExternalFuncs = artifacts.require('ExternalFuncs');
const BPCStaking = artifacts.require('BPCStaking');
const BPCLottery = artifacts.require('BPCLottery');

contract('BPC Client\'s Real Figures and Names', ([registryFunder, creator, managing_account, company_account1, company_account2]) => {

    // 000000000000000000
    const maxSupply = new BN('6639068860000000000000000000');
    const initialSupply = new BN('3319534430000000000000000000');
    const staking_limit = new BN('150000000000000000000000000');
    const APY_rate = new BN('25');
    const name = 'BigPictureToken';
    const symbol = 'BPC';

    before(async () => {
        this.erc1820 = await singletons.ERC1820Registry(registryFunder);
        this.staking = await BPCStaking.new("BPCStaking", "BPCS", APY_rate, staking_limit, company_account1, {from:creator});
        await this.staking.transferOwnership(managing_account, {from: creator});

        this.lottery = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account2, {from:creator}); //if it is '0', then it is coverted to 5 BPC
        await this.lottery.transferOwnership(managing_account, {from: creator});

        this.bpc = await BPC.new(name, symbol, [this.staking.address, this.lottery.address],
            maxSupply,
            initialSupply,
            0, 0,
            managing_account, company_account2,
            {from:creator});

        await this.staking.setERC777(this.bpc.address, {from:managing_account});
        await this.lottery.setERC777(this.bpc.address, {from:managing_account});
    });

    it('Check that basic BPC is successfully deployed', async () => {
        const symbol = await this.bpc.symbol();
        const name = await this.bpc.name();
        const totalSupply = await this.bpc.totalSupply();
        const adminBalance = await this.bpc.balanceOf(company_account2);

        assert.equal(symbol, "BPC", "Check symbol");
        assert.equal(name, "BigPictureToken", "Check name");
        assert.equal(totalSupply.toString(), initialSupply, `Total supply should be ${initialSupply}!`);
        assert.equal(adminBalance.toString(), initialSupply, 'Initial supply should be allocated to admin account!');
    });

    it('Check that BPC Staking is successfully deployed', async () => {
        const symbol = await this.staking.symbol();
        const name = await this.staking.name();

        assert.equal(symbol, "BPCS", "Check symbol");
        assert.equal(name, "BPCStaking", "Check name");
    });

    it('Check that BPC Lottery is successfully deployed', async () => {
        const symbol = await this.lottery.symbol();
        const name = await this.lottery.name();

        assert.equal(symbol, "BPCL", "Check symbol");
        assert.equal(name, "BPCLottery", "Check name");
    });

});
