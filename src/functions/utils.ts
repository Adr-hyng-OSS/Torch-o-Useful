import { Block, Player, system } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import {includeCustomTorch, excludeCustomTorch, Logger} from "../packages";
import { configDB } from "../main";
import config from "config";

function isTorchIncluded(blockID: string): boolean {
  const currentPatterns: string[] = [
    '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
  ];

  const excludeRegexes: RegExp[] = excludeCustomTorch.map((excluded: string) => new RegExp(excluded));
  
  const isExcluded: boolean = excludeRegexes.some((regex: RegExp) => regex.test(blockID));
  if (isExcluded) {
    return false;
  }

  let patterns: string[]  = [...currentPatterns, ...includeCustomTorch];
  const combinedPattern = new RegExp(patterns.join('|'));
  return combinedPattern.test(blockID);
}

function forceSetPermutation(_block: Block, flag: boolean, state: string = "lit"){
  const perm = _block.permutation.withState(state, !flag);
  system.run(() => _block.setPermutation(perm));
}

async function forceShow(player: Player, form: ActionFormData | ModalFormData, timeout: number = Infinity): Promise<ActionFormResponse | ModalFormResponse> {
    // Script example for ScriptAPI
    // Author: Jayly#1397 <Jayly Discord>
    //         Worldwidebrine#9037 <Bedrock Add-Ons>
    // Project: https://github.com/JaylyDev/ScriptAPI
    const startTick: number = system.currentTick;
    while ((system.currentTick - startTick) < timeout) {
        const response: ActionFormResponse | ModalFormResponse = await (form.show(player)).catch(er=>console.error(er,er.stack)) as ActionFormResponse | ModalFormResponse;
        if (response.cancelationReason !== FormCancelationReason.UserBusy) {
            return response;
        }
    };
    throw new Error(`Timed out after ${timeout} ticks`);
};


Object.prototype.clone = function(this: any): any {
	return JSON.parse(JSON.stringify(this));
};

const fetchScoreObj = (playerID: string) => {
	const privateConfig = (config as Object).clone();
  return configDB.get(configDBSchema(playerID)) ?? privateConfig;
};

const configDBSchema = (playerID: string) => {
	return `${playerID}_configObject`;
}

