import { Compare, isTorchIncluded, torchFireEffects, prioritizeMainHand, consumeTorchOnLit, CContainer, forceSetPermutation, Logger, igniteTNT, debug } from "./packages";
import {EntityDamageCause, EntityEquipmentInventoryComponent, EntityInventoryComponent, EquipmentSlot, MinecraftBlockTypes, MinecraftItemTypes, Player, TicksPerSecond, system, world} from "@minecraft/server";

const logMap: Map<string, number> = new Map<string, number>();

const DEFAULT_EFFECTS: Map<string, number> = new Map([
  [MinecraftItemTypes.torch.id, 40],
  [MinecraftItemTypes.soulTorch.id, 60],
  [MinecraftItemTypes.redstoneTorch.id, 40]
]);

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
	const equipment = await (player.getComponent(EntityEquipmentInventoryComponent.componentId) as EntityEquipmentInventoryComponent);
	const offHand = equipment.getEquipment(EquipmentSlot.offhand);
	const inventory = new CContainer((player.getComponent(EntityInventoryComponent.componentId) as EntityInventoryComponent).container).setPlayer(player);

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
	//? The fire aspect mechanics doesn't need required the "prioritizeHand" config.
	const onBlockPlaced = world.afterEvents.blockPlace.subscribe((onPlaced) => {
		system.run(() => world.afterEvents.blockPlace.unsubscribe(onBlockPlaced));

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

		if(_block.type === MinecraftBlockTypes.tnt && !igniteTNT) return;

		// cancel the blockplacement.
		blockPlaced.setType(MinecraftBlockTypes.air);
		justExecuted = true;

		// If the blockPlaced is not a validTorch, then add it automatically to the inventory. Since it is not torch.
		// We only want to find the torch, since it's part of the config.
		inventory.addItem(blockPlacedItemStack.type, 1);	

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
				_block.setType(MinecraftBlockTypes.air);
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
	if(consumeTorchOnLit) inventory.clearItem(torchHand.item.typeId, 1);	
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
			_block.setType(MinecraftBlockTypes.air);
			player.dimension.spawnEntity("minecraft:tnt", _block.location);
			justExecuted = true;
			break;
		}
	}
});

world.beforeEvents.chatSend.subscribe((event) => {
	const prefix = "!";
	let player = event.sender;
  let message = event.message;
  const args = message.trim().slice(prefix.length).split(/\s+/g);
  const command = args[0];
  if (command !== "config") {
		return;
	};
  Logger.warn(args.toString())
	if(args[1]?.match(/^-(tos|bl)$/)){
		let addonName = "";
		switch(args[1].slice(1)){
			case "tos":
				addonName = "Torch O' Useful";
				break;
			case "bl":
				addonName = "Better Laddering";
				break;
			default:
				event.cancel = true;
				break;
		}
		if(args[2]?.match(/^(help|-h)$/)){
			// Get the Help from RawMessage.
			player.sendMessage(`${addonName} Configuration:`);
		}
	}
	event.cancel = true;
});