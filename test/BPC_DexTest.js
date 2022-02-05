const { expectEvent, expectRevert, singletons, constants, BN } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const { expect, assert } = require('chai');
const { should } = require('chai').should();

const BPC = artifacts.require('BPC');

contract('Dex BPC - Exchanges', ([registryFunder, creator, other_user, operator, managing_account, company_account]) => {

    let amount = new BN('42');
    const initialSupply = new BN('10000000000000000000000');
    const maxSupply     = new BN('20000000000000000000000');
    const name = 'BigPictureToken';
    const symbol = 'BPC';
    const data = web3.utils.sha3('BPC_TestData');
    const operatorData = web3.utils.sha3('BPC_TestOperatorData');

    context('Supply Volume', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPC.new(name, symbol, [operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
        });

        it('Minting additional Tokens', async () => {
            let balance = await this.token.totalSupply({from: other_user});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '10000', "Should be equal to 10 - initial supply");

            await this.token.mint('5000000000000000000000', {from: company_account});

            balance = await this.token.totalSupply({from: other_user});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '15000', "Should be equal to 15 - initial supply + minted");

            balance = await this.token.balanceOf(company_account, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '15000', "Should be equal to 15 - same as a supply");

        });

        it('Reverting on unauthorized Minting Attempt', async () => {
            await expectRevert.unspecified(
                this.token.mint('1000000000000000000000', {from: managing_account})); //+1000
        });

        it('Reverting on Minting Attempt that exceeds Max Supply', async () => {
            await expectRevert(this.token.mint('15000000000000000000000', {from: company_account}) //+15000
            , "Amount that is about to be minted reaches the Max Supply");
        });

        it('Checking Balance after Burn Attempt', async () => {
            let balance = await this.token.balanceOf(company_account, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '15000', "Should be equal to 15 after prev tests");

            const empty_bytes = web3.utils.asciiToHex("");
            await this.token.burn('5000000000000000000000', empty_bytes, {from: company_account});

            balance = await this.token.totalSupply({from: other_user});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '10000', "Should be equal to 10 after a burn of 5");

            balance = await this.token.balanceOf(company_account, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '10000', "Should be equal to 10 after a burn of 5");
        });

        it('Checking Balance after Burn Attempt', async () => {
            const empty_bytes = web3.utils.asciiToHex("");

            await this.token.send(other_user, '3000000000000000000000', empty_bytes, {from: company_account});

            let balance = await this.token.balanceOf(company_account, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '7000', "Should be equal to 7 after prev tests: 10 - 3");

            balance = await this.token.balanceOf(other_user, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '3000', "Should be equal to 3: 0 + 3");

            await this.token.burn('2000000000000000000000', empty_bytes, {from: other_user});

            balance = await this.token.balanceOf(company_account, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '7000', "Should be equal to 7 - no change because of User's Balance burn");

            balance = await this.token.balanceOf(other_user, {from: company_account});
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance, '1000', "Should be equal to 1: 3 - 2");
        });
    });

    context('From Ether to Tokens', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPC.new(name, symbol, [operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
        });

        it('Contract balance should starts with 0 ETH', async () => {
            let balance = await web3.eth.getBalance(this.token.address);
            assert.equal(balance, 0);
        });

        //minter transaction - non-systematic test, see Reverting on Wrong Balances
        it('Reverting on Minter tries to extract complete Balance', async () => {
            let free_float = await this.token.balanceOf(company_account);
            assert.equal(free_float.toString(), '10000000000000000000000');

            // Sells tokens for 42 ether
            await expectRevert(
                this.token.fromTokensToEther(free_float, {from: company_account}),
                "BPC Owner doesn't have enough funds to accept this sell request");

            free_float = await this.token.balanceOf(company_account);
            assert.equal(free_float, '10000000000000000000000');

        });

        it('Basic Convertion', async () => {
            let updated_amount = await web3.utils.fromWei(amount, 'wei');

            // Send 42 ether to the contract.
            // `fromEtherToTokens` is a payable method.
            await this.token.fromEtherToTokens({from: other_user, value: updated_amount});

            // Check the contract balance.
            let contractBalance = await web3.eth.getBalance(this.token.address);
            contractBalance = await web3.utils.fromWei(contractBalance, 'wei');

            assert.equal(contractBalance, updated_amount);

            const free_float = await this.token.balanceOf(company_account);
            assert.equal(free_float.toString(), '9999999999999999995800');

            const user_balance = await this.token.balanceOf(other_user);
            assert.equal(user_balance.toString(), '4200');
        });

        it('Reverting on Wrong Balances', async () => {
            let updated_amount = new BN('20000000000000000000000');

            await expectRevert(
                this.token.fromEtherToTokens({from: other_user, value: 0}),
                'You need to send some more ether, what you provide is not enough for transaction -- Reason given: You need to send some more ether, what you provide is not enough for transaction.'
            );

            await expectRevert(
                this.token.fromEtherToTokens({from: other_user, value: updated_amount}),
                'Not enough tokens in the reserve'
            );
        });

    });

    context('From Tokens to Ether', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPC.new(name, symbol, [operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
        });

        it('Basic Conversion', async () => {
            // Send 42 ether to the contract.
            // `fromEtherToTokens` is a payable method.
            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.token.fromEtherToTokens({from: other_user, value: updated_amount});

            let user_token_balance = await this.token.balanceOf(other_user);
            assert.equal(user_token_balance.toString(), '4200');
            updated_amount = new BN (user_token_balance.toString());

            let token_ether_balance = await web3.eth.getBalance(this.token.address);
            token_ether_balance = await web3.utils.fromWei(token_ether_balance, 'wei');
            assert.equal(token_ether_balance, '42');

            // Sells tokens for 42 ether
            await this.token.fromTokensToEther(updated_amount, {from: other_user});

            token_ether_balance = await web3.eth.getBalance(this.token.address);
            token_ether_balance = await web3.utils.fromWei(token_ether_balance, 'wei');
            assert.equal(token_ether_balance, '0');

            const free_float = await this.token.balanceOf(company_account);
            assert.equal(free_float, '10000000000000000000000');

            user_token_balance = await this.token.balanceOf(other_user);
            assert.equal(user_token_balance.toString(), '0');
        });

        it('Reverting on Wrong Balances', async () => {
            let user_token_balance = await this.token.balanceOf(other_user);
            assert.equal(user_token_balance.toString(), '0');

            let updated_amount = new BN ('4200');

            await expectRevert(
                this.token.fromTokensToEther(0, {from: other_user}),
                'You need to sell at least some tokens'
            );

            await expectRevert(
                this.token.fromTokensToEther(updated_amount, {from: other_user}),
                'Your balance is lower than the amount of tokens you want to sell'
            );
        });
    });

    context('Views', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPC.new(name, symbol, [operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
        });

        it('Token Price view', async () => {
            let price = await this.token.getTokenPrice();
            assert.equal(price, 100); //assuming such variable set manually in the contract body
        });
    });

    context('Entry / Exit Fees', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPC.new(name, symbol, [operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
        });

        it('Toggle Entry Fee', async () => {
            const before = await this.token.getEntryFee({from: other_user});
            assert.equal(before.toString(), "0");

            await this.token.setEntryFee(5, {from: managing_account});

            const after = await this.token.getEntryFee({from: other_user});
            assert.equal(after.toString(), "5");
        });

        it('Apply Entry Fee', async () => {
            const after = await this.token.getEntryFee({from: other_user});
            assert.equal(after.toString(), "5");

            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.token.fromEtherToTokens({from: other_user, value: updated_amount});

            const free_float = await this.token.balanceOf(company_account);
            assert.equal(free_float.toString(), '9999999999999999996010');

            const user_balance = await this.token.balanceOf(other_user);
            assert.equal(user_balance.toString(), '3990');
        });

        it('Toggle Exit Fee', async () => {
            const before = await this.token.getExitFee({from: other_user});
            assert.equal(before.toString(), "0");

            await this.token.setExitFee(5, {from: managing_account});

            const after = await this.token.getExitFee({from: other_user});
            assert.equal(after.toString(), "5");
        });

        it('Apply Exit Fee', async () => {
            let user_token_balance = await this.token.balanceOf(other_user);
            assert.equal(user_token_balance.toString(), '3990');
            let updated_amount = new BN (user_token_balance.toString());

            let token_ether_balance = await web3.eth.getBalance(this.token.address);
            token_ether_balance = await web3.utils.fromWei(token_ether_balance, 'wei');
            assert.equal(token_ether_balance.toString(), '42');

            // Sells tokens for 42 ether
            await this.token.fromTokensToEther(updated_amount, {from: other_user});

            token_ether_balance = await web3.eth.getBalance(this.token.address);
            token_ether_balance = await web3.utils.fromWei(token_ether_balance, 'wei');
            assert.equal(token_ether_balance.toString(), '5'); //todo: this one is complicated, don't fully understand that
        });
    });
});
