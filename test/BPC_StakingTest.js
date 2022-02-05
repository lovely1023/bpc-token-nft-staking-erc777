const { expectEvent, expectRevert, singletons, constants, BN } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const {assert, expect, to } = require('chai');
const { should } = require('chai').should();

const BPC = artifacts.require('BPC');
const IterableMapping = artifacts.require('IterableMapping');
const ExternalFuncs = artifacts.require('ExternalFuncs');
const BPCStaking = artifacts.require('BPCStaking');

contract('BPC Staking Functionality', ([registryFunder, creator, other_user, operator, managing_account, company_account]) => {

    // 000000000000000000
    const amount = new BN('42000000000000000000');
    const initialSupply = new BN('10000000000000000000000');
    const maxSupply     = new BN('20000000000000000000000');
    const name = 'BigPictureToken';
    const symbol = 'BPC';

    context('Contracts basic checks', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 100, '10000000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, creator,
                {from:creator});

            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Check that basic BPC is successfully deployed', async () => {
            const symbol = await this.bpc.symbol();
            const name = await this.bpc.name();
            const initSupply = '10000000000000000000000';
            const totalSupply = await this.bpc.totalSupply();
            const adminBalance = await this.bpc.balanceOf(creator);

            assert.equal(symbol, "BPC", "Check symbol");
            assert.equal(name, "BigPictureToken", "Check name");
            assert.equal(totalSupply.toString(), initSupply, `Total supply should be ${initSupply}!`);
            assert.equal(adminBalance.toString(), initSupply, 'Initial supply should be allocated to admin account!');
        });

        it('Check that BPC Staking is successfully deployed', async () => {
            const symbol = await this.token.symbol();
            const name = await this.token.name();

            assert.equal(symbol, "BPCS", "Check symbol");
            assert.equal(name, "BPCStaking", "Check name");
        });

        it('Attempt to Set another ERC777 token', async () => {
            expectRevert(
                this.token.setERC777(this.bpc.address, {from:managing_account})
                , "You have already set BPC address, can't do it again"
            );
        });

        it('Check operatorship', async () => {
            (await this.bpc.isOperatorFor(this.token.address, creator)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, other_user)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, managing_account)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, company_account)).should.equal(true);

        });
    });

    context('Staking', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 100, '10000000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, creator,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        //stake, getStake, getUserStakedBalance
        it('Attempt to Stake - Reverting on wrong Stake size', async () => {
            expectRevert(
                this.token.stake('42', other_user, {from: other_user})
                , "Only predefined stake sizes are allowed"
            );
        });

        it('Attempt to Stake - Reverting on Tokens balance deficit', async () => {
            expectRevert(
                this.token.stake('5000000000000000000000', other_user, {from: other_user})
                ,"Not enough tokens in the wallet"
            );
        });

        it('Getting allowed Stake sizes', async () => {
            const sizes = await this.token.getAllowedStakeSizes ({from: other_user});
            assert.equal(sizes[0], "Please don't forget to add decimals - *10^18 multiple; Allowed Stake sizes are:");
        });

        it('Creating Users initial balance in Tokens', async () => {
            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            let user_balance = await this.bpc.balanceOf(other_user);
            assert.equal(user_balance.toString(), '4200000000000000000000');

            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            user_balance = await this.bpc.balanceOf(other_user);
            assert.equal(user_balance.toString(), '8400000000000000000000');

            user_balance = await this.bpc.balanceOf(creator);
            assert.equal(user_balance.toString(), '1600000000000000000000');
        });

        it('Successful Staking', async () => {
            await this.token.stake('5000000000000000000000', other_user, {from: other_user});
            let user_balance = await this.bpc.balanceOf(other_user);
            assert.equal(user_balance.toString(), '3400000000000000000000');
            user_balance = await this.bpc.balanceOf(this.token.address);
            assert.equal(user_balance.toString(), '5000000000000000000000');

            await this.token.stake('3000000000000000000000', other_user, {from: other_user});
            user_balance = await this.bpc.balanceOf(other_user);
            assert.equal(user_balance.toString(), '400000000000000000000');
            user_balance = await this.bpc.balanceOf(this.token.address);
            assert.equal(user_balance.toString(), '8000000000000000000000');

            await this.token.stake('1000000000000000000000', creator, {from: creator});
            user_balance = await this.bpc.balanceOf(creator);
            assert.equal(user_balance.toString(), '600000000000000000000');
            user_balance = await this.bpc.balanceOf(this.token.address);
            assert.equal(user_balance.toString(), '9000000000000000000000');

        });

        it('Getting Stake Ids', async () => {
            const stake_ids = await this.token.getStakeIds( {from: other_user});
            const {0:fst, 1:snd} = stake_ids;
            assert.equal(fst.toString(), '1');
            assert.equal(snd.toString(), '2');
        });

        it('Getting Particular Stake', async () => {
            const stake = await this.token.getStake('1', {from: other_user});
            const {0:address, 1:timestamp, 2:stake_volume} = stake;
            assert.equal(address.toString(), other_user);
            assert.equal(stake_volume.toString(), '5000000000000000000000');
        });

        it('Revering Particular Stake for no Id', async () => {
            expectRevert(
                this.token.getStake('42', {from: other_user})
                , "No stake with such Id");
        });

    });

    context('Rates and Interest', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 100, '10000000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, creator,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Reverting while Setting Rate by unauthorized user', async () => {
            expectRevert.unspecified(this.token.setRate('200', {from: other_user}));
        });

        it('Set Rate, Get Rate', async () => {
            let rate = await this.token.getRate({from:other_user});
            assert.equal(rate.toString(), '100');

            await this.token.setRate('200', {from: managing_account})

            rate = await this.token.getRate({from:other_user});
            assert.equal(rate.toString(), '200');
        });

        it('Get Compound Periods count', async () => {
            let periods = await this.token.testPeriodCompoundCount("60", {from: managing_account});
            let {0: period1, 1: period_count1} = periods;
            assert.equal(period1.toString(), '30');
            assert.equal(period_count1.toString(), '2');

            periods = await this.token.testPeriodCompoundCount("10", {from: managing_account});
            let {0: period2, 1: period_count2} = periods;
            assert.equal(period2.toString(), '30');
            assert.equal(period_count2.toString(), '0');

            periods = await this.token.testPeriodCompoundCount("124", {from: managing_account});
            let {0: period3, 1: period_count3} = periods;
            assert.equal(period3.toString(), '30');
            assert.equal(period_count3.toString(), '4');
        });

        it('Rate accumulates correctly', async () => {
            await this.token.setRate('500', {from: managing_account}); //5%
            let interest = await this.token.testCompound("100000000000000000000", "12", {from: managing_account}); //100 * 10^18, for 12 periods
            interest = await web3.utils.fromWei(interest, 'ether');
            assert.equal(interest.toString(), '79.585632602212914946');

            await this.token.setRate('200', {from: managing_account}); //2%
            interest = await this.token.testCompound("100000000000000000000", "37", {from:managing_account}); //100 * 10^18, for 37 periods
            interest = await web3.utils.fromWei(interest, 'ether');
            assert.equal(interest.toString(), '108.068509059001835307');
        });
    });

    context('Withdrawing', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 500, '10000000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, creator,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Creating Users initial balance in Tokens and Staking - prepare for Withdraw', async () => {
            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            await this.token.stake('1000000000000000000000', other_user, {from: other_user});
            await this.token.stake('1000000000000000000000', other_user, {from: other_user});
            await this.token.stake('1000000000000000000000', other_user, {from: other_user});
            await this.token.stake('1000000000000000000000', other_user, {from: other_user});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '200');

            await this.bpc.fromEtherToTokens({from: operator, value: updated_amount});
            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4200');

            const stake_ids = await this.token.getStakeIds( {from: other_user});
            const {0:fst, 1:snd, 2:trd, 3:fth} = stake_ids;
            assert.equal(fst.toString(), '1');
            assert.equal(snd.toString(), '2');
            assert.equal(trd.toString(), '3');
            assert.equal(fth.toString(), '4');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');
        });

        it('Withdrawing existing Stake - 25%', async () => {
            await this.token.withdrawStake('1', other_user, {from: other_user});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '450'); //200 + 1000/4

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '3000'); //4000 - 1000

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1600'); //10000-4200 -4200 = 1600;

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '750'); //0 + 750 = 750;
        });

        it('Withdrawing existing Stake - 50%', async () => {
            //to get a holding period > 360 and < 720 for stake 2
            await this.token.testAmendStakeTimestampForWithdraw('400', '2', other_user, {from: managing_account});

            await this.token.withdrawStake('2', other_user, {from: other_user});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '950'); //450 + 1000/2

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '2000'); //3000 - 1000

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1600'); //1600

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1250'); //750 + 500 = 1250;
        });

        it('Withdrawing existing Stake - 75%', async () => {
            //to get a holding period > 720 and < 1080 for stake 3
            await this.token.testAmendStakeTimestampForWithdraw('800', '3', other_user, {from: managing_account});

            await this.token.withdrawStake('3', other_user, {from: other_user});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1700'); //950 + 1000/4*2

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1000'); //2000 - 1000

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1600'); //1600

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1500'); //1250 + 250 = 1500;
        });

        it('Withdrawing existing Stake - 100% and interest; Revering on Balance deficit', async () => {
            //to get a holding period > 1080 and < 1080 for stake 4
            await this.token.testAmendStakeTimestampForWithdraw('1100', '4', other_user, {from: managing_account});

            expectRevert(
                this.token.withdrawStake('4', other_user, {from: other_user})
                , "Not enough tokens in main Wallet"
            );
        });

        it('Withdrawing existing Stake - 100% and interest', async () => {
            //to get a holding period > 1080 and < 1080 for stake 4 - already Ok

            //piling up needed balane to pay out interest
            await this.token.stake('1000000000000000000000', other_user, {from: other_user});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '700'); //1700 - 1000

            await this.token.stake('3000000000000000000000', operator, {from: operator});
            await this.token.stake('1000000000000000000000', operator, {from: operator});
            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '200');

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '6000'); //

            let rate = await this.token.getRate({from:other_user});
            assert.equal(rate.toString(), '500');

            await this.token.withdrawStake('4', other_user, {from: other_user});
            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '6491.816135971860477393'); //700 + 5791,816136

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '208.183864028139522607'); //6000 - 5791,816136

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1600'); //1600

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1500'); //1500;
        });

        it('Reverting while Making Withdraw for incorrect Stake Id', async () => {
            expectRevert(
                this.token.withdrawStake('1', other_user, {from: other_user})
                , "This is stake Id is not valid or was already withdrawn"
            );
            expectRevert(
                this.token.withdrawStake('12', other_user, {from: other_user})
                , "This is stake Id is not valid or was already withdrawn"
            );
        });

        it('Reverting while Making Withdraw for User with no Stakes', async () => {
            expectRevert(
                this.token.withdrawStake('2', managing_account, {from: managing_account})
                , "This user has staked nothing"
            );
        });
    });

    context('Staking Limit', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            //5%, 2500
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 100, '2500000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                "40000000000000000000000",
                "20000000000000000000000",
                0, 0,
                managing_account, creator,
                {from:creator});

            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Check that basic BPC is successfully deployed', async () => {
            const initSupply = '20000000000000000000000';
            const totalSupply = await this.bpc.totalSupply();
            const adminBalance = await this.bpc.balanceOf(creator);
            assert.equal(totalSupply.toString(), initSupply, `Total supply should be ${initSupply}!`);
            assert.equal(adminBalance.toString(), initSupply, 'Initial supply should be allocated to admin account!');
        });

        it('Reverting on Stake Limit', async () => {
            await this.bpc.fromEtherToTokens({from: managing_account, value: '126000000000000000000'}); //126 Ether
            let balance = await this.bpc.balanceOf(managing_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '12600');

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '7400');

            expectRevert(
                this.token.stake('10000000000000000000000', managing_account, {from: managing_account})
                , " If made your stake would exceed allowed stake limit of: 2500000000000000000000"
            );
        });
    });

    context('Operatorship', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            //5%, 10000
            this.token = await BPCStaking.new("BPCStaking", "BPCS", 100, '10000000000000000000000', company_account, {from:creator});
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                "40000000000000000000000",
                "20000000000000000000000",
                0, 0,
                managing_account, creator,
                {from:creator});

            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Check that basic BPC is successfully deployed', async () => {
            const initSupply = '20000000000000000000000';
            const totalSupply = await this.bpc.totalSupply();
            const adminBalance = await this.bpc.balanceOf(creator);
            assert.equal(totalSupply.toString(), initSupply, `Total supply should be ${initSupply}!`);
            assert.equal(adminBalance.toString(), initSupply, 'Initial supply should be allocated to admin account!');
        });

        it('Making and checking operators', async () => {
            await this.bpc.authorizeOperator(operator, {from: other_user});
            assert.isOk(this.bpc.isOperatorFor(operator, other_user, {from: creator}), `Should be an operator`);

            // assert.isNotOk(this.bpc.isOperatorFor(other_user, operator, {from: creator}), `Should NOT be an operator`);
        });

        it('Creating Users initial balance in Tokens and Staking - prepare for Operatorship check', async () => {
            let updated_amount = await web3.utils.fromWei(amount, 'wei');

            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4200');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(managing_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(creator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '15800');
        });

        it('Reverting on Staking attempt by unauthorized Operator', async () => {
            expectRevert(
                this.token.stake('3000000000000000000000', other_user, {from: managing_account})
                , "You MUST be an operator for staking address"
            );
        });

        it('Staking by Operator', async () => {
            await this.token.stake('3000000000000000000000', other_user, {from: operator});

            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1200');

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '3000');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');
        });

        it('Reverting on Withdrawing attempt by unauthorized Operator', async () => {
            expectRevert(
                this.token.withdrawStake('1', other_user, {from: managing_account})
                , "You MUST be an operator for address you try to withdraw from"
            );
        });

        it('Withdrawing by Operator', async () => {
            await this.token.withdrawStake('1', other_user, {from: operator});

            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1950'); //1200 + 25% * 3000

            balance = await this.bpc.balanceOf(this.token.address);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '2250');
        });
    });
});
