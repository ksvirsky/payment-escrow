// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./PaymentEscrowV1.sol";

contract PaymentEscrowFactory is OwnableUpgradeable {
    mapping (uint256 => address) public escrowBeacons;

    error NoBeaconFoundError(uint256 version);

    event EscrowCreated(
        address indexed escrowAddress,
        uint256 version,
        address creator,
        address target,
        uint256 paymentDelay,
        uint256 cancelDelay,
        uint256 disputeDelay
    );
    event EscrowBeaconSet(uint256 version, address beacon);

    function __PaymentEscrowFactory_init(address initialOwner) initializer public {
        __Ownable_init(initialOwner);
    }

    function setEscrowBeacon(uint256 version, address beacon) external onlyOwner {
        escrowBeacons[version] = beacon;

        emit EscrowBeaconSet(version, beacon);
    }

    function createEscrow(uint256 version, address target, uint256 paymentDelay, uint256 cancelDelay, uint256 disputeDelay) external {
        address escrowAddress;

        if (escrowBeacons[version] == address(0)) {
            revert NoBeaconFoundError(version);
        }

        bytes memory data = abi.encodeCall(
            PaymentEscrowV1.__PaymentEscrow_init,
            (msg.sender, target, paymentDelay, cancelDelay, disputeDelay)
        );

        BeaconProxy proxy = new BeaconProxy(escrowBeacons[version], data);
        escrowAddress = address(proxy);

        emit EscrowCreated(escrowAddress, version, msg.sender, target, paymentDelay, cancelDelay, disputeDelay);
    }
}
