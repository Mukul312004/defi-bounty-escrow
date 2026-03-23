import os
import sys
import json
import argparse
from web3 import Web3

# The exact flag hidden in our vulnerable Flask app
TARGET_FLAG = "flag{sql_injection_success}"

# Minimal ABI containing only the resolveBounty function we need to call
CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "_bountyId", "type": "uint256"},
            {"internalType": "address payable", "name": "_researcher", "type": "address"}
        ],
        "name": "resolveBounty",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

def trigger_payout(bounty_id, researcher_address):
    print(f"\n[Oracle] Connecting to Sepolia to release funds for Bounty #{bounty_id}...")
    
    # Load credentials from GitHub Secrets (injected as Env Vars in Step 5)
    rpc_url = os.environ.get("RPC_URL")
    private_key = os.environ.get("ORACLE_PRIVATE_KEY")
    contract_address = os.environ.get("CONTRACT_ADDRESS")

    if not all([rpc_url, private_key, contract_address]):
        print("❌ CRITICAL: Missing blockchain credentials in environment variables.")
        sys.exit(1)

    # Initialize Web3
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        print("❌ CRITICAL: Failed to connect to the Sepolia RPC URL.")
        sys.exit(1)

    # Setup Account and Contract
    oracle_account = w3.eth.account.from_key(private_key)
    contract = w3.eth.contract(address=contract_address, abi=CONTRACT_ABI)
    
    # Ensure checksummed addresses
    checksum_researcher = w3.to_checksum_address(researcher_address)
    
    try:
        # 1. Build the transaction
        nonce = w3.eth.get_transaction_count(oracle_account.address)
        tx = contract.functions.resolveBounty(int(bounty_id), checksum_researcher).build_transaction({
            'chainId': 11155111, # Sepolia Chain ID
            'gas': 200000,       # Gas limit buffer
            'gasPrice': w3.eth.gas_price,
            'nonce': nonce,
        })

        # 2. Sign the transaction with the Oracle's private key
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)

        # 3. Broadcast it to the network
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        print(f"[Oracle] Transaction broadcasted! Hash: {w3.to_hex(tx_hash)}")
        
        # 4. Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if receipt.status == 1:
            print("✅ SUCCESS: Smart contract executed. Funds released to researcher!")
        else:
            print("❌ FAILED: Transaction reverted on the blockchain.")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ FAILED: Blockchain error occurred: {str(e)}")
        sys.exit(1)

def verify_exploit(output_file, bounty_id, researcher_address):
    print(f"[CI] Reading exploit output from {output_file}...")
    
    if not os.path.exists(output_file):
        print("❌ FAILED: Exploit output file not found. Did the Docker container crash?")
        sys.exit(1)

    try:
        with open(output_file, 'r') as f:
            result = json.load(f)
            
        print(f"[CI] Parsed output: {result}")
        
        # Validate the specific structure our CI expects
        if result.get("success") is True and result.get("flag") == TARGET_FLAG:
            print("✅ VALID PoE: Correct flag extracted!")
            trigger_payout(bounty_id, researcher_address)
        else:
            print("❌ INVALID PoE: Incorrect flag or exploit failed.")
            sys.exit(1)
            
    except json.JSONDecodeError:
        print("❌ FAILED: Exploit did not output valid JSON.")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Oracle Verification Script")
    parser.add_argument("--bounty_id", required=True, help="ID of the bounty to resolve")
    parser.add_argument("--researcher", required=True, help="Wallet address to receive the funds")
    parser.add_argument("--output_file", required=True, help="JSON file containing the exploit results")
    
    args = parser.parse_args()
    verify_exploit(args.output_file, args.bounty_id, args.researcher)