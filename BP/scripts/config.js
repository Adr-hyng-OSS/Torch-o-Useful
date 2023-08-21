export default {
    debug: true,
    igniteTNT: false,
    includeCustomTorch: ["minecraft:soul_torch"],
    excludeCustomTorch: ["minecraft:torch"],
    prioritizeMainHand: true,
    consumeTorchOnLit: true,
    rangeTest: {
        "from": 1,
        "to": 10
    },
    selectionTest: {
        "selection": ["OPTION 1", "OPTION 2"]
    },
    torchFireEffects: {
        "minecraft:torch": 40,
        "minecraft:soul_torch": 60,
        "minecraft:redstone_torch": 40,
        "custom_namespace:custom_torch": 40
    },
};
export const VERSION = "1.0.0";
