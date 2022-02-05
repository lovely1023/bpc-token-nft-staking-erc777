# Notes on the BPC's smart contracts implementation

## General notes
- Separate accounts for managing Smart Contracts
- Wallet accounts (company accounts) for all three Smart Contracts MUST be set upon deployment as arguments for SC constructors. As per Client's idea there should be two accounts - one for Staking and another one for Token and Lottery

## Notes on deployment
The order of the deployment is:
- Staking or Lottery
- BPC Token

BPC Token must have both Staking and Lottery indicated as default Operators (ERC777 feature), therefore it goes last

After deployment is done:
- Ownership (admin accounts) for Staking and Lottery MUST be set - requires immediate transaction as part of a deployment, otherwise contracts' management will be kept for deployer address 
- Both Lottery and Staking must recieve a link for ERC777 token - requires immediate transaction as part of a deployment 

## Token
- Token price is set 100 BPC per 1 Ether.
- Minting is allowed up to Max Supply, that is set upon deployment
- No mechanism to change Max Supply
- Minting is allowed for CompanyAccount only - see notes on Wallet accounts above
- Withdraw: from Token to Ether using Wallet account (company_account provided at the time of creation)
- No mechanism to change that account in future
- Contract is not pausable - can't be put on hold

## Staking
- APY Rate is expressed in hundredth of percents, represent monthly rate used for compound.
- There is no safety check for APY rate to set. One can set any value, ie apply a yearly rate, instead of monthly. 
- Staking Cap is introduced in accordance with Client's requirement
- On withdrawal: Client's idea to have it 25%, 50% and 75% depending on the holding period faces Solidity limitations. Namely, for 75% we use '*3/4' formula, that may result in rounding. Although, Client's limitations on the amounts allowed should prevent such situation
- Year is considered as 360 days
- Month is considered as 30 days
- No reserves management is implemented - Client's Co will have to maintain reserves by itself, ie in case of erroneous APY_rate setup
- Contract is not pausable - can't be put on hold

## Lottery
- Transaction is initiated on the Contract's owner side, therefore to be paid by the owner
- Lottery can be stopped any time, winner will be paid if there is at least one participant
- Lottery has unlimited participation as well as multiple tickets purchases
- Lottery is able to be put on pause


## IMPORTANT
- There were functions in Staking contract introduced for testing ONLY. They MUST be commented before deploy.
