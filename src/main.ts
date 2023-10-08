import { EntityDamageCause, EntityEquippableComponent, EntityInventoryComponent, EquipmentSlot, Player, TicksPerSecond, system, world } from "@minecraft/server";
import { MinecraftBlockTypes, MinecraftItemTypes } from "./modules/vanilla-types/index";
import { Compare, Logger, consumeTorchOnLit, forceSetPermutation, igniteTNT, isTorchIncluded, prioritizeMainHand, torchFireEffects } from "./packages";


const DEFAULT_EFFECTS: Map<string, number> = new Map([
  [MinecraftItemTypes.Torch.id, 40],
  [MinecraftItemTypes.SoulTorch.id, 60],
  [MinecraftItemTypes.RedstoneTorch.id, 40]
]);

const logMap: Map<string, number> = new Map<string, number>();

world.beforeEvents.itemUseOn.subscribe(async (event) => {
	// This only works for hitting the sides, and not the top or bottom of the campfire or candle.
  const _block = event.block;
  const mainHand = event.itemStack;
  const player: Player = event.source as Player;

	// If entity who itemUsed On is not a player, then return.
  if(!(player instanceof Player)) return;

	// Handle multiple execution, this adds timer or cooldown to itemUseOn.
	const oldLog: number = logMap.get(player.id);
	logMap.set(player.id, Date.now());
	if ((oldLog + 150) >= Date.now()) return;

	// Get all the permutation of the block interacted by player.
  const permutations: Map<string, string | number | boolean | undefined> = JSON.parse(JSON.stringify(_block.permutation.getAllStates()));

	// If block interacted doesn't have "lit", and "extinguished", then return, meaning it is not campfire or candle like.

  if(permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined) return;

	// Get the main, and offhand items.
	const equipment = await (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
	const offHand = equipment.getEquipment(EquipmentSlot.Offhand);
	const inventory = ((player.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent).container).setHolder(player);

	const hands = [
		{ slot: mainHand, item: mainHand },
		{ slot: offHand, item: offHand }
	];

	// Gets the hand that has torch in it.
	const torchHand = hands.find(hand => {
		if (!hand.item?.typeId) return false;
		return isTorchIncluded(hand.item?.typeId);
	});
	
	// If both hands doesn't have torch, then return.
  if(!torchHand) return;

	// For executing the onPlaceBlock event once.
	let justExecuted = false;

	//* This block handles, when you are holding a placeable items like:
	//* such as ladders, torches, blocks, etc.
	//* So, whenever that happens, then set that to air.
	//* and handle, the consume toggle configuration.
	const onBlockPlaced = world.afterEvents.playerPlaceBlock.subscribe((onPlaced) => {
		system.run(() => world.afterEvents.playerPlaceBlock.unsubscribe(onBlockPlaced));

		// When already executed, then return.
		if(justExecuted) return;
		
		const blockPlaced = onPlaced.block;
		const blockPlacePlayer = onPlaced.player;
		const blockPlacedItemStack = blockPlaced.getItemStack();


		if(!blockPlacedItemStack) return;
		if(!blockPlacePlayer) return;

		// If the block placed is not the same as the mainhand item, like for placing, then return. Since its function 
		// is to cancel blockplacement.
		if(!Compare.types.isEqual(blockPlacedItemStack?.type, mainHand?.type)) return;

		// If the source who placed a block in the world, is not the same as the player who interacted with the block in the first place, then return.
		if(!Compare.types.isEqual(blockPlacePlayer?.id, player?.id)) return;

		if(_block.type === MinecraftBlockTypes.Tnt && !igniteTNT) return;

		// cancel the blockplacement.
		blockPlaced.setType(MinecraftBlockTypes.Air);
		justExecuted = true;

		// If the blockPlaced is not a validTorch, then add it automatically to the inventory. Since it is not torch.
		// We only want to find the torch, since it's part of the config.
		if(blockPlacePlayer.isSurvival()) inventory.giveItem(blockPlacedItemStack.type, 1);

		// If the block interacted is not a campfire or candle, then return.
		if(permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined) return;
		
		
		// If the block interacted is already lit or not extinguished or has fire, then return.
		if((permutations["lit"] === true || permutations["extinguished"] === false)) return;
		
		// Else if the block interacted is not lit or extinguished, then set it to lit.
		for (const [key, value] of Object.entries(permutations)) {
			if(key === "lit" && value === false) {
				const flag: boolean = value as boolean;
				forceSetPermutation(_block, flag);
				break;
			}
			if(key === "extinguished" && value === true) {
				const flag: boolean = value as boolean;
				forceSetPermutation(_block, flag, "extinguished");
				break;
			}
			if(key === "explode_bit" && value === false && igniteTNT) {
				_block.setType(MinecraftBlockTypes.Air);
				blockPlacePlayer.dimension.spawnEntity("minecraft:tnt", _block.location);
				break;
			}
		}
		return;
	});
	// If its not a block that has "lit" or "extinguished" state, then return.
	if(permutations["lit"] === undefined && permutations["extinguished"] === undefined && permutations["explode_bit"] === undefined) return;

	// If the block is already lit or not extingueshed, then return.
	if(permutations["lit"] === true || permutations["extinguished"] === false) return;

	//* This should only work when you are interacting
	//* with the campfire, candle, or tnt.
	//* on any angle, as long as you are not holding
	//* a placeable item like ladder, torch, block, etc.
	//* Also, It will automatically extinguish the campfire, if you are holding
	//* a shovel, and you are interacting it too fast, wait for the timer.
	if(justExecuted) return;
	if(consumeTorchOnLit && player.isSurvival()) inventory.clearItem(torchHand.item.typeId, 1);	
	for (const [key, value] of Object.entries(permutations)) {
		if(key === "lit" && value === false) {
			const flag: boolean = value as boolean;
			forceSetPermutation(_block, flag);
			break;
		}
		if(key === "extinguished" && value === true) {
			const flag: boolean = value as boolean;
			forceSetPermutation(_block, flag, "extinguished");
			break;
		}
		if(key === "explode_bit" && value === false && igniteTNT) {
			_block.setType(MinecraftBlockTypes.Air);
			player.dimension.spawnEntity("minecraft:tnt", _block.location);
			justExecuted = true;
			break;
		}
	}
});

world.afterEvents.entityHurt.subscribe((event) => {
  const player: Player = event.damageSource.damagingEntity as Player;
  const cause: EntityDamageCause = event.damageSource.cause;
  const hurtedEntity = event.hurtEntity;
  if(!(player instanceof Player)) return;
  if(!hurtedEntity) return;
  if(!Compare.types.isEqual(cause, EntityDamageCause.entityAttack)) return;
  const equipment = (player.getComponent(EntityEquippableComponent.componentId) as EntityEquippableComponent);
  const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand)?.typeId;
  const offHand = equipment.getEquipment(EquipmentSlot.Offhand)?.typeId;
  if(!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true))) return;
  let handToUse = prioritizeMainHand ? mainHand : offHand;
	if(!mainHand) handToUse = offHand;
	if(!offHand) handToUse = mainHand; 
	if(!handToUse) return;
  const updatedTorchFireEffects = Object.assign({}, DEFAULT_EFFECTS, torchFireEffects);
  Object.keys(updatedTorchFireEffects).forEach((key) => {
    if (typeof updatedTorchFireEffects[key] === "number") updatedTorchFireEffects[key] = Math.round(updatedTorchFireEffects[key] / TicksPerSecond);
  });
  if (!isTorchIncluded(handToUse)) {
		handToUse = Compare.types.isEqual(handToUse, mainHand) ? offHand : mainHand;
  }
  if (isTorchIncluded(handToUse)) {
		hurtedEntity.setOnFire(updatedTorchFireEffects[handToUse] ?? 0, true);
  }
});