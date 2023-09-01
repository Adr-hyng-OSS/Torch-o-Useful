import config from "./config";
export * from "./config";

export * from "./functions/compare";
export * from "./functions/utils";

export * from "./classes/logger";
export * from "./classes/inventory";

//? Possible types: 
//   - string
//   - boolean
//   - number
//   - range
//   - customizableArray
//   - selectionArray
//   - customizableMap

const {
    debug,
    consumeTorchOnLit,
    excludeCustomTorch,
    igniteTNT,
    includeCustomTorch,
    prioritizeMainHand,
    torchFireEffects
} = config;

export {
    debug,
    consumeTorchOnLit,
    excludeCustomTorch,
    igniteTNT,
    includeCustomTorch,
    prioritizeMainHand,
    torchFireEffects
};
