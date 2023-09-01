interface Object {
  clone(): any;
}

Object.prototype.clone = function(this: any): any {
  return JSON.parse(JSON.stringify(this));
};

