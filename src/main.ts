import { Compare, Logger, isTorchIncluded, torchFireEffects, prioritizeMainHand, consumeTorchOnLit, CContainer } from "./packages";
import {Block, BlockPlaceAfterEvent, EntityDamageCause, EntityEquipmentInventoryComponent, EntityInventoryComponent, EquipmentSlot, MinecraftBlockTypes, MinecraftItemTypes, Player, TicksPerSecond, system, world} from "@minecraft/server";

const logMap: Map<string, number> = new Map<string, number>();
const onBlockPlacedLogMap: Map<string, number> = new Map<string, number>();

const DEFAULT_EFFECTS: Map<string, number> = new Map([
  [MinecraftItemTypes.torch.id, 40],
  [MinecraftItemTypes.soulTorch.id, 60],
  [MinecraftItemTypes.redstoneTorch.id, 40]
]);


//! Create Configuration for, when you lighting the blocks the Fire Aspect can light to consume torch or not.

function forceSetPermutation(_block: Block, flag: boolean, state: string = "lit"){
  const perm = _block.permutation.withState(state, !flag);
  system.run(() => _block.setPermutation(perm));
}

world.afterEvents.entityHurt.subscribe((event) => {
  const player: Player = event.damageSource.damagingEntity as Player;
  const cause: EntityDamageCause = event.damageSource.cause;
  const hurtedEntity = event.hurtEntity;
  if(!(player instanceof Player)) return;
  if(!hurtedEntity) return;
  if(!Compare.types.isEqual(cause, EntityDamageCause.entityAttack)) return;
  const equipment = (player.getComponent(EntityEquipmentInventoryComponent.componentId) as EntityEquipmentInventoryComponent);
  const mainHand = equipment.getEquipment(EquipmentSlot.mainhand)?.typeId;
  const offHand = equipment.getEquipment(EquipmentSlot.offhand)?.typeId;
  if(!([isTorchIncluded(mainHand), isTorchIncluded(offHand)].some(hand => hand === true))) return;
  let handToUse = prioritizeMainHand ? mainHand : offHand;
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

// Since you can't trigger itemUseOn with a hand, try using entityHit instead.

world.beforeEvents.itemUseOn.subscribe(async (event) => {
	// This only works for hitting the sides, and not the top or bottom of the campfire or candle.
  const _block = event.block;
  const mainHand = event.itemStack;
  const player: Player = event.source as Player;
  if(!(player instanceof Player)) return;

	const oldLog: number = logMap.get(player.id);
	logMap.set(player.id, Date.now());
	if ((oldLog + 150) >= Date.now()) return;

	Logger.warn("TEST EXECUTE")

  const permutations: Map<string, string | number | boolean | undefined> = JSON.parse(JSON.stringify(_block.permutation.getAllStates()));
  if(permutations["lit"] === undefined && permutations["extinguished"] === undefined) return;

	const equipment = await (player.getComponent(EntityEquipmentInventoryComponent.componentId) as EntityEquipmentInventoryComponent);
	const offHand = equipment.getEquipment(EquipmentSlot.offhand);
	const inventory = new CContainer((player.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent).container).setPlayer(player);

	const hands = [
		{ slot: mainHand, item: mainHand },
		{ slot: offHand, item: offHand }
	];

	const torchHand = hands.find(hand => {
		if (!hand.item?.typeId) return false; // Skip hands without typeId
		return isTorchIncluded(hand.item?.typeId);
	});
	
	// If there's no torch in any of the hand, then return;
  if(!torchHand) return;

	//* This block handles, when you are holding a placeable items like:
	//* such as ladders, torches, blocks, etc.
	//* So, whenever that happens, then set that to air.
	//* and handle, the consume toggle configuration.
	const onBlockPlaced = world.afterEvents.blockPlace.subscribe((event2) => {
		/**
		 * ? Feature:
		 * * 1. It should only cancel block placing when mainhand is a torch.
		 * * 2. (NOT YER) It should also cancel the block placing, when offhand is a torch,
		 * * like any block you hold in mainhand will be cancelling block placing.
		 *  
		 * ! Bugs:
		 * * 1. (Offhand) It works to block cancel the validTorches, as it doesn't consume the torches, when consumeTorchOnLit is disabled.
		 * * But, it doesn't block cancel the notValidTorches like blocks, etc.
		 */
		system.run(() => world.afterEvents.blockPlace.unsubscribe(onBlockPlaced));

		const onBlockPlacedOldLog: number = onBlockPlacedLogMap.get(player.id);
		onBlockPlacedLogMap.set(player.id, Date.now());
		if ((onBlockPlacedOldLog + 150) >= Date.now()) return;

		const blockPlaced = event2.block;
		const blockPlacePlayer = event2.player;
		const blockPlacedItemStack = blockPlaced.getItemStack();
		if(!Compare.types.isEqual(blockPlacedItemStack.type, mainHand.type)) return;
		if(!Compare.types.isEqual(blockPlacePlayer.id, player.id)) return;

		blockPlaced.setType(MinecraftBlockTypes.air);
		Logger.warn(!isTorchIncluded(blockPlacedItemStack.typeId), blockPlacedItemStack.typeId);
		if(!isTorchIncluded(blockPlacedItemStack.typeId)) inventory.addItem(blockPlacedItemStack.type, 1);	
		if(permutations["lit"] === undefined && permutations["extinguished"] === undefined) return;
		if(!consumeTorchOnLit) {
			if(isTorchIncluded(blockPlacedItemStack.typeId)) inventory.addItem(blockPlacedItemStack.type, 1);	
		}
		if(permutations["lit"] === true || permutations["extinguished"] === false) return;
		Logger.warn("holding a placeable item");

		for (const [key, value] of Object.entries(permutations)) {
			if(key === "lit" && value === false) {
				const flag: boolean = value as boolean;
				forceSetPermutation(_block, flag);
				break;
			}
			else if(key === "extinguished" && value === true) {
				const flag: boolean = value as boolean;
				forceSetPermutation(_block, flag, "extinguished");
				break;
			}
		}
		return;
	});

	// If its not a block that has "lit" or "extinguished" state, then return.
	if(permutations["lit"] === undefined && permutations["extinguished"] === undefined) return;

	// If the block is already lit or not extingueshed, then return.
	if(permutations["lit"] === true || permutations["extinguished"] === false) return;

	//* This should only work when you are interacting
	//* with the campfire, candle, or tnt.
	//* on any angle, as long as you are not holding
	//* a placeable item like ladder, torch, block, etc.
	//* Also, It will automatically extinguish the campfire, if you are holding
	//* a shovel, and you are interacting it too fast, wait for the timer.
	if(consumeTorchOnLit) inventory.clearItem(torchHand.item.typeId, 1);	
	Logger.warn("Not holding any placeable item");
	for (const [key, value] of Object.entries(permutations)) {
		if(key === "lit" && value === false) {
			const flag: boolean = value as boolean;
			forceSetPermutation(_block, flag);
			break;
		}
		else if(key === "extinguished" && value === true) {
			const flag: boolean = value as boolean;
			forceSetPermutation(_block, flag, "extinguished");
			break;
		}
	}
});