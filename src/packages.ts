import config from "./config";
export * from "./config";
export * from "./logger";
export * from "./functions/compare";
export * from "./functions/utils";

const {
    debug,
    igniteTNT,
    excludeCustomTorch,
    includeCustomTorch,
    torchFireEffects,
    prioritizeMainHand
} = config;


export {debug, igniteTNT, excludeCustomTorch, includeCustomTorch, torchFireEffects, prioritizeMainHand};
