import { 
	Logger, 
	JsonDatabase,
	ConfigUI,

	configDBSchema,
	fetchScoreObj,
} from "./packages";
import {Player, ScriptEventSource, system, world} from "@minecraft/server";
import { DatabaseSavingModes } from "database";

world.afterEvents.itemUse.subscribe((event) => {
	const player = event.source as Player;
	if(!player.isSneaking) return;
	player.runCommand(`scriptevent yn:torchouseful config`);
});

export const configDB = new JsonDatabase("torchouseful_configDB", DatabaseSavingModes.OneTimeSave).load();

world.afterEvents.worldInitialize.subscribe((event) => {
	world.sendMessage("§aTorch o' useful §fis loaded.");
});

world.afterEvents.playerJoin.subscribe((event) => {
	const playerID = event.playerId;
	let configurationObject = fetchScoreObj(playerID);
	configDB.set(configDBSchema(playerID), configurationObject);
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
	const {id, initiator, sourceEntity, message, sourceBlock, sourceType} = event;
	if(sourceType !== ScriptEventSource.Entity) return;
	if(!sourceEntity) return;
	if(!(sourceEntity instanceof Player)) return;
	if(id.match(/^test:clear$/)){
		configDB.clear();
	}
	if(id.match(/^yn:torchouseful$/)){
		if(message.match(/^config$/)){
			system.run(() => {
				/**
				 * debug: boolean
				 * igniteTNT: boolean
				 * includeCustomTorch: []
				 * excludeCustomTorch: []
				 * prioritizeMainHand: boolean
				 * consumeTorchOnLit: boolean
				 * torchFireEffects: {}
				 */
				ConfigUI.main(id, sourceEntity);
			});
		}
	}
	if(!sourceBlock) return;
	if(!sourceType) return;
});