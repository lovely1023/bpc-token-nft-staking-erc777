// SPDX-License-Identifier: MIT

// from https://solidity-by-example.org/app/iterable-mapping/
pragma solidity ^0.8.0;

    struct Stake {
        address account_owner;
        uint256 timestamp;
        uint256 stake;
    }


library IterableMapping {

    // Iterable mapping from address to uint;
    struct Map {
        uint[] keys;
        mapping(uint => Stake) values;
        mapping(uint => uint) indexOf;
        mapping(uint => bool) inserted;
    }

    function get(Map storage map, uint stake_id) public view returns (Stake memory) {
        return map.values[stake_id];
    }

    function getKeyAtIndex(Map storage map, uint index) public view returns (uint) {
        return map.keys[index];
    }

    function size(Map storage map) public view returns (uint) {
        return map.keys.length;
    }

    function set(Map storage map, uint stake_id, Stake memory stake ) public {
        if (map.inserted[stake_id]) {
            map.values[stake_id] = stake;
        } else {
            map.inserted[stake_id] = true;
            map.values[stake_id] = stake;
            map.indexOf[stake_id] = map.keys.length;
            map.keys.push(stake_id);
        }
    }

    function empty (Map storage map) public view returns (bool) {
        return size(map) == 0;
    }

    function remove(Map storage map, uint stake_id) public {
        if (!map.inserted[stake_id]) {
            return;
        }

        delete map.inserted[stake_id];
        delete map.values[stake_id];

        uint index = map.indexOf[stake_id];
        uint lastIndex = map.keys.length - 1;
        uint lastKey = map.keys[lastIndex];

        map.indexOf[lastKey] = index;
        delete map.indexOf[stake_id];

        map.keys[index] = lastKey;
        map.keys.pop();
    }
}

contract TestIterableMap {
    using IterableMapping for IterableMapping.Map;

    IterableMapping.Map private map;

    function testIterableMap() public {
        /*
        Stake stake;

        map.set(address(0), 0);
        map.set(address(1), 100);
        map.set(address(2), 200); // insert
        map.set(address(2), 200); // update
        map.set(address(3), 300);

        for (uint i = 0; i < map.size(); i++) {
            address key = map.getKeyAtIndex(i);

            assert(map.get(key) == i * 100);
        }

        map.remove(address(1));

        // keys = [address(0), address(3), address(2)]
        assert(map.size() == 3);
        assert(map.getKeyAtIndex(0) == address(0));
        assert(map.getKeyAtIndex(1) == address(3));
        assert(map.getKeyAtIndex(2) == address(2));
        */
    }
}
