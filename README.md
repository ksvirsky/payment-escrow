# Payment Escrow

This project implements a basic payment escrow functionality, enabling secure transfer of funds between two parties.

---

## ⚠️ Disclaimer: Demo Project ⚠️

**This project is a demo and proof-of-concept. It has NOT been audited and is NOT suitable for production use with real funds. Use it for educational and testing purposes only.**

---

## Demo & Testing on Polygon Amoy

You can test the contract functionality using a deployed demo UI on the Polygon Amoy testnet:

* **Demo UI:** [https://ksvirsky.github.io/payment-escrow-demo/](https://ksvirsky.github.io/payment-escrow-demo/)

### Deployed Contract Addresses on Polygon Amoy:

* **PaymentEscrowFactory Address:** `0x9a91dCbf35E5a8d929970A1c81aCcAa8875764Ec`
* **Mock ERC-20 Token Contract:** `0xD629B37f222deDE7e405f2a4aA678C6423e3b9b7`

To obtain mock tokens for testing:
* Use the `mint(address, uint)` method on the Mock ERC-20 token contract.
* **Convenient Minting Tool:** [https://ksvirsky.github.io/?chainId=80002&address=0xD629B37f222deDE7e405f2a4aA678C6423e3b9b7&signature=mint%28address+a%2C+uint256+amount%29&args=0xYourAddress%2C+1000000000000000000000000&mode=write](https://ksvirsky.github.io/?chainId=80002&address=0xD629B37f222deDE7e405f2a4aA678C6423e3b9b7&signature=mint%28address+a%2C+uint256+amount%29&args=0xYourAddress%2C+1000000000000000000000000&mode=write)
    *(Remember to replace `0xYourAddress` in the `args` with your actual Polygon Amoy wallet address when using the tool.)*

---

## Implementation

### V1

The `PaymentEscrowFactory` contract facilitates the creation of `PaymentEscrow` contracts. A `PaymentEscrow` contract is initiated by Party A for a specified target, Party B.

#### Core Flows:

##### 1. Normal Flow (Successful Payment)

This flow represents a successful payment from Party A to Party B.

1.  **Contract Configuration & Funding:** Party A deploys the `PaymentEscrow` contract and transfers the agreed-upon tokens to it.
2.  **Payment Condition:** Party B awaits for the `paymentDelay` period to elapse. Alternatively, Party A can call `confirmPayment()` to immediately enable Party B's withdrawal, bypassing the delay.
3.  **Withdrawal:** After the `paymentDelay` has passed or explicit confirmation by Party A, Party B can withdraw all tokens from the contract.

##### 2. Cancel Payment Flow (by Party A)

This flow allows Party A to cancel the payment before Party B can withdraw.

1.  **Contract Configuration & Funding:** Party A deploys the `PaymentEscrow` contract and transfers the agreed-upon tokens to it.
2.  **Cancellation Initiation:** During the `paymentDelay` period, Party A invokes the `cancelPayment()` function to initiate a cancellation.
3.  **Cancellation Condition:** Party A waits for the `cancelDelay` period to elapse. Alternatively, Party B can call `confirmCancelPayment()` to immediately allow Party A to withdraw the funds, bypassing the delay.
4.  **Withdrawal:** After the `cancelDelay` has passed or explicit confirmation by Party B, Party A can withdraw all tokens from the contract.

##### 3. Disputable Flow (Dispute Resolution)

This flow is initiated if Party B disputes Party A's cancellation of payment.

1.  **Dispute Initiation:** This flow begins when Party B calls the `dispute()` function during Party A's `cancelDelay` period (from the Cancel Payment Flow, step 3).
2.  **Party B's Waiting Period:** Party B must wait for the `disputeDelay` period to elapse. After this period, Party B can withdraw the funds.
3.  **Party A's Re-dispute:** Party A can then re-dispute by calling `dispute()` again. Party A must then wait for another `disputeDelay` period to elapse to regain the ability to withdraw the funds.
4.  **Flow Termination:** The disputable flow concludes when either Party A or Party B chooses not to re-dispute, allowing the other party to withdraw the funds. Alternatively, the flow can be terminated if Party A calls `confirmPayment()` (leading to Party B's withdrawal) or if Party B calls `confirmCancelPayment()` (leading to Party A's withdrawal).

#### Configuration Parameters:

Each `PaymentEscrow` contract is created with the following configurable parameters:

* `targetAddress`: The account address of Party B.
* `paymentDelay`: The duration (in seconds) after which Party B is allowed to withdraw funds in the normal flow.
* `cancelDelay`: The duration (in seconds) that defines the waiting period for Party A to withdraw funds after initiating a payment cancellation.
* `disputeDelay`: The duration (in seconds) that each party must wait during the disputable flow after initiating a dispute or re-dispute.

#### `PaymentEscrow` Contract Functions & Features:

1.  **Token Acceptance:** The contract is designed to accept any amount of ERC-20 or other transferable tokens directly transferred to it. While it's assumed Party A will transfer tokens, the contract's design doesn't restrict token transfers from any other account.
2.  **`confirmPayment()`:** Allows Party A to confirm the payment, enabling Party B to withdraw the funds immediately, bypassing the `paymentDelay`.
3.  **`confirmCancelPayment()`:** Allows Party B to confirm Party A's payment cancellation, enabling Party A to withdraw the funds immediately, bypassing the `cancelDelay`.
4.  **`withdraw(address token, uint256 amount)`:** This function facilitates token withdrawals:
    * **For Party B:** When `paymentDelay` has elapsed, or `confirmPayment()` has been called.
    * **For Party A:** When `cancelDelay` has elapsed, or `confirmCancelPayment()` has been called (after a payment cancellation).
    * **For Either Party:** When the corresponding party's `disputeDelay` has elapsed in the disputable flow.
5.  **`cancelPayment()`:** Allows Party A to initiate a cancellation of the payment.
6.  **`dispute()`:** Allows either Party A or Party B to dispute an ongoing payment cancellation or re-dispute, respectively, extending the dispute resolution process.

---

## Roadmap

1.  **Upgradeable Factory:** Implement an upgradeable factory contract to enable the creation of `PaymentEscrow` contracts of different versions, facilitating future enhancements.
2.  **Third-Party Arbiter:** Introduce a neutral third party to resolve disputes, enhancing fairness and reducing reliance on the current disputable flow's "last party standing" mechanism.
3.  **Native Token Support:** Add support for using the native blockchain token (e.g., Ether on Ethereum) in payments, alongside ERC-20 tokens.
4.  **Multi-Payment Escrow:** Extend the escrow contract to support multiple payments to the same or different parties within a single escrow instance.

---

## Getting Started

To interact with this project, use the following commands:

```shell
npm run test                  # Run all unit tests
REPORT_GAS=true npm run test  # Run tests and generate a gas usage report

npx hardhat node              # Start a local Hardhat network node
npm run deploy:test           # Deploy contracts to test chain using Hardhat Ignition
