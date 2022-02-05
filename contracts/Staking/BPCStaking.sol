// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "../BPC/BPC.sol";
import "../BPC/BPCSenderRecipient.sol";
import "./IterableMapping.sol";
import "./ExternalFuncs.sol";

contract BPCStaking is ERC777SenderRecipientMock, Ownable, ReentrancyGuard {
    using IterableMapping for IterableMapping.Map;
    using ExternalFuncs for *;
    using SafeMath for uint256;

    string private m_name;
    string private m_symbol;
    address private m_company_account;

    IERC777 private m_bpc;
    bool private m_bpc_is_set;

    mapping(address => IterableMapping.Map) private m_staked_balances;
    uint256 private m_APY_rate;
    uint256 private m_period_duration;
    uint256 private m_stake_limit;

    modifier isTokenSet() {
        require(address(m_bpc) != address(0), "ERC777 is not set");
        _;
    }

    event Staked(uint256 amount);
    event Withdrawn(uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _rate,
        uint256 _stake_limit,
        address _company_account) {

        m_name = _name;
        m_symbol = _symbol;
        m_company_account = _company_account;
        _erc1820.setInterfaceImplementer(address(this), _TOKENS_RECIPIENT_INTERFACE_HASH, address(this));

        m_APY_rate = _rate;
        m_stake_limit = _stake_limit;
        m_period_duration = 30 days / 1 days;

        m_bpc_is_set = false;
    }

    function setERC777 (address _bpc) public onlyOwner {
        require (!m_bpc_is_set, "You have already set BPC address, can't do it again");
        m_bpc = IERC777(_bpc);
        m_bpc_is_set = true;
    }

    function name () public view returns (string memory) {
        return m_name;
    }

    function symbol () public view returns (string memory) {
        return m_symbol;
    }

    function getAllowedStakeSizes () public pure returns (string[10] memory) {
        string[10] memory output = [
        "Please don't forget to add decimals - *10^18 multiple; Allowed Stake sizes are:",
        "1'000", "3'000", "5'000", "10'000", "20'000", "50'000", "100'000", "250'000", ">=1'000'000"
        ];
        return output;
    }

    function getStakingLimit () public view returns (uint256) {
        return m_stake_limit;
    }

    function stake(uint256 bpc_tokens, address addr_from) public isTokenSet {
        //todo: exchange 18 for decimals, currently is a plugin
        require(ExternalFuncs.isStakeSizeOk(bpc_tokens, 18),
            ExternalFuncs.getErrorMsg("Only predefined stake sizes are allowed: ", bpc_tokens));

        require (m_bpc.isOperatorFor(msg.sender, addr_from), "You MUST be an operator for staking address");

        require(bpc_tokens <= m_bpc.balanceOf(addr_from),
            ExternalFuncs.getErrorMsg("Not enough tokens in the wallet: ", m_bpc.balanceOf(msg.sender)));

        uint256 expected_balance = bpc_tokens.add(m_bpc.balanceOf(address(this)));
        require(expected_balance <= m_stake_limit,
            ExternalFuncs.getErrorMsg("If made your stake would exceed allowed stake limit of: ", m_stake_limit));

        m_bpc.operatorSend(addr_from, address(this), bpc_tokens, bytes(''), bytes(''));

        emit Staked(bpc_tokens);

        Stake memory new_stake;
        new_stake.account_owner = addr_from;
        new_stake.timestamp = ExternalFuncs.Today();
        new_stake.stake = bpc_tokens;

        uint256 new_stake_id = IterableMapping.size(m_staked_balances[addr_from]) + 1;
        IterableMapping.set(m_staked_balances[addr_from], new_stake_id, new_stake);
    }

    function getStakeIds () public view returns (uint[] memory) {
        require(isUserOk(msg.sender), "This user has staked nothing");
        return m_staked_balances[msg.sender].keys;
    }

    function getStake(uint256 _stake_id) public view returns (Stake memory) {
        require(isUserOk(msg.sender), "This user has staked nothing");
        require(m_staked_balances[msg.sender].inserted[_stake_id], "No stake with such Id");
        return IterableMapping.get(m_staked_balances[msg.sender], _stake_id);
    }

    function withdrawStake(uint256 _stake_id, address addr_for) public nonReentrant isTokenSet {
        require (m_bpc.isOperatorFor(msg.sender, addr_for), "You MUST be an operator for address you try to withdraw from");

        require(isUserOk(addr_for), "This user has staked nothing");
        require(isStakeIdOk(addr_for, _stake_id), "This is stake Id is not valid or was already withdrawn");

        Stake memory current_stake = IterableMapping.get(m_staked_balances[addr_for], _stake_id);

        require(addr_for == current_stake.account_owner, "Withdrawal is allowed for Stake owners only");

        uint256 amount_to_withdraw = 0;
        uint256 company_share = 0;

        //get amount to withdraw in accordance with Client's buisness logic
        amount_to_withdraw += getValueToWithdraw(current_stake);

        //if amount is not cut, add up Interest Accrued
        if (amount_to_withdraw == current_stake.stake) {
            amount_to_withdraw += getAccruedInterest(current_stake); }
        else {
            company_share = current_stake.stake.sub(amount_to_withdraw);
        }

        //check that it is enough tokens in Staking at all
        require (amount_to_withdraw <= m_bpc.balanceOf(address(this)), "Not enough tokens in main Wallet");

        m_bpc.operatorSend(address(this), addr_for, amount_to_withdraw, bytes(''), bytes(''));
        if (company_share != 0){
            m_bpc.operatorSend(address(this), m_company_account, company_share, bytes(''), bytes(''));
        }

        emit Withdrawn(amount_to_withdraw);

        //clear the stake
        IterableMapping.remove(m_staked_balances[addr_for], _stake_id);
    }

    function setRate (uint256 new_APY_rate) public onlyOwner isTokenSet {
        m_APY_rate = new_APY_rate;
    }

    function getRate () public view returns (uint256) {
        return m_APY_rate;
    }

    function getPeriodForCompound (uint256 timestamp) private view returns (uint256) {
        require (ExternalFuncs.Today() >= timestamp, "Check submitted timestamp, seems it is not expressed in \"days\"");
        uint256 n_periods = (ExternalFuncs.Today().sub(timestamp)).div(m_period_duration);
        return n_periods;
    }

    function getAccruedInterest (Stake memory current_stake) private view returns (uint256) {
        uint256 n_periods = getPeriodForCompound(current_stake.timestamp);
        uint256 interest = ExternalFuncs.compound(current_stake.stake, m_APY_rate, n_periods).sub(current_stake.stake);

        return interest;
    }

    function getValueToWithdraw (Stake memory current_stake) private view returns (uint256) {
        require (ExternalFuncs.Today() >= current_stake.timestamp, "Check submitted timestamp, seems it is not expressed in \"days\"");

        uint256 holding_period = ExternalFuncs.Today().sub(current_stake.timestamp);

        if      (holding_period <=  360) return current_stake.stake.div(4);         //25%
        else if (holding_period <=  720) return current_stake.stake.div(2);         //50%
        else if (holding_period <= 1080) return current_stake.stake.div(4).mul(3);  //75%
        else                             return current_stake.stake;
    }

    function isUserOk(address _user) private view returns (bool)  {
        return !IterableMapping.empty(m_staked_balances[_user]);
    }

    function isStakeIdOk(address _user, uint256 _stake_id) private view returns (bool) {
        return m_staked_balances[_user].inserted[_stake_id];
    }

    //todo: for testing only, MUST be deleted before deploy
    function testCompound (uint principal, uint n) public view onlyOwner returns (uint256) {
        return ExternalFuncs.compound(principal, m_APY_rate, n).sub(principal);
    }

    //todo: for testing only, MUST be deleted before deploy
    function testPeriodCompoundCount (uint256 diff) public view onlyOwner returns (uint256, uint256) {
        uint256 timestamp = ExternalFuncs.Today().sub(diff);
        uint256 n_periods = getPeriodForCompound(timestamp);
        return (m_period_duration, n_periods);
    }

    //todo: for testing only, MUST be deleted before deploy
    function testAmendStakeTimestampForWithdraw (uint256 diff, uint256 _stake_id, address user) public onlyOwner {
        require(m_staked_balances[user].inserted[_stake_id], "No stake with such Id");
        m_staked_balances[user].values[_stake_id].timestamp = m_staked_balances[user].values[_stake_id].timestamp.sub(diff);
    }


}//!contract
