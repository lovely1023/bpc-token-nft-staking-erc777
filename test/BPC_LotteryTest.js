const { expectEvent, expectRevert, singletons, constants, BN } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = constants;
const {assert, expect, to, not } = require('chai');
const { should } = require('chai').should();

const BPC = artifacts.require('BPC');
const ExternalFuncs = artifacts.require('ExternalFuncs');
const BPCLottery = artifacts.require('BPCLottery');


contract('BPC Lottery Functionality', ([registryFunder, creator, other_user, operator, managing_account, company_account]) => {
// 000000000000000000
    const amount = new BN('42000000000000000000');
    const initialSupply = new BN('10000000000000000000000');
    const maxSupply     = new BN('20000000000000000000000');

    const name = 'BigPictureToken';
    const symbol = 'BPC';

    context('Basics', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Check that basic BPC is successfully deployed', async () => {
            const symbol = await this.bpc.symbol();
            const name = await this.bpc.name();
            const initSupply = '10000000000000000000000';
            const totalSupply = await this.bpc.totalSupply();
            const adminBalance = await this.bpc.balanceOf(company_account);

            assert.equal(symbol, "BPC", "Check symbol");
            assert.equal(name, "BigPictureToken", "Check name");
            assert.equal(totalSupply.toString(), initSupply, `Total supply should be ${initSupply}!`);
            assert.equal(adminBalance.toString(), initSupply, 'Initial supply should be allocated to admin account!');
        });

        it('Check that BPC Lottery is successfully deployed', async () => {
            const symbol = await this.token.symbol();
            const name = await this.token.name();

            assert.equal(symbol, "BPCL", "Check symbol");
            assert.equal(name, "BPCLottery", "Check name");
        });

        it('Attempt to Set another ERC777 token', async () => {
            expectRevert(
                this.token.setERC777(this.bpc.address, {from:managing_account})
                , "You have already set BPC address, can't do it again"
            );
        });

        it('Check operatorship - Lottery can operate BPC user balances', async () => {
            (await this.bpc.isOperatorFor(this.token.address, creator)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, other_user)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, managing_account)).should.equal(true);
            (await this.bpc.isOperatorFor(this.token.address, company_account)).should.equal(true);
        });
    });

    context('Ticket Price', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Get and Set ticket Price successfully', async () => {
            let ticket_price = await this.token.getTicketPrice({from:other_user});
            ticket_price = await web3.utils.fromWei(ticket_price, 'ether');
            assert.equal(ticket_price, '5', "Should be equal to 5 - default value");

            await this.token.setTicketPrice('12000000000000000000', {from:managing_account})
            ticket_price = await this.token.getTicketPrice({from:other_user});
            ticket_price = await web3.utils.fromWei(ticket_price, 'ether');
            assert.equal(ticket_price, '12', "Should be equal to 12 - correct new value");
        });

        it('Reverting on a wrong caller', async () => {
            expectRevert(
                this.token.setTicketPrice('12000000000000000000', {from:other_user})
                ,"Ownable: caller is not the owner");
        });
    });

    context('Tickets', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Creating Users initial balances in Tokens', async () => {
            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            await this.bpc.fromEtherToTokens({from: operator, value: updated_amount});

            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4200');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1600');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4200');
        });

        it('Reverting on Wrong Ticket price multiple', async () => {
            expectRevert(
                this.token.buyTicket('42000000000000000000', other_user, {from:other_user})
                , "Tokens amount should be a multiple of a Ticket Price");

            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            assert.equal(count.toString(), '0');
        });

        it('Reverting on Not enough Tokens', async () => {
            expectRevert(
                this.token.buyTicket('5000000000000000000000', other_user, {from:other_user}) //initial balance is ~4200
                ,"You should have enough of Tokens in your Wallet");
        });

        it('Getting Current Lottery Pot - Zero', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');
        });

        it('Getting Zero tickets quantity', async () => {
            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            count = await web3.utils.fromWei(count, 'ether');
            assert.equal(count.toString(), '0');

            count = await this.token.getCurrentLotteryTicketsCount(company_account, {from:company_account});
            count = await web3.utils.fromWei(count, 'ether');
            assert.equal(count.toString(), '0');

            count = await this.token.getCurrentLotteryTicketsCount(operator, {from:operator});
            count = await web3.utils.fromWei(count, 'ether');
            assert.equal(count.toString(), '0');
        });

        it('Successfully buying Tickets, checking Quantities', async () => {
            // https://stackoverflow.com/questions/67803090/how-to-get-erc-721-tokenid
            // const t_user = await this.token.buyTicket('5000000000000000000', {from:other_user});
            // console.log(JSON.stringify(t_user, null, 4));
            await this.token.buyTicket('5000000000000000000', other_user, {from:other_user});
            await this.token.buyTicket('5000000000000000000', company_account, {from:company_account});
            await this.token.buyTicket('5000000000000000000', operator, {from:operator});

            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            assert.equal(count.toString(), '1');

            count = await this.token.getCurrentLotteryTicketsCount(company_account, {from:company_account});
            assert.equal(count.toString(), '1');

            count = await this.token.getCurrentLotteryTicketsCount(operator, {from:operator});
            assert.equal(count.toString(), '1');
        });

        it('Checking Balances After ticket purchase', async () => {
            let balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4195');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '1595');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4195');

            let lottery_balance = await this.bpc.balanceOf(this.token.address);
            lottery_balance = await web3.utils.fromWei(lottery_balance, 'ether');
            assert.equal(lottery_balance.toString(), '15');
        });

        it('Getting Updated Current Lottery Pot after the Tickets were purchased', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '15');
        });

        it('Buying Tickets on Reentrance', async () => {
            await this.token.buyTicket('5000000000000000000', other_user, {from:other_user});
            await this.token.buyTicket('5000000000000000000', company_account, {from:company_account});
            await this.token.buyTicket('5000000000000000000', operator, {from:operator});

            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            assert.equal(count.toString(), '2');

            count = await this.token.getCurrentLotteryTicketsCount(company_account, {from:company_account});
            assert.equal(count.toString(), '2');

            count = await this.token.getCurrentLotteryTicketsCount(operator, {from:operator});
            assert.equal(count.toString(), '2');
        });

        it('Getting Updated Current Lottery Pot after the Reentrance', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '30');
        });

        it('Buying Multiple Tickets on Reentrance', async () => {
            await this.token.buyTicket('15000000000000000000', other_user, {from:other_user});
            await this.token.buyTicket('25000000000000000000', company_account, {from:company_account});
            await this.token.buyTicket('50000000000000000000', operator, {from:operator});

            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            assert.equal(count.toString(), '5');

            count = await this.token.getCurrentLotteryTicketsCount(company_account, {from:company_account});
            assert.equal(count.toString(), '7');

            count = await this.token.getCurrentLotteryTicketsCount(operator, {from:operator});
            assert.equal(count.toString(), '12');
        });

        it('Getting Updated Current Lottery Pot after the Reentrance', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '120');
        });

    });

    context('Announcing results', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});
        });

        it('Reverting on ongoing Lottery', async () => {
            expectRevert(
                this.token.announceWinnerAndRevolve({from:managing_account})
                , "The current lottery is still running");
        });

        it('Forcing to close an ongoing Lottery', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            const l_id_1 = await this.token.getCurrentLotteryId({from:other_user});
            await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

            const l_id_2 = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id_2.toNumber(), l_id_1.toNumber() + 1, "Next Lottery Id should start with id++");

            balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');
        });

        it('Reverting on wrong caller', async () => {
            expectRevert(
                this.token.announceWinnerAndRevolve({from:other_user})
                ,"Ownable: caller is not the owner");

            expectRevert(
                this.token.forceAnnounceWinnerAndRevolve({from:other_user})
                ,"Ownable: caller is not the owner");

        });

        it('Reverting on Attempt to get a Winner on absent Lottery Id', async () => {
            expectRevert(
                this.token.getWinner('42', {from:other_user})
                ,"Lottery Id Winner or Lottery Id not found");
        });

        describe('Odd Pot', function () {
            before(async () => {
                this.erc1820 = await singletons.ERC1820Registry(registryFunder);
                this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
                await this.token.transferOwnership(managing_account, {from: creator});
                this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                    maxSupply,
                    initialSupply,
                    0, 0,
                    managing_account, company_account,
                    {from:creator});
                await this.token.setERC777(this.bpc.address, {from:managing_account});
            });

            it('Announcing Winner and Revolving, checking Lottery Ids', async () => {

                let balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '0');

                await this.bpc.fromEtherToTokens({from: other_user, value: '30000000000000000000'}); //30 ETG
                await this.bpc.fromEtherToTokens({from: operator, value: '30000000000000000000'});
                await this.bpc.fromEtherToTokens({from: creator, value: '30000000000000000000'});
                await this.token.buyTicket('5000000000000000000', other_user, {from:other_user});
                await this.token.buyTicket('5000000000000000000', creator, {from:creator});
                await this.token.buyTicket('5000000000000000000', operator, {from:operator});

                balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '15');

                await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

                balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '0');
            });

            it('Checking Balances after Lottery is completed', async () => {
                let l_id = await this.token.getCurrentLotteryId({from:other_user});
                l_id = l_id.toNumber() - 1;
                assert.equal(l_id.toString(), '0');

                const winner_address = await this.token.getWinner(l_id.toString(), {from:other_user});
                let balance = await this.bpc.balanceOf(winner_address.toString());
                balance = await web3.utils.fromWei(balance, 'ether');

                if (winner_address == creator) {
                    assert.equal(balance.toString(), '3002.5');

                    balance = await this.bpc.balanceOf(other_user);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(operator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1007.5');
                }
                else if (winner_address == other_user) {
                    assert.equal(balance.toString(), '3002.5');

                    balance = await this.bpc.balanceOf(creator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(operator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1007.5');
                }
                else {
                    assert.equal(balance.toString(), '3002.5');

                    balance = await this.bpc.balanceOf(other_user);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(creator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2995');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1007.5');
                }
            });
        });

        describe('Even Pot', function () {
            before(async () => {
                this.erc1820 = await singletons.ERC1820Registry(registryFunder);
                this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
                await this.token.transferOwnership(managing_account, {from: creator});
                this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                    maxSupply,
                    initialSupply,
                    0, 0,
                    managing_account, company_account,
                    {from:creator});
                await this.token.setERC777(this.bpc.address, {from:managing_account});
            });

            it('Announcing Winner and Revolving, checking Lottery Ids', async () => {
                await this.token.setTicketPrice('12000000000000000000', {from:managing_account})
                let ticket_price = await this.token.getTicketPrice({from:other_user});
                ticket_price = await web3.utils.fromWei(ticket_price, 'ether');
                assert.equal(ticket_price, '12', "Should be equal to 12 - correct new value");

                let balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '0');

                await this.bpc.fromEtherToTokens({from: other_user, value: '30000000000000000000'}); //30 ETH
                await this.bpc.fromEtherToTokens({from: operator, value: '30000000000000000000'});
                await this.bpc.fromEtherToTokens({from: creator, value: '30000000000000000000'});
                await this.token.buyTicket('12000000000000000000', other_user, {from:other_user}); //12 BPC
                await this.token.buyTicket('12000000000000000000', creator, {from:creator});
                await this.token.buyTicket('12000000000000000000', operator, {from:operator});

                balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '36');

                await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

                balance = await this.token.getCurrentLotteryPot();
                balance = await web3.utils.fromWei(balance, 'ether');
                assert.equal(balance.toString(), '0');
            });

            it('Checking Balances after Lottery is completed', async () => {
                let l_id = await this.token.getCurrentLotteryId({from:other_user});
                l_id = l_id.toNumber() - 1;
                assert.equal(l_id.toString(), '0');

                const winner_address = await this.token.getWinner(l_id.toString(), {from:other_user});
                let balance = await this.bpc.balanceOf(winner_address.toString());
                balance = await web3.utils.fromWei(balance, 'ether');

                if (winner_address == creator) {
                    assert.equal(balance.toString(), '3006');

                    balance = await this.bpc.balanceOf(other_user);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(operator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1018');
                }
                else if (winner_address == other_user) {
                    assert.equal(balance.toString(), '3006');

                    balance = await this.bpc.balanceOf(creator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(operator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1018');
                }
                else {
                    assert.equal(balance.toString(), '3006');

                    balance = await this.bpc.balanceOf(other_user);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(creator);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '2988');

                    balance = await this.bpc.balanceOf(this.token.address);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '0');

                    balance = await this.bpc.balanceOf(company_account);
                    balance = await web3.utils.fromWei(balance, 'ether');
                    assert.equal(balance.toString(), '1018');
                }
            });
        });
    });

    context('Pause / Unpause', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});

            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            await this.token.buyTicket('20000000000000000000', other_user, {from:other_user});
        });

        it('Checking that Lottery is there', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '20');

            let l_id = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id.toString(), '0');
        });

        it('Reverting on Attempt to Pause by Unauthorized user', async () => {
            expectRevert(
                this.token.pause ({from:other_user})
                ,"Ownable: caller is not the owner");

            assert.isNotOk(await this.token.paused({from:other_user}), "Should not be on pause");
        });

        it('Reverting on Attempt to Unpause a Lottery that is NOT Paused', async () => {
            expectRevert.unspecified(this.token.unPause({from:managing_account}));
            assert.isNotOk(await this.token.paused({from:other_user}), "Should not be on pause");
        });

        it('Putting to Pause by Contract Owner', async () => {
            await this.token.pause({from:managing_account});
            assert.isOk(await this.token.paused({from:other_user}), "Should be on pause");
        });

        it('Checking that Lottery is not functioning while on Pause', async () => {
            expectRevert(
                this.token.getTicketPrice({from:other_user}),
                "Lottery is paused, please come back later");

            expectRevert(
                this.token.buyTicket("5000000000000000000", other_user, {from:other_user}),
                "Lottery is paused, please come back later");

            expectRevert(
                this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user}),
                "Lottery is paused, please come back later");
        });

        it('Checking TransferOwnership while on Pause', async () => {
            await this.token.transferOwnership(creator, {from: managing_account});
            expectRevert(
                this.token.unPause ({from:managing_account})
                ,"Ownable: caller is not the owner");

            await this.token.transferOwnership(managing_account, {from: creator});

            expectRevert(
                this.token.unPause ({from:creator})
                ,"Ownable: caller is not the owner");

            assert.isOk(await this.token.paused({from:other_user}), "Should be on pause");

        });

        it('Closing Lottery while on Pause, checking balances', async () => {
            //before creates just one user
            let l_id1 = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id1.toString(), '0');

            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '20');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4180');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5800');

            await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

            balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4190');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5810');

            let l_id2 = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id2.toString(), l_id1.toString());
        });

        it('Reverting on Attempt to Unpause by Unauthorized user', async () => {
            expectRevert(
                this.token.unPause ({from:other_user})
                ,"Ownable: caller is not the owner");

            assert.isOk(await this.token.paused({from:other_user}), "Should be on pause");
        });

        it('Checking Unpause', async () => {
            await this.token.unPause({from:managing_account});
            assert.isNotOk(await this.token.paused({from:other_user}), "Should not be on pause");
        });

        it('Checking Balances and manual start of a new Lottery after Unpause', async () => {
            let l_id1 = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id1.toString(), "0");

            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4190');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5810');

            await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

            balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4190');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5810');

            let l_id2 = await this.token.getCurrentLotteryId({from:other_user});
            assert.equal(l_id2.toString(), "1"); //next lottery has been started with no effects on balances from prev one
        });

    });

    context('Using SC by the Operators', function () {
        before(async () => {
            this.erc1820 = await singletons.ERC1820Registry(registryFunder);
            this.token = await BPCLottery.new("BPCLottery", "BPCL", 0, company_account, {from:creator}); //if it is '0', then it is coverted to 5 BPC
            await this.token.transferOwnership(managing_account, {from: creator});
            this.bpc = await BPC.new(name, symbol, [this.token.address, operator],
                maxSupply,
                initialSupply,
                0, 0,
                managing_account, company_account,
                {from:creator});
            await this.token.setERC777(this.bpc.address, {from:managing_account});

            let updated_amount = await web3.utils.fromWei(amount, 'wei');
            await this.bpc.fromEtherToTokens({from: other_user, value: updated_amount});
            await this.bpc.authorizeOperator(operator, {from:other_user});
        });

        it('Buying new Tickets by Operator', async () => {
            await this.token.buyTicket('10000000000000000000', other_user, {from:operator});
            let count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:operator});
            assert.equal(count.toString(), '2');
        });

        it('Reverting on Attempt of Buying new Tickets by non-Operator', async () => {
            expectRevert(
                this.token.buyTicket('20000000000000000000', other_user, {from:managing_account})
                , "You MUST be an operator for participant");

            const count = await this.token.getCurrentLotteryTicketsCount(other_user, {from:other_user});
            assert.equal(count.toString(), '2');
        });

        it('Reverting on Attempt of Getting Tickets quantity by non-Operator', async () => {
            expectRevert(
                this.token.getCurrentLotteryTicketsCount(other_user, {from:managing_account})
                , "You MUST be an operator for participant");
        });

        it('Announcing Winner and Revolving, checking Participant and Operator balances', async () => {
            let balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '10');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4190');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5800');

            await this.token.forceAnnounceWinnerAndRevolve({from:managing_account});

            balance = await this.token.getCurrentLotteryPot();
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(other_user);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '4195');

            balance = await this.bpc.balanceOf(operator);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '0');

            balance = await this.bpc.balanceOf(company_account);
            balance = await web3.utils.fromWei(balance, 'ether');
            assert.equal(balance.toString(), '5805');
        });
    });
});
