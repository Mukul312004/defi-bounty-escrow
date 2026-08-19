// Replace with your deployed Sepolia contract address
export const CONTRACT_ADDRESS = "0xF1d74CC50C1Fd533438FFADa8981E221C17d2531";

export const CONTRACT_ABI = [
    "function createBounty() external payable",
    "function resolveBounty(uint256 _bountyId, address payable _researcher) external",
    "function bounties(uint256) view returns (address creator, uint256 amount, bool isActive)",
    "function bountyCounter() view returns (uint256)",
    "event BountyCreated(uint256 indexed id, address indexed creator, uint256 amount)",
    "event BountyResolved(uint256 indexed id, address indexed researcher, uint256 amount)"
];