const ConfigUI = {
  main: (id: string, player: Player) => {
		const isPlainObject = (value: any) => typeof value === 'object' && !Array.isArray(value) && value !== null && !(value instanceof Function);
		const isMap = (value: any) => value instanceof Map;
		const keys = {
			"basic": [],
			"customized": [],
			"advanced": []
		}

		let configurationObject = fetchScoreObj(player.id);
		configDB.set(configDBSchema(player.id), configurationObject);

		for (const [key, value] of Object.entries(configurationObject)) {
			if (typeof value === "object" || isMap(value) || isPlainObject(value)) {
				if (!Array.isArray(value)) {
					const advancedValues = [];
					for (const [key2, value2] of Object.entries(value)) {
						advancedValues.push({ [key2]: value2 });
					}
					if (advancedValues.some(entry => entry.hasOwnProperty('from') || entry.hasOwnProperty('to'))) {
						const combinedValues = advancedValues.reduce((result, entry) => Object.assign(result, entry), {});
        		keys.advanced.push({ key: key, value: combinedValues });
					} else if (advancedValues.some(entry => entry.hasOwnProperty('selection'))) {
						keys.advanced.push({ key: key, value: advancedValues });
					} else {
						keys.customized.push({ key: key, value: advancedValues });
					}
				} else {
					keys.customized.push({ key: key, value: value });
				}
			} else {
				keys.basic.push({ key: key, value: value });
			}
		}

		const main = new ActionFormData()
		.title({translate: `ConfigurationForm.${id}.addonIdentifier.name`, with: ["\n"]})
		.button({translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"]})
		.button({translate: `ConfigurationForm.${id}.listOptions.name`, with: ["\n"]})
		.button({translate: `ConfigurationForm.${id}.dictionaryOptions.name`, with: ["\n"]});
		forceShow(player, main).then((result: ActionFormResponse) => {
				if (result.canceled) return player.sendMessage('Ui closed!');
				if (result.selection === 0) ConfigUI.basic(id, player, keys.basic);
				if (result.selection === 1) ConfigUI.customize(id, player, keys.customized);
				if (result.selection === 2) ConfigUI.advanced(id, player, keys.advanced);
		})
  },
  basic: (id: string, player: Player, keyValues: any[]) => {
		const formKeys = {};
		let i = 0;
		const basicForm = new ModalFormData()
		.title({translate: `ConfigurationForm.${id}.basic.name`, with: ["\n"]});

		// This is for: Boolean, String, Number.
		keyValues.forEach(({key, value}) => {
			formKeys[i] = {"key": key, "value": value};
			i++;
			if(typeof value === "boolean") {
				basicForm.toggle({translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"]}, value);
			}
			else {
				basicForm.textField({translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"]}, value + "");
			}
		});

		basicForm.toggle({translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"]}, false);
		
		forceShow(player, basicForm).then((result: ModalFormResponse) => {
				if (result.canceled) return player.sendMessage('Ui closed!');
				const configurationObject = fetchScoreObj(player.id);
				result.formValues.forEach((value, key) => {
					if (key === result.formValues.length - 1 && value === true) ConfigUI.main(id, player);
					if(key === result.formValues.length - 1) return;
					configurationObject[formKeys[key].key] = value;
					configDB.set(configDBSchema(player.id), configurationObject);
				});
		});
  },
  customize: (id: string, player: Player, keyValues: any[]) => {
		let selectedIndex = 0;
		const customizationForm = new ModalFormData();

		keyValues.forEach(({ key, value }) => {
			const dropDownSet = new Set<string>();
			value.forEach((configOption: Map<string, Map<string, string | boolean | number>>) => {
				const [configKey, configValue] = Object.entries(configOption)[0];
				dropDownSet.add(`${configKey.split(":")[1]}: ${configValue}`);
			});
			const textFieldMap = Array.isArray(config[key]) ? "Update" : "Key";
			customizationForm.dropdown({translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"]}, ["Create", ...Array.from(dropDownSet)], selectedIndex);
			customizationForm.textField({translate: textFieldMap, with: ["\n"]}, "Add / Edit / Delete");
			customizationForm.toggle({translate: `shouldDelete`, with: ["\n"]}, false);
		});

		customizationForm.toggle({translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"]}, false);
		forceShow(player, customizationForm).then((result: ModalFormResponse) => {
			if (result.canceled) return player.sendMessage('Ui closed!');
			result.formValues.forEach((value, key) => {
				if (key === result.formValues.length - 1 && value === true) ConfigUI.main(id, player);
			});
		});
	},
	advanced: (id: string, player: Player, keyValues: any[]) => {
		const formKeys = {};
		let i = 0;
		enum UnknownValues {
			Selection = "selectionIndex",
			Slide = "current"
		}
		const advancedForm = new ModalFormData();

		const configurationObject = fetchScoreObj(player.id);
		keyValues.forEach(({key, value}) => {
			formKeys[i] = {"key": key, "value": value};
			i++;
			if(Array.isArray(value)) {
				let selection: string[];
				let selectionIndex: number | null;

				// Assign the value directly using destructuring assignment
				selection = value[0]["selection"];

				// Check if any object in the array has the key "selectionIndex"
				const hasSelectionIndex = value.some(obj => obj.hasOwnProperty(UnknownValues.Selection));

				if (hasSelectionIndex) {
					const objWithSelectionIndex = value.find(obj => obj.hasOwnProperty(UnknownValues.Selection));
					selectionIndex = objWithSelectionIndex[UnknownValues.Selection];
				} else {
					configurationObject[key][UnknownValues.Selection] = configurationObject[key][UnknownValues.Selection] ?? 0;
					selectionIndex = configurationObject[key][UnknownValues.Selection];
				}

				if (!selection.length) {
					return;
				}

				selection = ["Choose", ...selection];
				advancedForm.dropdown({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, selection, selectionIndex);
			}
			else {
				const hasLoadedSlide = value.hasOwnProperty(UnknownValues.Slide);
				let currentSlide: number | null;

				if (hasLoadedSlide) {
					currentSlide = value[UnknownValues.Slide];
				} else {
					configurationObject[key][UnknownValues.Slide] = configurationObject[key][UnknownValues.Slide] ?? Math.round((value.from + value.to) / 2);
					currentSlide = configurationObject[key][UnknownValues.Slide];
				}

				advancedForm.slider({ translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"] }, value.from, value.to, 1, currentSlide);
			}
		});

		advancedForm.toggle({translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"]}, false);

		forceShow(player, advancedForm).then((result: ModalFormResponse) => {
			if (result.canceled) return player.sendMessage('Ui closed!');
			result.formValues.forEach((value, key) => {
				if (key === result.formValues.length - 1 && value === true) ConfigUI.main(id, player);
				if(key === result.formValues.length - 1) return;
				const formValues = configurationObject[formKeys[key].key];
				if(formValues.hasOwnProperty("selection")) {
					formValues[UnknownValues.Selection] = value;
				}
				else {
					formValues[UnknownValues.Slide] = value;
				}
				configDB.set(configDBSchema(player.id), configurationObject);
			});
		});
	}
};

export {
  isTorchIncluded, 
  forceSetPermutation, 
  forceShow,
	ConfigUI
};