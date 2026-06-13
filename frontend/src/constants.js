// Replace with your deployed Sepolia contract address
export const CONTRACT_ADDRESS = "0x5b0B064AB318e06d93BB41EAFF8Ba4aa3774B75f";

export const CONTRACT_ABI = [
    "function createBounty() external payable",
    "function resolveBounty(uint256 _bountyId, address payable _researcher) external",
    "function bounties(uint256) view returns (address creator, uint256 amount, bool isActive)",
    "function bountyCounter() view returns (uint256)",
    "event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount)",
    "event BountyResolved(uint256 indexed id, address indexed researcher, uint256 amount)"
];