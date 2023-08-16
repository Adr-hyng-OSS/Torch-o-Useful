const config =  {
  /**
   * Enables debug messages to content logs.
   */
  debug: true,
  /**
   * String Test
   */
  configOption1: "test",
  /**
   * String Test
   * String Test2
   */
  configOption2: true,
  /**
   * String Test
   */
  configOption3: 5,
  /**
   * String Test
   */
  configOption4: {
		"from": 1,
		"to": 5
	},
  /**
   * String Test
   */
  configOption5: ["Cat", "Dog", "Bird"],
  /**
   * String Test
   */
  configOption6: {
		"selection": []
	},
  /**
   * String Test
   */
  configOption7: {
		"minecraft:torch": 40,
		"minecraft:soul_torch": 60,
		"minecraft:redstone_torch": 40,
		"custom_namespace:custom_torch": 40
	},

  configOption8: {
		"minecraft:torch": 10,
		"minecraft:soul_torch": 20,
		"minecraft:redstone_torch": 30,
		"custom_namespace:custom_torch": 40	},
};

const {configOption1, configOption2, configOption3, configOption4, configOption5, configOption6, configOption7} = config;

const keys = {
  "basic": [],
  "advanced": [],
  "customized": []
};

for (const [key, value] of Object.entries(config)) {
  if (typeof value === "object") {
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

// iterate the keys basic
keys.basic.forEach(({key, value}) => {
  console.log(key, value);
});


// iterate the keys advanced
keys.advanced.forEach(({key, value}) => {
  if(Array.isArray(value)) {
    console.log(key, value[0]);
  }
  else {
    console.log(key, value);

  }
});

// iterate the keys customized
keys.customized.forEach(({ key, value }) => {
  console.log(key);
  value.forEach(configOption => {
    const [configKey, configValue] = Object.entries(configOption)[0];
    console.log(configKey, configValue);
  });
});

console.log(keys.basic);
console.log(keys.advanced);
console.log(keys.customized);