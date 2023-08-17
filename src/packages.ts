import config from "./config";
export * from "./config";

export * from "./functions/compare";
export * from "./functions/utils";
import "./functions/vanilla_utils";

export * from "./classes/logger";
export * from "./classes/inventory";

export * from "./database";

export * from "./events/onHurt";
export * from "./events/onInteract";

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
