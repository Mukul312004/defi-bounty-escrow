// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BountyEscrow {
    // The trusted address (e.g., GitHub Actions CI wallet) that verifies exploits
    address public oracle; 

    struct Bounty {
        address creator;
        uint256 amount;
        bool isActive;
    }

    mapping(uint256 => Bounty) public bounties;
    uint256 public bountyCounter;

    event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount);
    event BountyResolved(uint256 indexed id, address indexed researcher, uint256 amount);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Unauthorized: Only the CI Oracle can resolve bounties");
        _;
    }

    constructor(address _oracle) {
        oracle = _oracle;
    }

    /**
     * @dev Creates a new bounty and locks the sent ETH in the contract.
     */
    function createBounty() external payable {
        require(msg.value > 0, "Bounty amount must be greater than 0");

        bountyCounter++;
        uint256 currentId = bountyCounter;

        bounties[currentId] = Bounty({
            creator: msg.sender,
            amount: msg.value,
            isActive: true
        });

        emit BountyCreated(currentId, msg.sender, msg.value);
    }

    /**
     * @dev Called exclusively by the CI Oracle upon successful exploit verification.
     * @param _bountyId The ID of the bounty to resolve.
     * @param _researcher The address of the researcher submitting the valid PoE.
     */
    function resolveBounty(uint256 _bountyId, address payable _researcher) external onlyOracle {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.isActive, "Bounty is not active or already resolved");
        require(bounty.amount > 0, "No funds available for this bounty");

        // Update state before external call to prevent reentrancy
        bounty.isActive = false;
        uint256 payout = bounty.amount;
        bounty.amount = 0;

        // Release funds to researcher
        (bool success, ) = _researcher.call{value: payout}("");
        require(success, "ETH transfer failed");

        emit BountyResolved(_bountyId, _researcher, payout);
    }
}