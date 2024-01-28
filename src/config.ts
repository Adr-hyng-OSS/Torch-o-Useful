export default {
  /**
   * Enables debug messages to content logs.
   */
  debug: false,
  /**
   * Toggle for igniting the tnt, similar to Fire Aspect behavior.
   */
  igniteTNT: false,
  /**
   * (Supports Regex) 
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
   * (Supports Regex) 
   * List of Custom or Vanilla torches to exclude.
   * Example: 
   *  - minecraft:soul_torch
   *  - .*_torch
   *  - any_custom:torch
   */
  excludeCustomTorch: [],
  /**
   * Prioritize mainhand over offhand. If false, it will prioritize offhand over mainhand. 
   * (Only works for Hitting Entity)
   */
  prioritizeMainHand: true,
  /**
   * Toggle for consuming the torch when lighting a campfire, candle or tnt.
   */
  consumeTorchOnLit: true,
  /**
   * Torches with their fire ticks, when you hit the mob on how many seconds to make it the mob in fire. 
   * (i.g Torch: 40 ticks, Soul Torch: 60 ticks)
   */
  torchFireEffects: {
		"minecraft:torch": 40,
		"minecraft:soul_torch": 60,
		"minecraft:redstone_torch": 40,
		"custom_namespace:custom_torch": 40
	},
};

// version (do not change)
export const VERSION = "1.0.0";