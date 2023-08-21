import { Block, Player, system } from "@minecraft/server";
import { ActionFormData, ActionFormResponse, FormCancelationReason, ModalFormData, ModalFormResponse } from "@minecraft/server-ui";
import {Logger} from "../packages";
import { configDB } from "../main";
import * as ConfigurationInstance from "../config";

function isTorchIncluded(configObj: any, blockID: string): boolean {


  const currentPatterns: string[] = [
    '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
  ];

  const excludeRegexes: RegExp[] = configObj.excludeCustomTorch.map((excluded: string) => new RegExp(excluded));
  
  const isExcluded: boolean = excludeRegexes.some((regex: RegExp) => regex.test(blockID));
  if (isExcluded) {
    return false;
  }

  let patterns: string[]  = [...currentPatterns, ...configObj.includeCustomTorch];
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

export const fetchScoreObj = (playerID: string) => {
	// Deep Copy of the config object.
	const privateConfig = (ConfigurationInstance.default as Object).clone();

	// If the configDB has the playerID's configObject, then return it. Else, if it hasn't got any configObject, then return the privateConfig instead as default.
  return configDB.get(configDBSchema(playerID)) ?? privateConfig;
};

export const configDBSchema = (playerID: string) => {
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
			if(result.canceled) return player.sendMessage('Ui closed!');
			const length = result.formValues.length;
			const shouldBack = result.formValues[length - 1] === true;
			const configurationObject = fetchScoreObj(player.id);
			result.formValues.forEach((value, formIndex) => {
					const isLastElement = formIndex === length - 1;
					if (isLastElement && shouldBack) return ConfigUI.main(id, player);
					if(isLastElement) return;
					configurationObject[formKeys[formIndex].key] = value;
					configDB.set(configDBSchema(player.id), configurationObject);
				});
		});
  },
  customize: (id: string, player: Player, keyValues: any[]) => {
		const formKeys = {};
		let i = 0;
		let selectedIndex = 0;
		const customizationForm = new ModalFormData()
		.title({translate: `ConfigurationForm.${id}.listOptions.name`, with: ["\n"]});

		const configurationObject = fetchScoreObj(player.id);
		keyValues.forEach(({ key, value }) => {
			formKeys[i] = {"key": key, "value": value, "dropdown": []};
			i += 3;
			const dropDownSet = new Set<string>();
			const isArray = Array.isArray(configurationObject[key]);
			if(isArray) {
				value.forEach((configOption: string) => {
					dropDownSet.add(configOption)
				});
			}
			else {
				value.forEach((configOption: Map<string, Map<string, string | boolean | number>>) => {
					const [configKey, configValue] = Object.entries(configOption)[0];
					const entry = `${configKey}: ${configValue}`;
					dropDownSet.add(entry);
					formKeys[i-3] = {"key": key, "value": value, "dropdown": [...formKeys[i-3].dropdown, entry]};
				});
			}
			
			const textFieldMap = isArray ? "Update" : "Key";

			// 3 components per Customizable Map or Array. So, (x * 3) + 1 = Total Form Values and Keys 
			customizationForm.dropdown({translate: `ConfigurationForm.${id}.${key}.name`, with: ["\n"]}, ["Create", ...Array.from(dropDownSet)], selectedIndex);
			customizationForm.textField({translate: textFieldMap, with: ["\n"]}, "Add / Edit / Delete");
			customizationForm.toggle({translate: `shouldDelete`, with: ["\n"]}, false);
		});

		customizationForm.toggle({translate: `ConfigurationForm.${id}.misc.back.text`, with: ["\n"]}, false);
		forceShow(player, customizationForm).then((result: ModalFormResponse) => {
			if (result.canceled) return player.sendMessage('Ui closed!');
			const length = result.formValues.length;
			const shouldBack = result.formValues[length - 1] === true;
			result.formValues.forEach((value, formIndex) => {
				const isLastElement = formIndex === length - 1;
				if (isLastElement && shouldBack) return ConfigUI.main(id, player);
				if(isLastElement) return;
				const formValues = configurationObject[formKeys[formIndex]?.key];
				//! [HERE FIRST] 
				//* If dropdown's index is 0, and TextField has a value, then create a new entry to dropdown with the TextField's value.
				//* If dropdown's index is not 0, and TextField has a value, and isShouldDelete is off, then edit the dropdown's value with the TextField's value.
				//* If dropdown's index is not 0, and isShouldDelete is on, then delete the element the dropDown's index has specified.

				// if(formIndex % 3 === 1) Logger.warn(formKeys[formIndex]?.key, result.formValues[formIndex] + "");
				// This is an indicator that the formIndex is a dropdown or contains an array or object, which is also
				// A dropdown component.
				if(formIndex % 3 === 0) {
					let modifiedEntry: { key: string; value: any };
					// Create new one.
					// When the dropdown's index is 0 or the top most index, which has a value of "Create".
					value = value as number;
					if(value === 0 && result.formValues[formIndex + 2] === false) {
						if(result.formValues[formIndex + 1] !== "") {
							if(Array.isArray(formValues)) {
								formValues.push(result.formValues[formIndex + 1] + "");
							} 
							// For Map / Object
							else {
								// Getting the namespace and the value: minecraft:torch: 120.
								const [namespace, ...rest] = (result.formValues[formIndex + 1] + "").split(":");
								const newKey = `${namespace}:${rest[0].trim()}`;
								const newValue = rest[1] ? rest[1].trim() : '';

								// Formmating the newValue to boolean or number.
								let modifiedValue: boolean | number | string;
								if (newValue === "true" || newValue === "false") {
									modifiedValue = newValue === "true";
								} else if (!isNaN(Number(newValue))) {
									modifiedValue = Number(newValue);
								}
								
								// Assigning the new key and value to the modifiedEntry object.
								modifiedEntry = {key: newKey, value: modifiedValue};

								// It should check first if it has similar key in the object, if it has, then don't add it. just ignore.
								// If it doesn't have, then add it.
								if(!formValues.hasOwnProperty(modifiedEntry.key)) {
									formValues[modifiedEntry.key] = modifiedEntry.value;
								}
							}
						}
					}
					// Edit existing one.
					else if(value !== 0) {
						if(Array.isArray(formValues)) {
							value = value !== 0 ? value - 1 : value;
							// If shouldDelete toggle is on, then delete the current selected element
							// Even if the textField has or has not have a value.
							if (result.formValues[formIndex + 2] === true) {
								formValues.splice(value, 1);
							}
							// If text field is not empty, then edit the dropdown's value.
							if(result.formValues[formIndex + 1] !== "") {
								// If the shouldDelete toggle is off, then edit the dropdown's value.
								if(result.formValues[formIndex + 2] === false) {
									formValues[value] = result.formValues[formIndex + 1] + "";
								} 
							}
						}

						else {
							// If shouldDelete toggle is on, then delete the current selected element
							if (result.formValues[formIndex + 2] === true) {
								value = value !== 0 ? value - 1 : value;
								const fetchedKey = Object.keys(formKeys[formIndex]?.value[value])[0];
								delete formValues[fetchedKey];
							}
							// Editting, if it has the key, and the shouldDelete toggle is off.
							if(result.formValues[formIndex + 1] !== "" && result.formValues[formIndex + 2] === false) {
								value = value !== 0 ? value - 1 : value;
								const fetchedKey = Object.keys(formKeys[formIndex]?.value[value])[0];
								if(formValues.hasOwnProperty(fetchedKey)) {
									const newValue = result.formValues[formIndex + 1] + "";
									let modifiedValue: boolean | number | string;
									if (newValue === "true" || newValue === "false") {
										modifiedValue = newValue === "true";
									} else if (!isNaN(Number(newValue))) {
										modifiedValue = Number(newValue);
									}
									formValues[fetchedKey] = modifiedValue;
								}
							}
						}
					}
				}
				configDB.set(configDBSchema(player.id), configurationObject);
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
		const advancedForm = new ModalFormData()
		.title({translate: `ConfigurationForm.${id}.dictionaryOptions.name`, with: ["\n"]});

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
			const length = result.formValues.length;
			const shouldBack = result.formValues[length - 1] === true;
			result.formValues.forEach((value, formIndex) => {
				const isLastElement = formIndex === length - 1;
				if (isLastElement && shouldBack) return ConfigUI.main(id, player);
				if(isLastElement) return;
				const formValues = configurationObject[formKeys[formIndex].key];
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
	ConfigUI,
};