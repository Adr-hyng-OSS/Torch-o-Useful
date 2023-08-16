import config from "./config";
export * from "./config";

export * from "./functions/compare";
export * from "./functions/utils";

export * from "./classes/logger";
export * from "./classes/inventory";

const {
    debug,
    igniteTNT,
    excludeCustomTorch,
    includeCustomTorch,
    torchFireEffects,
    prioritizeMainHand,
    consumeTorchOnLit,
} = config;

export {
    debug, 
    igniteTNT, 
    excludeCustomTorch, 
    includeCustomTorch, 
    torchFireEffects, 
    prioritizeMainHand, 
    consumeTorchOnLit
};
