import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import { 
	Logger, 
	JsonDatabase,
	ConfigUI,
} from "./packages";
import {Player, ScriptEventSource, system} from "@minecraft/server";
import { DatabaseSavingModes } from "database";

export const configDB = new JsonDatabase("torchouseful_configDB", DatabaseSavingModes.OneTimeSave).load();
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