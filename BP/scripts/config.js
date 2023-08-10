export default {
  /**
   * Enables debug messages to content logs.
   */
  debug: true,
  /**
   * Toggle for igniting the tnt, similar to Fire Aspect behavior.
   */
  igniteTNT: false,
  /**
   * This makes custom torches that doesn't endswith: 
   * .*_torch or .*torch 
   * be included too.
   * List of included Custom Torch, since it only accepts any torches that endswith: *.torch or .*_torch 
   * Example: 
   *  - minecraft:torch
   *  - minecraft:soul_torch
   *  - minecraft:redstone_torch
   *  - any_custom:torch
   *  - any:_torch
   */
  includeCustomTorch: [],
  /**
   * List of Custom or Vanilla torches to exclude.
   * Example: 
   *  - minecraft:soul_torch
   *  - .*_torch
   *  - any_custom:torch
   */
  excludeCustomTorch: [],
  /**
   * Map of torch effects to apply. 
   * (i.g Torch: 40 ticks, Soul Torch: 60 ticks)
   */
  torchFireEffects: {'minecraft:torch': 40, 'minecraft:soul_torch': 100, 'minecraft:redstone_torch': 40, 'custom_namespace:custom_torch': 40},
  /**
   * Prioritize mainhand over offhand. If false, it will prioritize offhand over mainhand.
   */
  prioritizeMainHand: false,
};

// version (do not change)
export const VERSION = "1.0.0";