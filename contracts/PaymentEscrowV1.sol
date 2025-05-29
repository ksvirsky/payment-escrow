// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PaymentEscrowV1 is Initializable {
    string public constant VERSION = "1.0.0";
    string public constant NAME = "PaymentEscrow";

    enum State {
        Pending,            // Initial state, awaiting payment confirmation
        PaymentConfirmed,   // Party A has confirmed the payment
        CancelPaymentPending,   // Party A has cancelled the payment
        CancelPaymentConfirmed, // Party B has confirmed the cancellation
        DisputedByPartyA,   // The payment is under dispute by Party A
        DisputedByPartyB    // The payment is under dispute by Party B
    }

    State public state;
    uint256 public stateChangedAt;

    address public partyA;
    address public partyB;
    uint256 public paymentDelay;
    uint256 public cancelDelay;
    uint256 public disputeDelay;

    uint256[50] private __gap;

    event StateChanged(State newState);

    error NotAuthorizedError();
    error IncorrectStateError();

    function __PaymentEscrow_init(
        address _creator,
        address _target,
        uint256 _paymentDelay,
        uint256 _cancelDelay,
        uint256 _disputeDelay
    ) initializer public {
        state = State.Pending;
        stateChangedAt = block.timestamp;

        partyA = _creator;
        partyB = _target;
        paymentDelay = _paymentDelay;
        cancelDelay = _cancelDelay;
        disputeDelay = _disputeDelay;
    }

    function confirmPayment() external {
        if (msg.sender != partyA) {
            revert NotAuthorizedError();
        }

        if (state == State.PaymentConfirmed || state == State.CancelPaymentConfirmed) {
            revert IncorrectStateError();
        }

        state = State.PaymentConfirmed;
        stateChangedAt = block.timestamp;

        emit StateChanged(state);
    }

    function cancelPayment() external {
        if (msg.sender != partyA) {
            revert NotAuthorizedError();
        }

        if (state != State.Pending) {
            revert IncorrectStateError();
        }

        state = State.CancelPaymentPending;
        stateChangedAt = block.timestamp;

        emit StateChanged(state);
    }

    function confirmCancelPayment() external {
        if (msg.sender != partyB) {
            revert NotAuthorizedError();
        }

        if (state == State.PaymentConfirmed || state == State.CancelPaymentConfirmed) {
            revert IncorrectStateError();
        }

        state = State.CancelPaymentConfirmed;
        stateChangedAt = block.timestamp;

        emit StateChanged(state);
    }

    function dispute() external {
        if (msg.sender == partyB && (
            state == State.CancelPaymentPending && (stateChangedAt + cancelDelay > block.timestamp) ||
            state == State.DisputedByPartyA && (stateChangedAt + disputeDelay > block.timestamp))) {
            state = State.DisputedByPartyB;
            stateChangedAt = block.timestamp;

            emit StateChanged(state);
            return;
        }

        if (msg.sender == partyA && (
            state == State.DisputedByPartyB && (stateChangedAt + disputeDelay > block.timestamp))) {
            state = State.DisputedByPartyA;
            stateChangedAt = block.timestamp;

            emit StateChanged(state);
            return;
        }

        revert NotAuthorizedError();
    }

    function withdraw(address token, uint256 amount) external {
        if (msg.sender == partyB && (
            state == State.PaymentConfirmed ||
            state == State.Pending && (stateChangedAt + paymentDelay <= block.timestamp) ||
            state == State.DisputedByPartyB && (stateChangedAt + disputeDelay <= block.timestamp))) {

            IERC20(token).transfer(partyB, amount);

            return;
        }

        if (msg.sender == partyA && (
            state == State.CancelPaymentConfirmed ||
            state == State.CancelPaymentPending && (stateChangedAt + cancelDelay <= block.timestamp) ||
            state == State.DisputedByPartyA && (stateChangedAt + disputeDelay <= block.timestamp))) {

            IERC20(token).transfer(partyA, amount);

            return;
        }

        revert NotAuthorizedError();
    }
}
